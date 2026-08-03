import { Module } from "@nestjs/common";
import { KycService } from "./kyc.service";
import { KycController } from "./kyc.controller";
import { SmileIdService } from "./smile-id.service";

@Module({
  controllers: [KycController],
  providers: [KycService, SmileIdService],
  exports: [KycService],
})
export class KycModule {}
