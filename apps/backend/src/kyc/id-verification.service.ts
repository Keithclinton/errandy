import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { IdImageKind, KycStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  EVENTS,
  IdVerificationReviewedEvent,
  IdVerificationSubmittedEvent,
} from "../common/events/domain-events";
import { SubmitIdVerificationDto } from "./dto/submit-id-verification.dto";

export const MAX_ID_IMAGE_BYTES = 1_000_000;

const IMAGE_LABELS: Record<IdImageKind, string> = {
  front: "photo of the front of your ID",
  back: "photo of the back of your ID",
  selfie: "selfie",
};

const IMAGE_ORDER: IdImageKind[] = [IdImageKind.front, IdImageKind.back, IdImageKind.selfie];

function looksLike(contentType: string, data: Buffer): boolean {
  switch (contentType) {
    case "image/jpeg":
      return data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    case "image/png":
      return data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return data.length > 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
    default:
      return false;
  }
}

function decodeImage(kind: IdImageKind, dataUrl: string): { kind: IdImageKind; contentType: string; data: Buffer } {
  const label = IMAGE_LABELS[kind];
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new BadRequestException(`The ${label} must be a JPG, PNG or WebP image.`);
  const data = Buffer.from(match[2], "base64");
  if (data.length > MAX_ID_IMAGE_BYTES) {
    throw new BadRequestException(`The ${label} is too large. Use a photo under 1 MB.`);
  }
  if (!looksLike(match[1], data)) throw new BadRequestException(`The ${label} isn't a valid image.`);
  return { kind, contentType: match[1], data };
}

/** "12 345-678" and "12345678" are the same document number. */
export function normalizeIdNumber(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, "");
}

const REVIEW_SELECT = {
  id: true,
  documentType: true,
  fullName: true,
  idNumber: true,
  status: true,
  rejectionReason: true,
  consentAt: true,
  createdAt: true,
  reviewedAt: true,
  user: { select: { id: true, name: true, email: true, avatarUrl: true, idVerifiedAt: true } },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.IdVerificationSelect;

/**
 * ID checks, reviewed by hand in the admin panel until a KYC vendor is chosen. The photos
 * are stored only until the check is approved or rejected, then deleted.
 */
@Injectable()
export class IdVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** What a user sees about their own ID check. */
  async getOwnStatus(userId: string) {
    const [user, latest] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { idVerifiedAt: true } }),
      this.prisma.idVerification.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { status: true, documentType: true, rejectionReason: true, createdAt: true },
      }),
    ]);
    const status: KycStatus = user?.idVerifiedAt ? KycStatus.verified : (latest?.status ?? KycStatus.none);
    return {
      status,
      verifiedAt: user?.idVerifiedAt ?? null,
      documentType: latest?.documentType ?? null,
      submittedAt: latest?.createdAt ?? null,
      rejectionReason: status === KycStatus.rejected ? (latest?.rejectionReason ?? null) : null,
    };
  }

  async submit(userId: string, dto: SubmitIdVerificationDto) {
    const images = [decodeImage(IdImageKind.front, dto.images.front)];
    if (dto.documentType !== "passport") {
      if (!dto.images.back) throw new BadRequestException("Add a photo of the back of your ID.");
      images.push(decodeImage(IdImageKind.back, dto.images.back));
    }
    images.push(decodeImage(IdImageKind.selfie, dto.images.selfie));

    const verification = await this.prisma.$transaction(async (tx) => {
      // Locks the user's row so two submissions sent at once can't both pass the checks below.
      const [user] = await tx.$queryRaw<{ kycStatus: KycStatus; idVerifiedAt: Date | null }[]>`
        SELECT "kycStatus", "idVerifiedAt" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
      if (!user) throw new NotFoundException("User not found");
      if (user.kycStatus !== KycStatus.verified) {
        throw new ForbiddenException("Verify your phone number before your ID.");
      }
      if (user.idVerifiedAt) throw new ConflictException("Your ID is already verified.");
      const pending = await tx.idVerification.findFirst({
        where: { userId, status: KycStatus.pending },
        select: { id: true },
      });
      if (pending) throw new ConflictException("Your ID is already being reviewed.");
      return tx.idVerification.create({
        data: {
          userId,
          documentType: dto.documentType,
          fullName: dto.fullName.trim(),
          idNumber: normalizeIdNumber(dto.idNumber),
          consentAt: new Date(),
          images: { create: images },
        },
        select: { id: true },
      });
    });

    await this.events.emitAsync(EVENTS.ID_VERIFICATION_SUBMITTED, {
      verificationId: verification.id,
      userId,
    } satisfies IdVerificationSubmittedEvent);
    return this.getOwnStatus(userId);
  }

  listForReview(status: KycStatus = KycStatus.pending) {
    return this.prisma.idVerification.findMany({
      where: { status },
      // Pending checks oldest first, so whoever has waited longest gets reviewed first.
      orderBy: { createdAt: status === KycStatus.pending ? "asc" : "desc" },
      take: 100,
      select: REVIEW_SELECT,
    });
  }

  async getForReview(id: string) {
    const verification = await this.prisma.idVerification.findUnique({
      where: { id },
      select: { ...REVIEW_SELECT, images: { select: { kind: true, contentType: true, data: true } } },
    });
    if (!verification) throw new NotFoundException("ID check not found");

    // The same document number on another account is worth a closer look before approving.
    const sameIdNumber = await this.prisma.idVerification.findMany({
      where: { idNumber: verification.idNumber, id: { not: id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, status: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    });

    const { images, ...rest } = verification;
    return {
      ...rest,
      images: images
        .sort((a, b) => IMAGE_ORDER.indexOf(a.kind) - IMAGE_ORDER.indexOf(b.kind))
        .map((image) => ({
          kind: image.kind,
          dataUrl: `data:${image.contentType};base64,${Buffer.from(image.data).toString("base64")}`,
        })),
      sameIdNumber,
    };
  }

  async review(id: string, reviewerId: string, decision: "approve" | "reject", reason?: string) {
    const verification = await this.prisma.idVerification.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });
    if (!verification) throw new NotFoundException("ID check not found");
    if (verification.userId === reviewerId) {
      throw new ForbiddenException("Another admin has to review your own ID check.");
    }
    const approved = decision === "approve";
    const rejectionReason = approved ? null : reason?.trim();
    if (!approved && !rejectionReason) {
      throw new BadRequestException("Say why the ID check wasn't approved. The user will see this.");
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.idVerification.updateMany({
        where: { id, status: KycStatus.pending },
        data: {
          status: approved ? KycStatus.verified : KycStatus.rejected,
          rejectionReason,
          reviewedById: reviewerId,
          reviewedAt: now,
        },
      });
      if (count === 0) throw new ConflictException("This ID check has already been reviewed.");
      // The photos were only needed for this review.
      await tx.idVerificationImage.deleteMany({ where: { verificationId: id } });
      if (approved) {
        await tx.user.update({ where: { id: verification.userId }, data: { idVerifiedAt: now } });
      }
    });

    await this.events.emitAsync(EVENTS.ID_VERIFICATION_REVIEWED, {
      verificationId: id,
      userId: verification.userId,
      approved,
      reason: rejectionReason ?? null,
    } satisfies IdVerificationReviewedEvent);
    return this.getForReview(id);
  }
}
