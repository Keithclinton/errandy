import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHmac } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

/** How long a deleted account's email, phone number and Google account can't be used to sign up again. */
export const DELETED_ACCOUNT_BLOCK_DAYS = 90;

export type BlockedIdentifierKind = "email" | "phone" | "google";

export interface AccountIdentifiers {
  email?: string | null;
  /** E.164, as stored on the user. */
  phone?: string | null;
  googleId?: string | null;
}

export interface ActiveBlock {
  kind: BlockedIdentifierKind;
  blockedUntil: Date;
}

const KIND_LABELS: Record<BlockedIdentifierKind, string> = {
  email: "this email address",
  phone: "this phone number",
  google: "this Google account",
};

export function formatBlockDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" });
}

/**
 * Lower-cases an email and drops the parts that don't change which inbox gets the mail, so
 * "Jane.Doe+2@gmail.com" can't be used to get around a block on "janedoe@gmail.com".
 */
export function canonicalEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return trimmed;
  let local = trimmed.slice(0, at);
  let domain = trimmed.slice(at + 1);
  local = local.split("+")[0] || local;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

export class AccountRecentlyDeletedException extends ForbiddenException {
  constructor({ kind, blockedUntil }: ActiveBlock) {
    super({
      statusCode: 403,
      error: "Forbidden",
      code: "ACCOUNT_RECENTLY_DELETED",
      message: `An account using ${KIND_LABELS[kind]} was deleted recently. You can use it on Errandspot again from ${formatBlockDate(blockedUntil)}.`,
      blockedUntil: blockedUntil.toISOString(),
    });
  }
}

/**
 * Remembers recently deleted accounts so the same person can't delete their account and sign
 * straight back up to collect the welcome tokens again.
 */
@Injectable()
export class AccountBlocksService {
  private readonly key: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // Hashes are keyed so the table alone can't be brute-forced back into phone numbers
    // (there are only about a billion Kenyan mobile numbers). The key is derived from the
    // refresh-token secret, not that secret itself, so the two uses never share a key.
    const secret = config.get<string>("JWT_REFRESH_SECRET");
    if (!secret) throw new Error("JWT_REFRESH_SECRET must be set");
    this.key = createHmac("sha256", secret).update("errandspot:account-deletion-block:v1").digest();
  }

  private hashes(ids: AccountIdentifiers): { kind: BlockedIdentifierKind; hash: string }[] {
    const hash = (value: string) => createHmac("sha256", this.key).update(value).digest("hex");
    const out: { kind: BlockedIdentifierKind; hash: string }[] = [];
    if (ids.email) out.push({ kind: "email", hash: hash(`email:${canonicalEmail(ids.email)}`) });
    if (ids.phone) out.push({ kind: "phone", hash: hash(`phone:${ids.phone}`) });
    if (ids.googleId) out.push({ kind: "google", hash: hash(`google:${ids.googleId}`) });
    return out;
  }

  /** Call inside the transaction that deletes the account, so the block can't be skipped. */
  async blockDeletedAccount(tx: Prisma.TransactionClient, ids: AccountIdentifiers, now = new Date()): Promise<Date> {
    const blockedUntil = new Date(now.getTime() + DELETED_ACCOUNT_BLOCK_DAYS * 24 * 60 * 60 * 1000);
    for (const { hash } of this.hashes(ids)) {
      await tx.accountDeletionBlock.upsert({
        where: { identifierHash: hash },
        create: { identifierHash: hash, blockedUntil },
        update: { blockedUntil },
      });
    }
    // An expired block is no longer needed for anything, so it isn't kept.
    await tx.accountDeletionBlock.deleteMany({ where: { blockedUntil: { lte: now } } });
    return blockedUntil;
  }

  /** The first of these identifiers that's still blocked (email, then phone, then Google), or null. */
  async findActiveBlock(ids: AccountIdentifiers): Promise<ActiveBlock | null> {
    const hashes = this.hashes(ids);
    if (hashes.length === 0) return null;
    const blocks = await this.prisma.accountDeletionBlock.findMany({
      where: { identifierHash: { in: hashes.map((h) => h.hash) }, blockedUntil: { gt: new Date() } },
    });
    for (const { kind, hash } of hashes) {
      const block = blocks.find((b) => b.identifierHash === hash);
      if (block) return { kind, blockedUntil: block.blockedUntil };
    }
    return null;
  }

  async assertNotBlocked(ids: AccountIdentifiers): Promise<void> {
    const block = await this.findActiveBlock(ids);
    if (block) throw new AccountRecentlyDeletedException(block);
  }
}
