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
exports.ScoringService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
let ScoringService = class ScoringService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async scoreRound(roomId) {
        const room = await this.prisma.room.findUniqueOrThrow({
            where: { id: roomId },
            include: {
                players: { include: { character: true } },
                cases: { orderBy: { createdAt: 'desc' }, take: 1 },
                verdicts: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
        });
        const latestCase = room.cases[0];
        const latestVerdict = room.verdicts[0];
        if (!latestCase || !latestVerdict)
            return [];
        const results = [];
        for (const player of room.players) {
            const roleType = player.character?.roleType;
            if (!roleType)
                continue;
            switch (roleType) {
                case 'judge': {
                    if (latestVerdict.matchesTruth) {
                        results.push({ playerId: player.id, points: 100, reason: 'حكم مطابق للحقيقة' });
                    }
                    else {
                        results.push({
                            playerId: player.id,
                            points: 0,
                            reason: 'حكم غير مطابق للحقيقة',
                        });
                    }
                    break;
                }
                case 'prosecutor': {
                    const defendantWasGuilty = latestCase.defendantCharacterId === latestCase.realCulpritCharacterId;
                    const won = defendantWasGuilty && latestVerdict.verdict === 'guilty';
                    results.push({
                        playerId: player.id,
                        points: won ? 100 : 0,
                        reason: won ? 'إقناع القاضي بإدانة المتهم المذنب فعلاً' : 'لم يحقق إدانة صحيحة',
                    });
                    break;
                }
                case 'defense': {
                    const defendantWasInnocent = latestCase.defendantCharacterId !== latestCase.realCulpritCharacterId;
                    const won = defendantWasInnocent && latestVerdict.verdict === 'not_guilty';
                    results.push({
                        playerId: player.id,
                        points: won ? 100 : 0,
                        reason: won ? 'تبرئة متهم بريء فعلاً' : 'لم يحقق تبرئة صحيحة',
                    });
                    break;
                }
                case 'defendant': {
                    const isGuilty = latestCase.defendantCharacterId === latestCase.realCulpritCharacterId;
                    if (isGuilty) {
                        const escaped = latestVerdict.verdict === 'not_guilty';
                        results.push({
                            playerId: player.id,
                            points: escaped ? 150 : 0,
                            reason: escaped ? 'نجح في تضليل المحكمة رغم الذنب' : 'أُدين رغم محاولاته',
                        });
                    }
                    else {
                        const cleared = latestVerdict.verdict === 'not_guilty';
                        results.push({
                            playerId: player.id,
                            points: cleared ? 80 : 0,
                            reason: cleared ? 'أثبت براءته' : 'أُدين ظلمًا رغم براءته',
                        });
                    }
                    break;
                }
                default: {
                    results.push({
                        playerId: player.id,
                        points: 20,
                        reason: 'مشاركة أساسية في الأدوار الثانوية/الشهادة',
                    });
                }
            }
        }
        await this.prisma.roundScore.createMany({
            data: results.map((r) => ({
                roomId,
                playerId: r.playerId,
                points: r.points,
                reason: r.reason,
            })),
        });
        await Promise.all(results.map(async (r) => {
            const player = room.players.find((p) => p.id === r.playerId);
            if (!player?.userId)
                return;
            await this.prisma.user.update({
                where: { id: player.userId },
                data: { totalPoints: { increment: r.points } },
            });
        }));
        return results;
    }
    async addPeerRatingBonus(roomId, playerId, bonusPoints) {
        return this.prisma.roundScore.create({
            data: { roomId, playerId, points: bonusPoints, reason: 'مكافأة تصويت الأقران - أفضل أداء' },
        });
    }
};
exports.ScoringService = ScoringService;
exports.ScoringService = ScoringService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ScoringService);
//# sourceMappingURL=scoring.service.js.map