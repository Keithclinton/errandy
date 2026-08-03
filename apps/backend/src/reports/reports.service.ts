import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReportDto } from "./dto/create-report.dto";
import { EVENTS, ReportFiledEvent } from "../common/events/domain-events";

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(reporterId: string, dto: CreateReportDto) {
    const report = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details: dto.details,
      },
    });
    await this.events.emitAsync(EVENTS.REPORT_FILED, {
      reportId: report.id,
      reporterId,
      targetType: dto.targetType,
      targetId: dto.targetId,
    } satisfies ReportFiledEvent);
    return report;
  }
}
