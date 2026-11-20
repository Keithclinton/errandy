import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AccountBlocksModule } from "./account-blocks/account-blocks.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { KycModule } from "./kyc/kyc.module";
import { ListingsModule } from "./listings/listings.module";
import { BidsModule } from "./bids/bids.module";
import { ChatModule } from "./chat/chat.module";
import { RatingsModule } from "./ratings/ratings.module";
import { ReportsModule } from "./reports/reports.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { EmailModule } from "./email/email.module";
import { TokensModule } from "./tokens/tokens.module";
import { HealthModule } from "./health/health.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Requests per minute per IP. THROTTLE_LIMIT_PER_MINUTE exists so a load test, which comes
    // from one IP, can stand in for many users; leave it unset otherwise.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { ttl: 60_000, limit: Number(config.get("THROTTLE_LIMIT_PER_MINUTE")) || 100 },
      ],
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AccountBlocksModule,
    EmailModule,
    AuthModule,
    UsersModule,
    KycModule,
    ListingsModule,
    BidsModule,
    ChatModule,
    RatingsModule,
    ReportsModule,
    NotificationsModule,
    AdminModule,
    AnalyticsModule,
    TokensModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
