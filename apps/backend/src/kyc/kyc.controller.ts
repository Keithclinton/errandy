import { Body, Controller, Get, Headers, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { KycService } from "./kyc.service";
import { StartVerificationDto } from "./dto/start-verification.dto";
import { KycWebhookDto } from "./dto/kyc-webhook.dto";

@ApiTags("kyc")
@Controller("kyc")
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @ApiBearerAuth()
  @Post("start")
  start(@CurrentUser() user: AuthUser, @Body() dto: StartVerificationDto) {
    return this.kycService.startVerification(user.id, dto.consent);
  }

  @Public()
  @Post("webhook")
  webhook(
    @Body() dto: KycWebhookDto,
    @Headers("x-smile-signature") signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    return this.kycService.handleWebhook(dto, signature, req.rawBody ?? JSON.stringify(dto));
  }

  @ApiBearerAuth()
  @Get("status")
  status(@CurrentUser() user: AuthUser) {
    return this.kycService.getStatus(user.id);
  }
}
