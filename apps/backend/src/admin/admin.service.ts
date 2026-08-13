import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { ListingStatus, Prisma, ReportStatus, UserStatus } from "@prisma/client";
import { QueryUsersDto } from "./dto/query-users.dto";
import { ResolveReportDto } from "./dto/resolve-report.dto";
import { SetKycStatusDto } from "./dto/set-kyc-status.dto";
import { EVENTS, ReportResolvedEvent } from "../common/events/domain-events";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async searchUsers(query: QueryUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.UserWhereInput = query.search
      ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          kycStatus: true,
          status: true,
          isAdmin: true,
          ratingAvg: true,
          ratingCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        listings: true,
        bids: true,
        kycVerifications: true,
        reportsFiled: true,
      },
    });
    if (!user) throw new NotFoundException("User not found");
    const { passwordHash, refreshTokenHash, passwordResetTokenHash, ...safe } = user;
    return safe;
  }

  async suspendUser(userId: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.suspended } });
    const { passwordHash, refreshTokenHash, passwordResetTokenHash, ...safe } = user;
    return safe;
  }

  async reinstateUser(userId: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.active } });
    const { passwordHash, refreshTokenHash, passwordResetTokenHash, ...safe } = user;
    return safe;
  }

  /**
   * Manual override for a user's KYC status, bypassing Smile ID entirely — for use
   * while the real verification provider isn't configured yet (or for one-off support
   * cases later). Still leaves an audit trail via a KycVerification row so it shows up
   * the same way a real verification would in the user's history.
   */
  async setUserKycStatus(userId: string, adminId: string, dto: SetKycStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    await this.prisma.kycVerification.create({
      data: {
        userId,
        status: dto.status,
        consentAt: new Date(),
        reviewedAt: new Date(),
        result: { manualOverride: true, reviewedBy: adminId },
      },
    });
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { kycStatus: dto.status } });
    const { passwordHash, refreshTokenHash, passwordResetTokenHash, ...safe } = updated;
    return safe;
  }

  async listReports(status?: ReportStatus) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async resolveReport(reportId: string, adminId: string, dto: ResolveReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException("Report not found");
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { status: dto.status as ReportStatus, reviewedBy: adminId },
    });
    if (dto.status === "actioned" || dto.status === "dismissed") {
      await this.events.emitAsync(EVENTS.REPORT_RESOLVED, {
        reportId,
        reporterId: report.reporterId,
        status: dto.status,
      } satisfies ReportResolvedEvent);
    }
    return updated;
  }

  async takedownListing(listingId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException("Listing not found");
    return this.prisma.listing.update({ where: { id: listingId }, data: { status: ListingStatus.closed } });
  }
}
