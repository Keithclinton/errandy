import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../common/guards/admin.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { AdminService } from "./admin.service";
import { QueryUsersDto } from "./dto/query-users.dto";
import { ResolveReportDto } from "./dto/resolve-report.dto";
import { SetKycStatusDto } from "./dto/set-kyc-status.dto";
import { ReportStatus } from "@prisma/client";

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  searchUsers(@Query() query: QueryUsersDto) {
    return this.adminService.searchUsers(query);
  }

  @Get("users/:id")
  getUserDetail(@Param("id") id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch("users/:id/suspend")
  suspendUser(@Param("id") id: string) {
    return this.adminService.suspendUser(id);
  }

  @Patch("users/:id/reinstate")
  reinstateUser(@Param("id") id: string) {
    return this.adminService.reinstateUser(id);
  }

  @Patch("users/:id/kyc")
  setUserKycStatus(@CurrentUser() admin: AuthUser, @Param("id") id: string, @Body() dto: SetKycStatusDto) {
    return this.adminService.setUserKycStatus(id, admin.id, dto);
  }

  @Get("reports")
  listReports(@Query("status") status?: ReportStatus) {
    return this.adminService.listReports(status);
  }

  @Patch("reports/:id")
  resolveReport(@CurrentUser() admin: AuthUser, @Param("id") id: string, @Body() dto: ResolveReportDto) {
    return this.adminService.resolveReport(id, admin.id, dto);
  }

  @Patch("listings/:id/takedown")
  takedownListing(@Param("id") id: string) {
    return this.adminService.takedownListing(id);
  }
}
