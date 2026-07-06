"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const throttler_1 = require("@nestjs/throttler");
const prisma_module_1 = require("./common/prisma/prisma.module");
const redis_module_1 = require("./common/redis/redis.module");
const rooms_module_1 = require("./modules/rooms/rooms.module");
const players_module_1 = require("./modules/players/players.module");
const cases_module_1 = require("./modules/cases/cases.module");
const trial_module_1 = require("./modules/trial/trial.module");
const verdict_module_1 = require("./modules/verdict/verdict.module");
const scoring_module_1 = require("./modules/scoring/scoring.module");
const gateway_module_1 = require("./modules/gateway/gateway.module");
const cleanup_module_1 = require("./modules/cleanup/cleanup.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60_000,
                    limit: 60,
                },
            ]),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            rooms_module_1.RoomsModule,
            players_module_1.PlayersModule,
            cases_module_1.CasesModule,
            trial_module_1.TrialModule,
            verdict_module_1.VerdictModule,
            scoring_module_1.ScoringModule,
            gateway_module_1.GatewayModule,
            cleanup_module_1.CleanupModule,
        ],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map