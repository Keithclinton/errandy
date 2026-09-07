import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { createHash, randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SmsService } from "../sms/sms.service";
import { TokensService } from "../tokens/tokens.service";
import { KycStatus } from "@prisma/client";
import { normalizeKenyanPhone } from "../common/phone";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smsService: SmsService,
    private readonly tokensService: TokensService,
  ) {}

  private hash(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  async requestOtp(userId: string, rawPhone: string): Promise<{ phone: string }> {
    const phone = normalizeKenyanPhone(rawPhone);

    const claimedBy = await this.prisma.user.findUnique({ where: { phone } });
    if (claimedBy && claimedBy.id !== userId) {
      throw new ConflictException("This phone number is already linked to another account");
    }

    const recent = await this.prisma.phoneOtp.findFirst({
      where: { userId, createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      throw new BadRequestException("Please wait a minute before requesting another code");
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.prisma.phoneOtp.create({
      data: {
        userId,
        phone,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.smsService.sendOtp(phone, code);
    return { phone };
  }

  async verifyOtp(userId: string, rawPhone: string, code: string): Promise<{ kycStatus: KycStatus }> {
    const phone = normalizeKenyanPhone(rawPhone);

    const otp = await this.prisma.phoneOtp.findFirst({
      where: { userId, phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException("That code has expired — request a new one");
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException("Too many incorrect attempts — request a new code");
    }
    if (otp.codeHash !== this.hash(code)) {
      await this.prisma.phoneOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException("Incorrect code");
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.phoneOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
        await tx.user.update({ where: { id: userId }, data: { phone, kycStatus: KycStatus.verified } });
        await tx.kycVerification.create({
          data: {
            userId,
            status: KycStatus.verified,
            consentAt: new Date(),
            reviewedAt: new Date(),
            result: { method: "phone_otp", phone },
          },
        });
        await this.tokensService.grantSignupBonusIfEligible(tx, userId);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("This phone number is already linked to another account");
      }
      throw err;
    }

    return { kycStatus: KycStatus.verified };
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
