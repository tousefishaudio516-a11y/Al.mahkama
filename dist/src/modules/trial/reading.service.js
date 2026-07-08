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
exports.ReadingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const redis_service_1 = require("../../common/redis/redis.service");
const trial_service_1 = require("./trial.service");
let ReadingService = class ReadingService {
    constructor(prisma, redis, trialService) {
        this.prisma = prisma;
        this.redis = redis;
        this.trialService = trialService;
    }
    async markReady(roomCode, playerId) {
        await this.redis.markPlayerReady(roomCode, playerId);
        const room = await this.prisma.room.findUniqueOrThrow({
            where: { code: roomCode },
            include: { players: true },
        });
        const readyPlayers = await this.redis.getReadyPlayers(roomCode);
        const allReady = room.players.every((p) => readyPlayers.includes(p.id));
        if (allReady) {
            await this.trialService.startTrial(roomCode);
        }
        return { readyCount: readyPlayers.length, totalCount: room.players.length, allReady };
    }
    async initSingleDeviceReadingOrder(roomId) {
        const room = await this.prisma.room.findUniqueOrThrow({
            where: { id: roomId },
            include: { players: true },
        });
        const orderedIds = room.players.map((p) => p.id);
        await this.redis.setRoomState(room.code, {
            readingOrder: orderedIds,
            currentReadingIndex: 0,
        });
        return orderedIds[0];
    }
    async getCurrentTurn(roomCode) {
        const state = await this.redis.getRoomState(roomCode);
        if (!state)
            return null;
        return {
            currentPlayerId: state.readingOrder[state.currentReadingIndex] ?? null,
            index: state.currentReadingIndex,
            total: state.readingOrder.length,
        };
    }
    async closeFileAndAdvance(roomCode) {
        const state = await this.redis.getRoomState(roomCode);
        if (!state)
            throw new common_1.BadRequestException('لم تبدأ مرحلة القراءة بعد');
        const nextIndex = state.currentReadingIndex + 1;
        const isFinished = nextIndex >= state.readingOrder.length;
        await this.redis.setRoomState(roomCode, { ...state, currentReadingIndex: nextIndex });
        if (isFinished) {
            await this.trialService.startTrial(roomCode);
            return { finished: true, nextPlayerId: null };
        }
        return { finished: false, nextPlayerId: state.readingOrder[nextIndex] };
    }
};
exports.ReadingService = ReadingService;
exports.ReadingService = ReadingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService,
        trial_service_1.TrialService])
], ReadingService);
//# sourceMappingURL=reading.service.js.map