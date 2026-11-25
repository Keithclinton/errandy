import { Controller, Get, Header, Query, ServiceUnavailableException } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Used by deploys (to confirm the new version is the one answering) and by uptime checks.
 * The database is only queried with ?db=1. The watchdog leaves it out: it restarts the app when
 * the app stops answering, which wouldn't help if the database were the problem.
 */
@ApiExcludeController()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  @Header("Cache-Control", "no-store")
  async check(@Query("db") db?: string) {
    const release = process.env.RELEASE_ID ?? "dev";
    if (db !== "1") return { status: "ok", release };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: "error", release, database: "unreachable" });
    }
    return { status: "ok", release, database: "ok" };
  }
}
