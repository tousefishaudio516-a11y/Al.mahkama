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
exports.PlayersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let PlayersService = class PlayersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMyCharacter(roomCode, playerId) {
        const room = await this.prisma.room.findUnique({ where: { code: roomCode } });
        if (!room)
            throw new common_1.NotFoundException('لم يتم العثور على الغرفة');
        const player = await this.prisma.roomPlayer.findUnique({
            where: { id: playerId },
            include: { character: true },
        });
        if (!player || player.roomId !== room.id) {
            throw new common_1.ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
        }
        if (!player.character) {
            return { assigned: false };
        }
        const evidences = await this.prisma.evidence.findMany({
            where: { ownerCharacterId: player.character.id },
            select: { id: true, title: true, description: true, isRevealed: true, isDecisive: true },
        });
        return {
            assigned: true,
            character: {
                id: player.character.id,
                roleType: player.character.roleType,
                roleName: player.character.roleName,
                dossier: player.character.dossier,
            },
            evidences,
        };
    }
    async getRoomPlayersPublic(roomCode) {
        const room = await this.prisma.room.findUnique({
            where: { code: roomCode },
            include: {
                players: {
                    include: {
                        character: { select: { roleType: true, roleName: true } },
                        user: { select: { displayName: true } },
                    },
                },
            },
        });
        if (!room)
            throw new common_1.NotFoundException('لم يتم العثور على الغرفة');
        return room.players.map((p) => ({
            id: p.id,
            displayName: p.user?.displayName ?? p.localName ?? 'لاعب',
            isReady: p.isReady,
            roleType: p.character?.roleType ?? null,
            roleName: p.character?.roleName ?? null,
        }));
    }
};
exports.PlayersService = PlayersService;
exports.PlayersService = PlayersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlayersService);
//# sourceMappingURL=players.service.js.map