import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SmileIdService } from "./smile-id.service";
import { KycStatus } from "@prisma/client";
import { KycWebhookDto } from "./dto/kyc-webhook.dto";

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smileIdService: SmileIdService,
  ) {}

  async startVerification(userId: string, consent: boolean) {
    if (!consent) {
      throw new BadRequestException("Explicit KYC consent is required before verification can start");
    }
    const { jobId, token, partnerId } = await this.smileIdService.generateWebToken(userId);
    const verification = await this.prisma.kycVerification.create({
      data: { userId, smileJobId: jobId, status: KycStatus.pending, consentAt: new Date() },
    });
    await this.prisma.user.update({ where: { id: userId }, data: { kycStatus: KycStatus.pending } });
    return { ...verification, token, partnerId };
  }

  async handleWebhook(dto: KycWebhookDto, timestamp: string | undefined, signature: string | undefined) {
    if (!this.smileIdService.verifyWebhookSignature(timestamp, signature)) {
      throw new UnauthorizedException("Invalid webhook signature");
    }
    const jobId = dto.partner_params?.job_id;
    const verification = await this.prisma.kycVerification.findFirst({
      where: jobId ? { smileJobId: jobId } : undefined,
      orderBy: { createdAt: "desc" },
    });
    if (!verification) {
      throw new NotFoundException("No matching KYC verification for this job");
    }
    // Smile ID's v3 status is one of clear | attention | block | error — only a
    // clean "clear" result counts as verified; anything else needs a human to
    // look at it (the admin manual override exists for exactly this).
    const status = dto.status === "clear" ? KycStatus.verified : KycStatus.rejected;
    await this.prisma.kycVerification.update({
      where: { id: verification.id },
      data: { status, result: dto as any, reviewedAt: new Date() },
    });
    await this.prisma.user.update({ where: { id: verification.userId }, data: { kycStatus: status } });
    return { ok: true };
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const latest = await this.prisma.kycVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return { kycStatus: user?.kycStatus ?? KycStatus.none, latestVerification: latest };
  }
}
