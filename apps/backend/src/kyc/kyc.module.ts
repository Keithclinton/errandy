import { Module } from "@nestjs/common";
import { KycService } from "./kyc.service";
import { KycController } from "./kyc.controller";
import { SmsModule } from "../sms/sms.module";
import { TokensModule } from "../tokens/tokens.module";

@Module({
  imports: [SmsModule, TokensModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
