import { Module } from "@nestjs/common";
import { KycService } from "./kyc.service";
import { IdVerificationService } from "./id-verification.service";
import { KycController } from "./kyc.controller";
import { SmsModule } from "../sms/sms.module";
import { TokensModule } from "../tokens/tokens.module";

@Module({
  imports: [SmsModule, TokensModule],
  controllers: [KycController],
  providers: [KycService, IdVerificationService],
  exports: [KycService, IdVerificationService],
})
export class KycModule {}
