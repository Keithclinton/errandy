import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
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
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    EventEmitterModule.forRoot(),
    PrismaModule,
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
