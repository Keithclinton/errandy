import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AdminGuard } from "../common/guards/admin.guard";
import { CurrentUser, AuthUser } from "../common/decorators/current-user.decorator";
import { AnalyticsService } from "./analytics.service";
import { IngestEventDto } from "./dto/ingest-event.dto";

@ApiTags("analytics")
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post("analytics/events")
  ingest(@CurrentUser() user: AuthUser, @Body() dto: IngestEventDto) {
    return this.analyticsService.record({ ...dto, userId: user.id });
  }

  @UseGuards(AdminGuard)
  @Get("admin/analytics/bids-per-month")
  bidsPerMonth() {
    return this.analyticsService.bidsPerMonth();
  }

  @UseGuards(AdminGuard)
  @Get("admin/analytics/top-categories")
  topCategories() {
    return this.analyticsService.topCategories();
  }

  @UseGuards(AdminGuard)
  @Get("admin/analytics/funnel")
  funnel() {
    return this.analyticsService.funnel();
  }

  @UseGuards(AdminGuard)
  @Get("admin/analytics/active-users")
  activeUsers() {
    return this.analyticsService.activeUsers();
  }

  @UseGuards(AdminGuard)
  @Get("admin/analytics/kyc-pass-rate")
  kycPassRate() {
    return this.analyticsService.kycPassRate();
  }
}
