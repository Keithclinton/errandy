import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { UsersModule } from "../users/users.module";
import { KycModule } from "../kyc/kyc.module";

@Module({
  imports: [UsersModule, KycModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
