import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { trackByAccount } from "../common/track-by-account";
import { KycService } from "./kyc.service";
import { IdVerificationService } from "./id-verification.service";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { SubmitIdVerificationDto } from "./dto/submit-id-verification.dto";

@ApiTags("kyc")
@ApiBearerAuth()
@Controller("kyc")
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly idVerificationService: IdVerificationService,
  ) {}

  @Post("phone/request-otp")
  requestOtp(@CurrentUser() user: AuthUser, @Body() dto: RequestOtpDto) {
    return this.kycService.requestOtp(user.id, dto.phone);
  }

  @Post("phone/verify-otp")
  verifyOtp(@CurrentUser() user: AuthUser, @Body() dto: VerifyOtpDto) {
    return this.kycService.verifyOtp(user.id, dto.phone, dto.code);
  }

  /** Photos of an ID document plus a selfie, for an admin to check. See body-parsers.ts for the size limit. */
  @Post("id-verification")
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000, getTracker: trackByAccount } })
  submitIdVerification(@CurrentUser() user: AuthUser, @Body() dto: SubmitIdVerificationDto) {
    return this.idVerificationService.submit(user.id, dto);
  }

  @Get("status")
  async status(@CurrentUser() user: AuthUser) {
    const [phone, idVerification] = await Promise.all([
      this.kycService.getStatus(user.id),
      this.idVerificationService.getOwnStatus(user.id),
    ]);
    return { ...phone, idVerification };
  }
}
