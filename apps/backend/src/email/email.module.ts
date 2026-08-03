import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { EmailController } from "./email.controller";
import { BidEmailListener } from "./bid-email.listener";

@Module({
  controllers: [EmailController],
  providers: [EmailService, BidEmailListener],
  exports: [EmailService],
})
export class EmailModule {}
