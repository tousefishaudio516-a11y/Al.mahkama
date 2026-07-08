import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { PlayersModule } from './modules/players/players.module';
import { CasesModule } from './modules/cases/cases.module';
import { TrialModule } from './modules/trial/trial.module';
import { VerdictModule } from './modules/verdict/verdict.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { CleanupModule } from './modules/cleanup/cleanup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting عام على كل REST endpoints: كان غائبًا تمامًا سابقًا، ما يسمح
    // بإنشاء آلاف الغرف أو استدعاء توليد القضية (وهو الأغلى تكلفة، عدة نداءات Claude
    // لكل استدعاء) بلا أي حد. الحد هنا عام ومحافظ؛ نقاط النهاية الأغلى (توليد القضية)
    // يمكن تشديدها أكثر لاحقًا عبر @Throttle على مستوى الـ Controller عند الحاجة.
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    RoomsModule,
    PlayersModule,
    CasesModule,
    TrialModule,
    VerdictModule,
    ScoringModule,
    GatewayModule,
    CleanupModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
