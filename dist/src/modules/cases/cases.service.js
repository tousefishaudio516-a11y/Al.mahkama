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
exports.CasesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const case_bank_service_1 = require("./bank/case-bank.service");
const role_assignment_service_1 = require("../players/role-assignment.service");
const reading_service_1 = require("../trial/reading.service");
let CasesService = class CasesService {
    constructor(prisma, caseBank, roleAssignment, readingService) {
        this.prisma = prisma;
        this.caseBank = caseBank;
        this.roleAssignment = roleAssignment;
        this.readingService = readingService;
    }
    async generateCaseForRoom(roomId, requestingPlayerId) {
        const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
        if (requestingPlayerId) {
            const player = await this.prisma.roomPlayer.findUnique({ where: { id: requestingPlayerId } });
            if (!player || player.roomId !== roomId) {
                throw new common_1.ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
            }
        }
        await this.prisma.room.update({ where: { id: roomId }, data: { status: 'generating' } });
        const { groundTruth, dossiers, patternType, sourceTemplateId } = await this.caseBank.pickCaseForRoom(roomId);
        const createdCase = await this.prisma.case.create({
            data: {
                roomId,
                title: groundTruth.title,
                crimeType: groundTruth.crime_type,
                setting: groundTruth.setting,
                groundTruth: groundTruth,
                timeline: groundTruth.timeline,
                casePatternType: patternType,
                correctVerdict: groundTruth.correct_verdict,
                sourceTemplateId,
            },
        });
        const createdCharacters = await Promise.all(groundTruth.characters.map(async (character, index) => {
            const dossier = dossiers[index];
            return this.prisma.character.create({
                data: {
                    caseId: createdCase.id,
                    roleType: character.role_type,
                    roleName: character.role_name,
                    priorityOrder: character.priority_order,
                    dossier: dossier,
                    motiveCategory: (dossier?.motive_category ?? null),
                    isIntentionalConflict: dossier?.false_beliefs?.some((b) => b.is_intentional_conflict) ?? false,
                },
            });
        }));
        const realCulpritIndex = groundTruth.characters.findIndex((c) => c.is_real_culprit);
        const defendantIndex = groundTruth.characters.findIndex((c) => c.is_defendant);
        const realCulpritEntity = realCulpritIndex >= 0 ? createdCharacters[realCulpritIndex] : undefined;
        const defendantEntity = defendantIndex >= 0 ? createdCharacters[defendantIndex] : undefined;
        await this.prisma.case.update({
            where: { id: createdCase.id },
            data: {
                realCulpritCharacterId: realCulpritEntity?.id,
                defendantCharacterId: defendantEntity?.id,
            },
        });
        await Promise.all(groundTruth.characters.flatMap((_, index) => {
            const dossier = dossiers[index];
            const character = createdCharacters[index];
            if (!dossier || !character)
                return [];
            return (dossier.held_evidence ?? []).map((title) => this.prisma.evidence.create({
                data: {
                    caseId: createdCase.id,
                    ownerCharacterId: character.id,
                    title,
                    description: title,
                    isDecisive: groundTruth.decisive_evidence?.includes(title) ?? false,
                },
            }));
        }));
        await this.roleAssignment.assignRoles(roomId, createdCase.id);
        if (room.playMode === 'single_device') {
            await this.readingService.initSingleDeviceReadingOrder(roomId);
        }
        await this.prisma.room.update({ where: { id: roomId }, data: { status: 'reading' } });
        return {
            id: createdCase.id,
            title: createdCase.title,
            crimeType: createdCase.crimeType,
            setting: createdCase.setting,
            status: 'reading',
        };
    }
};
exports.CasesService = CasesService;
exports.CasesService = CasesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        case_bank_service_1.CaseBankService,
        role_assignment_service_1.RoleAssignmentService,
        reading_service_1.ReadingService])
], CasesService);
//# sourceMappingURL=cases.service.js.map