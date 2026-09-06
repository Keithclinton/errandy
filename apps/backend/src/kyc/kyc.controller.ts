import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { KycService } from "./kyc.service";
import { RequestOtpDto } from "./dto/request-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";

@ApiTags("kyc")
@ApiBearerAuth()
@Controller("kyc")
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post("phone/request-otp")
  requestOtp(@CurrentUser() user: AuthUser, @Body() dto: RequestOtpDto) {
    return this.kycService.requestOtp(user.id, dto.phone);
  }

  @Post("phone/verify-otp")
  verifyOtp(@CurrentUser() user: AuthUser, @Body() dto: VerifyOtpDto) {
    return this.kycService.verifyOtp(user.id, dto.phone, dto.code);
  }

  @Get("status")
  status(@CurrentUser() user: AuthUser) {
    return this.kycService.getStatus(user.id);
  }
}
