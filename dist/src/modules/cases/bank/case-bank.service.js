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
var CaseBankService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseBankService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
const case_pattern_service_1 = require("./case-pattern.service");
const fallback_case_1 = require("./fallback-case");
let CaseBankService = CaseBankService_1 = class CaseBankService {
    constructor(prisma, patternService) {
        this.prisma = prisma;
        this.patternService = patternService;
        this.logger = new common_1.Logger(CaseBankService_1.name);
    }
    async pickCaseForRoom(roomId) {
        const { pattern } = await this.patternService.pickPatternType(roomId);
        const recentlyUsedTemplateIds = await this.getRecentlyUsedTemplateIds(roomId);
        const template = (await this.findBestTemplate(pattern, recentlyUsedTemplateIds)) ??
            (await this.findBestTemplate(null, recentlyUsedTemplateIds)) ??
            (await this.findBestTemplate(null, []));
        if (!template) {
            this.logger.error(`بنك القضايا فارغ تمامًا للغرفة ${roomId}. استورد القضايا عبر: npm run import:cases`);
            return {
                groundTruth: fallback_case_1.FALLBACK_CASE,
                dossiers: this.buildFallbackDossiers(),
                patternType: 'defendant_innocent',
                sourceTemplateId: null,
                isFallback: true,
            };
        }
        await this.prisma.caseTemplate.update({
            where: { id: template.id },
            data: { timesUsed: { increment: 1 } },
        });
        return {
            groundTruth: template.groundTruth,
            dossiers: template.dossiers,
            patternType: template.casePatternType,
            sourceTemplateId: template.id,
            isFallback: false,
        };
    }
    async getRecentlyUsedTemplateIds(roomId) {
        const recentCases = await this.prisma.case.findMany({
            where: { roomId, sourceTemplateId: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { sourceTemplateId: true },
        });
        return recentCases.map((c) => c.sourceTemplateId).filter((id) => !!id);
    }
    async findBestTemplate(pattern, excludeIds) {
        const candidates = await this.prisma.caseTemplate.findMany({
            where: {
                isActive: true,
                ...(pattern ? { casePatternType: pattern } : {}),
                ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
            },
            orderBy: { timesUsed: 'asc' },
            take: 5,
        });
        if (candidates.length === 0)
            return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    buildFallbackDossiers() {
        return fallback_case_1.FALLBACK_CASE.characters.map((character) => ({
            known_facts: character.knows_facts,
            false_beliefs: character.is_real_culprit
                ? []
                : [
                    {
                        belief: 'يعتقد أن مشرف المناوبة الليلية هو المسؤول عن الحادثة بسبب وجوده في الموقع',
                        is_intentional_conflict: true,
                    },
                ],
            missing_facts_hint: ['هناك تفاصيل عن طلب الصيانة لم تُكشف بعد'],
            held_evidence: character.physical_evidence_held.slice(0, 3),
            lie_or_hide_reason: character.is_real_culprit
                ? 'يخفي علاقته بطلب الصيانة وسداد الدين خشية كشف تورطه'
                : null,
            motive_category: character.motive_category,
            narrative_voice_notes: 'هادئ ومباشر أثناء الاستجواب، يجيب فقط عمّا يُسأل عنه صراحة.',
            characterName: character.name,
            roleType: character.role_type,
        }));
    }
};
exports.CaseBankService = CaseBankService;
exports.CaseBankService = CaseBankService = CaseBankService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        case_pattern_service_1.CasePatternService])
], CaseBankService);
//# sourceMappingURL=case-bank.service.js.map