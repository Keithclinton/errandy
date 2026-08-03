import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsEventType, KycStatus } from "@prisma/client";

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  record(params: {
    type: AnalyticsEventType;
    entityType: string;
    entityId: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.analyticsEvent.create({
      data: {
        type: params.type,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        metadata: params.metadata as any,
      },
    });
  }

  async bidsPerMonth() {
    const rows = await this.prisma.$queryRaw<{ month: Date; count: bigint }[]>`
      SELECT date_trunc('month', "createdAt") AS month, COUNT(*) AS count
      FROM bids
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((r) => ({ month: r.month, count: Number(r.count) }));
  }

  async topCategories() {
    const grouped = await this.prisma.listing.groupBy({
      by: ["category"],
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
      take: 10,
    });
    return grouped.map((g) => ({ category: g.category, count: g._count._all }));
  }

  async funnel() {
    const [listingsCreated, listingsWithBids, listingsWithChat] = await Promise.all([
      this.prisma.listing.count(),
      this.prisma.bid.groupBy({ by: ["listingId"] }).then((r) => r.length),
      this.prisma.conversation.groupBy({ by: ["listingId"] }).then((r) => r.length),
    ]);
    return { listingsCreated, listingsWithBids, listingsWithChat };
  }

  async activeUsers(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.analyticsEvent.findMany({
      where: { createdAt: { gt: since }, userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    });
    return { activeUsers: events.length, windowDays: days };
  }

  async kycPassRate() {
    const [verified, decided] = await Promise.all([
      this.prisma.kycVerification.count({ where: { status: KycStatus.verified } }),
      this.prisma.kycVerification.count({ where: { status: { in: [KycStatus.verified, KycStatus.rejected] } } }),
    ]);
    return { verified, decided, passRate: decided > 0 ? verified / decided : null };
  }
}
