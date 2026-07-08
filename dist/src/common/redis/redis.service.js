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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisService = class RedisService {
    constructor() {
        this.client = new ioredis_1.default(process.env.REDIS_URL ?? 'redis://localhost:6379');
    }
    onModuleDestroy() {
        this.client.disconnect();
    }
    async setRoomState(code, state) {
        await this.client.set(`room:${code}:state`, JSON.stringify(state));
    }
    async getRoomState(code) {
        const raw = await this.client.get(`room:${code}:state`);
        return raw ? JSON.parse(raw) : null;
    }
    async setTrialEndTimestamp(code, endsAtMs) {
        await this.client.set(`room:${code}:timer`, endsAtMs.toString());
    }
    async getTrialEndTimestamp(code) {
        const raw = await this.client.get(`room:${code}:timer`);
        return raw ? Number(raw) : null;
    }
    async markPlayerReady(code, playerId) {
        await this.client.sadd(`room:${code}:ready_players`, playerId);
    }
    async getReadyPlayers(code) {
        return this.client.smembers(`room:${code}:ready_players`);
    }
    async clearReadyPlayers(code) {
        await this.client.del(`room:${code}:ready_players`);
    }
    async bindSocket(code, playerId, socketId) {
        await this.client.hset(`room:${code}:sockets`, playerId, socketId);
        await this.client.set(`socket:${socketId}:player`, JSON.stringify({ code, playerId }));
    }
    async getSocketId(code, playerId) {
        return this.client.hget(`room:${code}:sockets`, playerId);
    }
    async getPlayerForSocket(socketId) {
        const raw = await this.client.get(`socket:${socketId}:player`);
        return raw ? JSON.parse(raw) : null;
    }
    async unbindSocket(socketId) {
        await this.client.del(`socket:${socketId}:player`);
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], RedisService);
//# sourceMappingURL=redis.service.js.map