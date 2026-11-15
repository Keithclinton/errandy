import { Global, Module } from "@nestjs/common";
import { AccountBlocksService } from "./account-blocks.service";

// Global because sign-up (auth), phone verification (kyc) and account deletion (users)
// all need it.
@Global()
@Module({
  providers: [AccountBlocksService],
  exports: [AccountBlocksService],
})
export class AccountBlocksModule {}
