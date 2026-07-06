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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrialController = void 0;
const common_1 = require("@nestjs/common");
const trial_service_1 = require("./trial.service");
const reading_service_1 = require("./reading.service");
const create_trial_event_dto_1 = require("./dto/create-trial-event.dto");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let TrialController = class TrialController {
    constructor(trialService, readingService, prisma) {
        this.trialService = trialService;
        this.readingService = readingService;
        this.prisma = prisma;
    }
    async resolveRoomId(roomCode) {
        const room = await this.prisma.room.findUniqueOrThrow({ where: { code: roomCode } });
        return room.id;
    }
    markReady(roomCode, playerId) {
        return this.readingService.markReady(roomCode, playerId);
    }
    getCurrentTurn(roomCode) {
        return this.readingService.getCurrentTurn(roomCode);
    }
    closeFile(roomCode) {
        return this.readingService.closeFileAndAdvance(roomCode);
    }
    remaining(roomCode) {
        return this.trialService.getRemainingSeconds(roomCode);
    }
    async recordEvent(roomCode, dto) {
        const roomId = await this.resolveRoomId(roomCode);
        return this.trialService.recordEvent(roomId, dto);
    }
    async revealEvidence(roomCode, evidenceId, actorPlayerId) {
        const roomId = await this.resolveRoomId(roomCode);
        return this.trialService.revealEvidence(roomId, evidenceId, actorPlayerId);
    }
    async endEarly(roomCode, judgePlayerId) {
        const roomId = await this.resolveRoomId(roomCode);
        return this.trialService.endTrialEarly(roomId, judgePlayerId);
    }
};
exports.TrialController = TrialController;
__decorate([
    (0, common_1.Post)('ready'),
    __param(0, (0, common_1.Param)('roomCode')),
    __param(1, (0, common_1.Body)('playerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TrialController.prototype, "markReady", null);
__decorate([
    (0, common_1.Get)('reading/current-turn'),
    __param(0, (0, common_1.Param)('roomCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TrialController.prototype, "getCurrentTurn", null);
__decorate([
    (0, common_1.Post)('reading/close-file'),
    __param(0, (0, common_1.Param)('roomCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TrialController.prototype, "closeFile", null);
__decorate([
    (0, common_1.Get)('trial/remaining'),
    __param(0, (0, common_1.Param)('roomCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TrialController.prototype, "remaining", null);
__decorate([
    (0, common_1.Post)('trial/events'),
    __param(0, (0, common_1.Param)('roomCode')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_trial_event_dto_1.CreateTrialEventDto]),
    __metadata("design:returntype", Promise)
], TrialController.prototype, "recordEvent", null);
__decorate([
    (0, common_1.Post)('trial/evidence/:evidenceId/reveal'),
    __param(0, (0, common_1.Param)('roomCode')),
    __param(1, (0, common_1.Param)('evidenceId')),
    __param(2, (0, common_1.Body)('actorPlayerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], TrialController.prototype, "revealEvidence", null);
__decorate([
    (0, common_1.Post)('trial/end-early'),
    __param(0, (0, common_1.Param)('roomCode')),
    __param(1, (0, common_1.Body)('judgePlayerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TrialController.prototype, "endEarly", null);
exports.TrialController = TrialController = __decorate([
    (0, common_1.Controller)('rooms/:roomCode'),
    __metadata("design:paramtypes", [trial_service_1.TrialService,
        reading_service_1.ReadingService,
        prisma_service_1.PrismaService])
], TrialController);
//# sourceMappingURL=trial.controller.js.map