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
var RoleAssignmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleAssignmentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let RoleAssignmentService = RoleAssignmentService_1 = class RoleAssignmentService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(RoleAssignmentService_1.name);
    }
    async assignRoles(roomId, caseId) {
        const room = await this.prisma.room.findUniqueOrThrow({
            where: { id: roomId },
            include: { players: true },
        });
        const characters = await this.prisma.character.findMany({
            where: { caseId },
            orderBy: { priorityOrder: 'asc' },
        });
        const playerCount = room.players.length;
        const activeCharacters = playerCount < 5
            ? this.pickReducedRoleSet(characters, playerCount)
            : characters.slice(0, playerCount);
        if (activeCharacters.length < playerCount) {
            this.logger.error(`عدد الشخصيات المتاحة (${activeCharacters.length}) أقل من عدد اللاعبين (${playerCount}) للغرفة ${roomId}`);
            throw new common_1.InternalServerErrorException('تعذّر توزيع الأدوار: عدد الشخصيات المولّدة للقضية أقل من عدد اللاعبين في الغرفة.');
        }
        const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
        const assignments = shuffledPlayers.map((player, index) => ({
            playerId: player.id,
            characterId: activeCharacters[index].id,
        }));
        await Promise.all(assignments.map((a) => this.prisma.roomPlayer.update({
            where: { id: a.playerId },
            data: { characterId: a.characterId },
        })));
        return assignments;
    }
    pickReducedRoleSet(characters, playerCount) {
        const byRole = (role) => characters.find((c) => c.roleType === role);
        const judge = byRole('judge');
        const defendant = byRole('defendant');
        const witness = byRole('witness_main');
        const prosecutorOrDefense = byRole('prosecutor') ?? byRole('defense');
        const base = [judge, defendant, witness].filter(Boolean);
        if (playerCount === 3)
            return base;
        if (playerCount === 4)
            return [...base, prosecutorOrDefense].filter(Boolean);
        return characters.slice(0, playerCount);
    }
};
exports.RoleAssignmentService = RoleAssignmentService;
exports.RoleAssignmentService = RoleAssignmentService = RoleAssignmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RoleAssignmentService);
//# sourceMappingURL=role-assignment.service.js.map