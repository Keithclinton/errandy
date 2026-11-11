import { Module } from "@nestjs/common";
import { TokensService } from "./tokens.service";
import { PaymentsCronController, TokensController } from "./tokens.controller";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [PaymentsModule],
  controllers: [TokensController, PaymentsCronController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
