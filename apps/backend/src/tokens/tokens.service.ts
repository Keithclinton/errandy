import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, TokenPurchase, TokenTransactionType, TokenPurchaseStatus } from "@prisma/client";
import { timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MpesaService, StkPushResult } from "../payments/mpesa.service";
import { InsufficientTokensException } from "./exceptions/insufficient-tokens.exception";
import { TOKEN_PACKS, TokenPack } from "./token-packs";
import { InitiatePurchaseDto } from "./dto/initiate-purchase.dto";
import { normalizeKenyanPhone } from "../common/phone";
import { EVENTS, TokensPurchasedEvent } from "../common/events/domain-events";

const SIGNUP_BONUS_TOKENS = 3;

// Daraja's callback normally lands within seconds of the payer entering their PIN. Only
// once it's this late do we ask Daraja directly, and then no more often than every interval.
const RECONCILE_GRACE_MS = 30_000;
const RECONCILE_INTERVAL_MS = 15_000;
// The cron sweep only chases recent purchases; older ones that never resolved need a person.
const RECONCILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type PurchaseOutcome =
  | { state: "completed"; resultCode?: number; resultDesc?: string; mpesaReceiptNumber?: string }
  | { state: "failed"; resultCode?: number; resultDesc?: string };

interface LedgerParams {
  userId: string;
  amount: number;
  type: TokenTransactionType;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mpesaService: MpesaService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  /** Atomic conditional decrement — never goes negative, no read-then-write race. */
  async debit(tx: Prisma.TransactionClient, { userId, amount, type, relatedEntityType, relatedEntityId }: LedgerParams): Promise<{ balanceAfter: number }> {
    const result = await tx.user.updateMany({
      where: { id: userId, tokenBalance: { gte: amount } },
      data: { tokenBalance: { decrement: amount } },
    });
    if (result.count === 0) {
      throw new InsufficientTokensException("Not enough tokens");
    }
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenBalance: true } });
    await tx.tokenTransaction.create({
      data: { userId, type, amount: -amount, balanceAfter: user.tokenBalance, relatedEntityType, relatedEntityId },
    });
    return { balanceAfter: user.tokenBalance };
  }

  async credit(tx: Prisma.TransactionClient, { userId, amount, type, relatedEntityType, relatedEntityId }: LedgerParams): Promise<{ balanceAfter: number }> {
    const user = await tx.user.update({
      where: { id: userId },
      data: { tokenBalance: { increment: amount } },
      select: { tokenBalance: true },
    });
    await tx.tokenTransaction.create({
      data: { userId, type, amount, balanceAfter: user.tokenBalance, relatedEntityType, relatedEntityId },
    });
    return { balanceAfter: user.tokenBalance };
  }

  /** No-ops silently if already granted — makes the signup bonus non-repeatable even on re-verification. */
  async grantSignupBonusIfEligible(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const result = await tx.user.updateMany({
      where: { id: userId, hasReceivedSignupTokens: false },
      data: { tokenBalance: { increment: SIGNUP_BONUS_TOKENS }, hasReceivedSignupTokens: true },
    });
    if (result.count === 0) return;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenBalance: true } });
    await tx.tokenTransaction.create({
      data: {
        userId,
        type: TokenTransactionType.signup_grant,
        amount: SIGNUP_BONUS_TOKENS,
        balanceAfter: user.tokenBalance,
        relatedEntityType: "user",
        relatedEntityId: userId,
      },
    });
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenBalance: true } });
    return user.tokenBalance;
  }

  async listTransactions(userId: string, page = 1, limit = 20) {
    const [items, total] = await Promise.all([
      this.prisma.tokenTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tokenTransaction.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  listPacks(): TokenPack[] {
    return TOKEN_PACKS;
  }

  async initiatePurchase(userId: string, dto: InitiatePurchaseDto) {
    const pack = TOKEN_PACKS.find((p) => p.id === dto.packId);
    if (!pack) throw new BadRequestException("Unknown token pack");
    const phone = normalizeKenyanPhone(dto.phone);

    if (this.mpesaService.mode === "unavailable") {
      throw new ServiceUnavailableException("Buying tokens isn't available right now. Please try again later.");
    }

    const purchase = await this.prisma.tokenPurchase.create({
      data: { userId, tokens: pack.tokens, amountKes: pack.amountKes, phone, status: TokenPurchaseStatus.pending },
    });

    let stk: StkPushResult;
    try {
      stk = await this.mpesaService.initiateStkPush({
        phone,
        amountKes: pack.amountKes,
        // Shown on the payer's prompt as the account number. Daraja caps it at 12 characters.
        accountReference: "Errandspot",
        transactionDesc: pack.tokens === 1 ? "1 token" : `${pack.tokens} tokens`,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`STK push for purchase ${purchase.id} failed: ${reason}`);
      await this.prisma.tokenPurchase.update({
        where: { id: purchase.id },
        data: { status: TokenPurchaseStatus.failed, resultDesc: reason.slice(0, 500) },
      });
      throw new BadGatewayException("We couldn't send the M-Pesa prompt. Check the phone number and try again.");
    }

    await this.prisma.tokenPurchase.update({
      where: { id: purchase.id },
      data: { checkoutRequestId: stk.checkoutRequestId, merchantRequestId: stk.merchantRequestId, simulated: stk.simulated },
    });

    if (!stk.simulated) {
      return { purchaseId: purchase.id, status: TokenPurchaseStatus.pending };
    }

    const balanceAfter = await this.settlePurchase(purchase.id, { state: "completed" });
    return { purchaseId: purchase.id, status: TokenPurchaseStatus.completed, balance: balanceAfter ?? undefined };
  }

  async getPurchase(userId: string, purchaseId: string) {
    let purchase = await this.prisma.tokenPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase || purchase.userId !== userId) throw new NotFoundException("Purchase not found");
    if (await this.reconcileIfOverdue(purchase)) {
      purchase = await this.prisma.tokenPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    }
    return toPurchaseView(purchase);
  }

  /**
   * Daraja's STK callback. Daraja doesn't sign its callbacks, so the URL it posts to carries
   * MPESA_CALLBACK_SECRET; a request without it is treated as if the route doesn't exist.
   */
  async handlePaymentCallback(secret: string, body: unknown): Promise<void> {
    if (!this.isValidCallbackSecret(secret)) throw new NotFoundException();

    // Shape: { Body: { stkCallback: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc,
    //   CallbackMetadata?: { Item: [{ Name: "Amount" | "MpesaReceiptNumber" | "TransactionDate" | "PhoneNumber", Value }] } } } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callback = (body as any)?.Body?.stkCallback;
    if (!callback?.CheckoutRequestID) {
      this.logger.warn(`Ignoring a payment callback with no CheckoutRequestID: ${JSON.stringify(body)}`);
      return;
    }
    const checkoutRequestId = String(callback.CheckoutRequestID);
    const purchase = await this.prisma.tokenPurchase.findUnique({ where: { checkoutRequestId } });
    if (!purchase) {
      // Money may have moved with no purchase to credit (e.g. our STK push request timed out
      // after Daraja had already sent the prompt). Needs a person to sort out.
      this.logger.error(`Payment callback for unknown CheckoutRequestID ${checkoutRequestId}: ${JSON.stringify(callback)}`);
      return;
    }

    const resultCode = Number(callback.ResultCode);
    const resultDesc = String(callback.ResultDesc ?? "");
    if (resultCode !== 0) {
      await this.settlePurchase(purchase.id, { state: "failed", resultCode, resultDesc });
      return;
    }

    const items: Array<{ Name?: string; Value?: unknown }> = callback.CallbackMetadata?.Item ?? [];
    const valueOf = (name: string) => items.find((item) => item?.Name === name)?.Value;
    const paidAmount = Number(valueOf("Amount"));
    if (paidAmount !== purchase.amountKes.toNumber()) {
      // Daraja charges exactly what we asked for, so a mismatch means this didn't come from
      // Daraja. Leave the purchase pending; the STK query will find out what really happened.
      this.logger.error(`Payment callback amount ${paidAmount} doesn't match purchase ${purchase.id} (${purchase.amountKes})`);
      return;
    }
    const receipt = valueOf("MpesaReceiptNumber");
    await this.settlePurchase(purchase.id, {
      state: "completed",
      resultCode,
      resultDesc,
      mpesaReceiptNumber: receipt ? String(receipt) : undefined,
    });
  }

  /** For the cron: asks Daraja about recent purchases whose callback never came. */
  async reconcileOverduePurchases(limit = 50): Promise<{ checked: number; settled: number }> {
    const now = Date.now();
    const overdue = await this.prisma.tokenPurchase.findMany({
      where: {
        status: TokenPurchaseStatus.pending,
        simulated: false,
        checkoutRequestId: { not: null },
        createdAt: { lt: new Date(now - RECONCILE_GRACE_MS), gt: new Date(now - RECONCILE_MAX_AGE_MS) },
      },
      // Least recently checked first, so a few purchases Daraja can't answer about don't starve the rest.
      orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
      take: limit,
    });
    let settled = 0;
    for (const purchase of overdue) {
      if (await this.reconcileIfOverdue(purchase)) settled += 1;
    }
    return { checked: overdue.length, settled };
  }

  /** Returns true if the purchase reached a final state as a result. */
  private async reconcileIfOverdue(purchase: TokenPurchase): Promise<boolean> {
    if (purchase.status !== TokenPurchaseStatus.pending || purchase.simulated || !purchase.checkoutRequestId) return false;
    const now = Date.now();
    if (now - purchase.createdAt.getTime() < RECONCILE_GRACE_MS) return false;
    if (purchase.lastCheckedAt && now - purchase.lastCheckedAt.getTime() < RECONCILE_INTERVAL_MS) return false;

    // Claim this check, so several polls arriving together make one Daraja call between them.
    const claimed = await this.prisma.tokenPurchase.updateMany({
      where: { id: purchase.id, status: TokenPurchaseStatus.pending, lastCheckedAt: purchase.lastCheckedAt },
      data: { lastCheckedAt: new Date(now) },
    });
    if (claimed.count === 0) return false;

    const outcome = await this.mpesaService.queryStkPush(purchase.checkoutRequestId);
    if (outcome.state === "pending") return false;
    await this.settlePurchase(purchase.id, outcome);
    return true;
  }

  /**
   * Moves a purchase to its final state. Daraja retries callbacks, and a callback can race
   * the STK query, so this is idempotent: the status change is a conditional update, and only
   * the call that actually makes it credits tokens. A failed purchase can still complete,
   * because a late success means the payer's money has moved; a completed one never changes.
   * Returns the new balance if this call credited tokens.
   */
  private async settlePurchase(purchaseId: string, outcome: PurchaseOutcome): Promise<number | null> {
    if (outcome.state === "failed") {
      await this.prisma.tokenPurchase.updateMany({
        where: { id: purchaseId, status: TokenPurchaseStatus.pending },
        data: { status: TokenPurchaseStatus.failed, resultCode: outcome.resultCode, resultDesc: outcome.resultDesc },
      });
      return null;
    }

    const settled = await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.tokenPurchase.updateMany({
        where: { id: purchaseId, status: { in: [TokenPurchaseStatus.pending, TokenPurchaseStatus.failed] } },
        data: {
          status: TokenPurchaseStatus.completed,
          completedAt: new Date(),
          resultCode: outcome.resultCode,
          resultDesc: outcome.resultDesc,
          mpesaReceiptNumber: outcome.mpesaReceiptNumber,
        },
      });
      if (flipped.count === 0) return null;
      const purchase = await tx.tokenPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
      const { balanceAfter } = await this.credit(tx, {
        userId: purchase.userId,
        amount: purchase.tokens,
        type: TokenTransactionType.purchase,
        relatedEntityType: "token_purchase",
        relatedEntityId: purchase.id,
      });
      return { purchase, balanceAfter };
    });

    if (!settled) {
      // Already completed, e.g. by the STK query, which doesn't return a receipt number.
      // Keep the receipt from a later callback since it's what the payer has in their SMS.
      if (outcome.mpesaReceiptNumber) {
        await this.prisma.tokenPurchase.updateMany({
          where: { id: purchaseId, status: TokenPurchaseStatus.completed, mpesaReceiptNumber: null },
          data: { mpesaReceiptNumber: outcome.mpesaReceiptNumber },
        });
      }
      return null;
    }

    await this.events.emitAsync(EVENTS.TOKENS_PURCHASED, {
      userId: settled.purchase.userId,
      tokens: settled.purchase.tokens,
      amountKes: settled.purchase.amountKes.toString(),
      purchaseId: settled.purchase.id,
      balanceAfter: settled.balanceAfter,
    } satisfies TokensPurchasedEvent);
    return settled.balanceAfter;
  }

  private isValidCallbackSecret(secret: string): boolean {
    const expected = this.config.get<string>("MPESA_CALLBACK_SECRET");
    if (!expected) return false;
    const given = Buffer.from(secret);
    const wanted = Buffer.from(expected);
    return given.length === wanted.length && timingSafeEqual(given, wanted);
  }
}

/**
 * What the payer sees about their purchase. Leaves out Daraja's request ids and resultDesc,
 * which can hold our own error details; resultCode is enough to explain a failure.
 */
function toPurchaseView(purchase: TokenPurchase) {
  return {
    id: purchase.id,
    tokens: purchase.tokens,
    amountKes: purchase.amountKes.toString(),
    phone: purchase.phone,
    status: purchase.status,
    resultCode: purchase.resultCode,
    mpesaReceiptNumber: purchase.mpesaReceiptNumber,
    createdAt: purchase.createdAt,
    completedAt: purchase.completedAt,
  };
}
