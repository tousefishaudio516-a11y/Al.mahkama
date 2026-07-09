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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var RoomsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const socket_io_1 = require("socket.io");
const redis_service_1 = require("../../common/redis/redis.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const trial_service_1 = require("../trial/trial.service");
const reading_service_1 = require("../trial/reading.service");
let RoomsGateway = RoomsGateway_1 = class RoomsGateway {
    constructor(redis, prisma, trialService, readingService) {
        this.redis = redis;
        this.prisma = prisma;
        this.trialService = trialService;
        this.readingService = readingService;
        this.logger = new common_1.Logger(RoomsGateway_1.name);
    }
    handleConnection(client) {
    }
    async handleDisconnect(client) {
        await this.redis.unbindSocket(client.id);
    }
    async assertPlayerBelongsToRoom(roomCode, playerId) {
        const player = await this.prisma.roomPlayer.findUnique({
            where: { id: playerId },
            include: { room: true },
        });
        return !!player && player.room.code === roomCode;
    }
    async getVerifiedPlayerId(client, roomCode, claimedPlayerId) {
        const bound = await this.redis.getPlayerForSocket(client.id);
        if (!bound || bound.code !== roomCode) {
            this.logger.warn(`Socket ${client.id} حاول إرسال حدث لغرفة ${roomCode} بلا join_room مسبق`);
            return null;
        }
        if (bound.playerId !== claimedPlayerId) {
            this.logger.warn(`Socket ${client.id} حاول انتحال هوية اللاعب ${claimedPlayerId} بينما هو مرتبط فعليًا بـ ${bound.playerId}`);
            return null;
        }
        return bound.playerId;
    }
    errMsg(err) {
        return err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
    }
    async onJoinRoom(client, data) {
        const belongs = await this.assertPlayerBelongsToRoom(data.roomCode, data.playerId);
        if (!belongs) {
            return { ok: false, error: 'لا يمكن الانضمام: هوية لاعب غير صالحة لهذه الغرفة' };
        }
        await client.join(data.roomCode);
        await this.redis.bindSocket(data.roomCode, data.playerId, client.id);
        this.server.to(data.roomCode).emit('player_joined', { playerId: data.playerId });
        return { ok: true, data: { joined: true } };
    }
    async onMarkReady(client, data) {
        const playerId = await this.getVerifiedPlayerId(client, data.roomCode, data.playerId);
        if (!playerId)
            return { ok: false, error: 'لم يتم التحقق من هويتك في هذه الغرفة بعد' };
        try {
            const result = await this.readingService.markReady(data.roomCode, playerId);
            this.server.to(data.roomCode).emit('ready_update', result);
            if (result.allReady) {
                this.server.to(data.roomCode).emit('trial_started', { durationSeconds: 1200 });
            }
            return { ok: true, data: { ended: true } };
        }
        catch (err) {
            return { ok: false, error: this.errMsg(err) };
        }
    }
    async onCloseFile(client, data) {
        try {
            const result = await this.readingService.closeFileAndAdvance(data.roomCode);
            if (result.finished) {
                this.server.to(data.roomCode).emit('trial_started', { durationSeconds: 1200 });
            }
            else {
                this.server.to(data.roomCode).emit('advance_to_next_local_player', {
                    nextPlayerId: result.nextPlayerId,
                });
            }
            return { ok: true, data: { ended: true } };
        }
        catch (err) {
            return { ok: false, error: this.errMsg(err) };
        }
    }
    async onTrialEvent(client, data) {
        const playerId = await this.getVerifiedPlayerId(client, data.roomCode, data.event?.actorPlayerId);
        if (!playerId)
            return { ok: false, error: 'لم يتم التحقق من هويتك في هذه الغرفة بعد' };
        try {
            const event = await this.trialService.recordEvent(data.roomId, { ...data.event, actorPlayerId: playerId });
            this.server.to(data.roomCode).emit('trial_event_broadcast', event);
            return { ok: true, data: event };
        }
        catch (err) {
            return { ok: false, error: this.errMsg(err) };
        }
    }
    async onRevealEvidence(client, data) {
        const playerId = await this.getVerifiedPlayerId(client, data.roomCode, data.actorPlayerId);
        if (!playerId)
            return { ok: false, error: 'لم يتم التحقق من هويتك في هذه الغرفة بعد' };
        try {
            const evidence = await this.trialService.revealEvidence(data.roomId, data.evidenceId, playerId);
            this.server.to(data.roomCode).emit('evidence_revealed', evidence);
            return { ok: true, data: evidence };
        }
        catch (err) {
            return { ok: false, error: this.errMsg(err) };
        }
    }
    async onEndTrialEarly(client, data) {
        const playerId = await this.getVerifiedPlayerId(client, data.roomCode, data.judgePlayerId);
        if (!playerId)
            return { ok: false, error: 'لم يتم التحقق من هويتك في هذه الغرفة بعد' };
        try {
            const result = await this.trialService.endTrialEarly(data.roomId, playerId);
            this.server.to(data.roomCode).emit('trial_ended', { reason: 'judge' });
            return { ok: true, data: { ended: true } };
        }
        catch (err) {
            return { ok: false, error: this.errMsg(err) };
        }
    }
};
exports.RoomsGateway = RoomsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RoomsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join_room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomsGateway.prototype, "onJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('mark_ready'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomsGateway.prototype, "onMarkReady", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('close_file'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomsGateway.prototype, "onCloseFile", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('trial_event'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomsGateway.prototype, "onTrialEvent", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('reveal_evidence'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomsGateway.prototype, "onRevealEvidence", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('end_trial_early'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomsGateway.prototype, "onEndTrialEarly", null);
exports.RoomsGateway = RoomsGateway = RoomsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? false, credentials: true },
        namespace: '/rooms',
    }),
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        prisma_service_1.PrismaService,
        trial_service_1.TrialService,
        reading_service_1.ReadingService])
], RoomsGateway);
//# sourceMappingURL=rooms.gateway.js.map