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
exports.VerdictService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const scoring_service_1 = require("../scoring/scoring.service");
let VerdictService = class VerdictService {
    constructor(prisma, scoring) {
        this.prisma = prisma;
        this.scoring = scoring;
    }
    async submitVerdict(roomId, dto) {
        const player = await this.prisma.roomPlayer.findUniqueOrThrow({
            where: { id: dto.judgePlayerId },
            include: { character: true },
        });
        if (player.roomId !== roomId) {
            throw new common_1.ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
        }
        if (player.character?.roleType !== 'judge') {
            throw new common_1.ForbiddenException('فقط القاضي يمكنه إصدار الحكم');
        }
        const latestCase = await this.prisma.case.findFirstOrThrow({
            where: { roomId },
            orderBy: { createdAt: 'desc' },
        });
        const correctVerdict = latestCase.correctVerdict?.verdict;
        const matchesTruth = correctVerdict === dto.verdict;
        const verdict = await this.prisma.verdict.create({
            data: {
                roomId,
                judgePlayerId: dto.judgePlayerId,
                verdict: dto.verdict,
                penalty: dto.penalty,
                matchesTruth,
            },
        });
        await this.prisma.room.update({ where: { id: roomId }, data: { status: 'reveal' } });
        await this.scoring.scoreRound(roomId);
        return verdict;
    }
    async getRevealPayload(roomId) {
        const verdict = await this.prisma.verdict.findFirst({
            where: { roomId },
            orderBy: { createdAt: 'desc' },
        });
        if (!verdict) {
            throw new common_1.ForbiddenException('لا يمكن كشف الحقيقة قبل صدور الحكم');
        }
        const latestCase = await this.prisma.case.findFirstOrThrow({
            where: { roomId },
            orderBy: { createdAt: 'desc' },
            include: { characters: true, evidences: true },
        });
        const scores = await this.prisma.roundScore.findMany({
            where: { roomId },
            include: { player: true },
        });
        return {
            groundTruth: latestCase.groundTruth,
            timeline: latestCase.timeline,
            realCulpritCharacterId: latestCase.realCulpritCharacterId,
            decisiveEvidence: latestCase.evidences.filter((e) => e.isDecisive),
            correctVerdict: latestCase.correctVerdict,
            judgeVerdict: { verdict: verdict.verdict, matchesTruth: verdict.matchesTruth },
            scores,
        };
    }
};
exports.VerdictService = VerdictService;
exports.VerdictService = VerdictService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        scoring_service_1.ScoringService])
], VerdictService);
//# sourceMappingURL=verdict.service.js.map