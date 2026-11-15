import { Body, Controller, Delete, Get, Header, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminGuard } from "../common/guards/admin.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { AdminService } from "./admin.service";
import { IdVerificationService } from "../kyc/id-verification.service";
import { QueryUsersDto } from "./dto/query-users.dto";
import { ResolveReportDto } from "./dto/resolve-report.dto";
import { SetKycStatusDto } from "./dto/set-kyc-status.dto";
import { SetAdminAccessDto } from "./dto/set-admin-access.dto";
import { QueryIdVerificationsDto, ReviewIdVerificationDto } from "./dto/review-id-verification.dto";
import { KycStatus, ReportStatus } from "@prisma/client";

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly idVerificationService: IdVerificationService,
  ) {}

  @Get("users")
  searchUsers(@Query() query: QueryUsersDto) {
    return this.adminService.searchUsers(query);
  }

  @Get("users/:id")
  getUserDetail(@Param("id") id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch("users/:id/suspend")
  suspendUser(@CurrentUser() admin: AuthUser, @Param("id") id: string) {
    return this.adminService.suspendUser(admin, id);
  }

  @Patch("users/:id/reinstate")
  reinstateUser(@CurrentUser() admin: AuthUser, @Param("id") id: string) {
    return this.adminService.reinstateUser(admin, id);
  }

  @Patch("users/:id/admin")
  @UseGuards(SuperAdminGuard)
  setAdminAccess(@CurrentUser() admin: AuthUser, @Param("id") id: string, @Body() dto: SetAdminAccessDto) {
    return this.adminService.setAdminAccess(admin, id, dto.isAdmin);
  }

  @Patch("users/:id/kyc")
  setUserKycStatus(@CurrentUser() admin: AuthUser, @Param("id") id: string, @Body() dto: SetKycStatusDto) {
    return this.adminService.setUserKycStatus(id, admin.id, dto);
  }

  @Delete("users/:id")
  deleteUser(@CurrentUser() admin: AuthUser, @Param("id") id: string) {
    return this.adminService.deleteUser(admin, id);
  }

  @Get("id-verifications")
  listIdVerifications(@Query() query: QueryIdVerificationsDto) {
    return this.idVerificationService.listForReview(query.status ?? KycStatus.pending);
  }

  // Carries ID photos, so it must never be cached anywhere.
  @Get("id-verifications/:id")
  @Header("Cache-Control", "no-store")
  getIdVerification(@Param("id") id: string) {
    return this.idVerificationService.getForReview(id);
  }

  @Patch("id-verifications/:id")
  @Header("Cache-Control", "no-store")
  reviewIdVerification(@CurrentUser() admin: AuthUser, @Param("id") id: string, @Body() dto: ReviewIdVerificationDto) {
    return this.idVerificationService.review(id, admin.id, dto.decision, dto.reason);
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
