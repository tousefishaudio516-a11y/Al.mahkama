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
var CleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let CleanupService = CleanupService_1 = class CleanupService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(CleanupService_1.name);
    }
    async cleanupAbandonedLobbies() {
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const abandoned = await this.prisma.room.findMany({
            where: { status: 'lobby', createdAt: { lt: sixHoursAgo } },
            select: { id: true, code: true },
        });
        if (abandoned.length === 0)
            return;
        await this.deleteRoomsCascade(abandoned.map((r) => r.id));
        this.logger.log(`تم حذف ${abandoned.length} غرفة مهجورة في الـ lobby (أقدم من 6 ساعات)`);
    }
    async cleanupFinishedRooms() {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const finished = await this.prisma.room.findMany({
            where: {
                OR: [
                    { status: 'ended', createdAt: { lt: fortyEightHoursAgo } },
                    { status: 'reveal', createdAt: { lt: fortyEightHoursAgo } },
                ],
            },
            select: { id: true },
        });
        if (finished.length === 0)
            return;
        await this.deleteRoomsCascade(finished.map((r) => r.id));
        this.logger.log(`تم حذف ${finished.length} غرفة منتهية (أقدم من 48 ساعة)`);
    }
    async deleteRoomsCascade(roomIds) {
        if (roomIds.length === 0)
            return;
        const cases = await this.prisma.case.findMany({
            where: { roomId: { in: roomIds } },
            select: { id: true },
        });
        const caseIds = cases.map((c) => c.id);
        await this.prisma.$transaction([
            this.prisma.roundScore.deleteMany({ where: { roomId: { in: roomIds } } }),
            this.prisma.verdict.deleteMany({ where: { roomId: { in: roomIds } } }),
            this.prisma.trialEvent.deleteMany({ where: { roomId: { in: roomIds } } }),
            this.prisma.roomPlayer.updateMany({
                where: { roomId: { in: roomIds } },
                data: { characterId: null },
            }),
            this.prisma.evidence.deleteMany({ where: { caseId: { in: caseIds } } }),
            this.prisma.character.deleteMany({ where: { caseId: { in: caseIds } } }),
            this.prisma.case.deleteMany({ where: { id: { in: caseIds } } }),
            this.prisma.roomPlayer.deleteMany({ where: { roomId: { in: roomIds } } }),
            this.prisma.room.deleteMany({ where: { id: { in: roomIds } } }),
        ]);
    }
};
exports.CleanupService = CleanupService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CleanupService.prototype, "cleanupAbandonedLobbies", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_3AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CleanupService.prototype, "cleanupFinishedRooms", null);
exports.CleanupService = CleanupService = CleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CleanupService);
//# sourceMappingURL=cleanup.service.js.map