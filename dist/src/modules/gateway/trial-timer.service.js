"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TrialTimerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrialTimerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const trial_service_1 = require("../trial/trial.service");
const rooms_gateway_1 = require("./rooms.gateway");
let TrialTimerService = TrialTimerService_1 = class TrialTimerService {
    constructor(prisma, trialService, gateway) {
        this.prisma = prisma;
        this.trialService = trialService;
        this.gateway = gateway;
        this.logger = new common_1.Logger(TrialTimerService_1.name);
    }
    async tick() {
        const activeRooms = await this.prisma.room.findMany({
            where: { status: 'trial' },
            select: { id: true, code: true },
        });
        for (const room of activeRooms) {
            try {
                const remaining = await this.trialService.getRemainingSeconds(room.code);
                this.gateway.server.to(room.code).emit('timer_update', { remaining });
                if (remaining <= 0) {
                    await this.trialService.endTrialByTimeout(room.id);
                    this.gateway.server.to(room.code).emit('trial_ended', { reason: 'timeout' });
                }
            }
            catch (err) {
                this.logger.error(`فشل تحديث المؤقّت للغرفة ${room.code}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }
};
exports.TrialTimerService = TrialTimerService;
__decorate([
    (0, schedule_1.Interval)(3000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TrialTimerService.prototype, "tick", null);
exports.TrialTimerService = TrialTimerService = TrialTimerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        trial_service_1.TrialService,
        rooms_gateway_1.RoomsGateway])
], TrialTimerService);
//# sourceMappingURL=trial-timer.service.js.map