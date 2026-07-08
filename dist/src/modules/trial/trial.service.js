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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrialService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const redis_service_1 = require("../../common/redis/redis.service");
const TRIAL_DURATION_SECONDS_DEFAULT = 1200;
let TrialService = class TrialService {
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    async startTrial(roomCode) {
        const room = await this.prisma.room.findUniqueOrThrow({ where: { code: roomCode } });
        const durationSeconds = room.trialDurationSeconds ?? TRIAL_DURATION_SECONDS_DEFAULT;
        const endsAt = Date.now() + durationSeconds * 1000;
        await this.redis.setTrialEndTimestamp(roomCode, endsAt);
        await this.redis.clearReadyPlayers(roomCode);
        await this.prisma.room.update({
            where: { id: room.id },
            data: { status: 'trial', trialStartedAt: new Date() },
        });
        await this.logSystemEvent(room.id, 'بدأت المحاكمة. لديكم 20 دقيقة للتحقيق والمرافعة.');
        return { endsAt };
    }
    async getRemainingSeconds(roomCode) {
        const endsAt = await this.redis.getTrialEndTimestamp(roomCode);
        if (!endsAt)
            return 0;
        return Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
    }
    async assertPlayerInRoom(roomId, playerId) {
        const player = await this.prisma.roomPlayer.findUnique({ where: { id: playerId } });
        if (!player || player.roomId !== roomId) {
            throw new common_1.ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
        }
    }
    async recordEvent(roomId, dto) {
        if (dto.actorPlayerId) {
            await this.assertPlayerInRoom(roomId, dto.actorPlayerId);
        }
        return this.prisma.trialEvent.create({
            data: {
                roomId,
                actorPlayerId: dto.actorPlayerId,
                eventType: dto.eventType,
                content: dto.content,
                metadata: dto.metadata,
            },
        });
    }
    async revealEvidence(roomId, evidenceId, actorPlayerId) {
        await this.assertPlayerInRoom(roomId, actorPlayerId);
        const evidence = await this.prisma.evidence.findUniqueOrThrow({ where: { id: evidenceId } });
        const updated = await this.prisma.evidence.update({
            where: { id: evidenceId },
            data: { isRevealed: true, revealedAt: new Date() },
        });
        await this.recordEvent(roomId, {
            actorPlayerId,
            eventType: 'evidence_reveal',
            content: evidence.title,
            metadata: { evidenceId },
        });
        return updated;
    }
    async endTrialEarly(roomId, requestingPlayerId) {
        const player = await this.prisma.roomPlayer.findUniqueOrThrow({
            where: { id: requestingPlayerId },
            include: { character: true },
        });
        if (player.roomId !== roomId) {
            throw new common_1.ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
        }
        if (player.character?.roleType !== 'judge') {
            throw new common_1.ForbiddenException('فقط القاضي يمكنه إنهاء المحاكمة مبكرًا');
        }
        const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
        if (room.status !== 'trial') {
            throw new common_1.BadRequestException('المحاكمة ليست جارية حاليًا');
        }
        await this.redis.setTrialEndTimestamp(room.code, Date.now());
        await this.prisma.room.update({ where: { id: roomId }, data: { status: 'verdict' } });
        await this.logSystemEvent(roomId, 'أنهى القاضي المحاكمة مبكرًا.');
        return { ended: true };
    }
    async endTrialByTimeout(roomId) {
        await this.prisma.room.update({ where: { id: roomId }, data: { status: 'verdict' } });
        await this.logSystemEvent(roomId, 'انتهى وقت المحاكمة (20 دقيقة).');
    }
    async logSystemEvent(roomId, content) {
        return this.prisma.trialEvent.create({
            data: { roomId, eventType: 'system', content },
        });
    }
};
exports.TrialService = TrialService;
exports.TrialService = TrialService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], TrialService);
//# sourceMappingURL=trial.service.js.map