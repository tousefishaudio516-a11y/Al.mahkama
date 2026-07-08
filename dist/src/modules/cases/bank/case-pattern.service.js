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
exports.CasePatternService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../common/prisma/prisma.service");
let CasePatternService = class CasePatternService {
    constructor(prisma) {
        this.prisma = prisma;
        this.weights = {
            defendant_guilty: 0.5,
            defendant_innocent: 0.35,
            defendant_partial: 0.15,
        };
    }
    async pickPatternType(roomId) {
        const recentCases = await this.prisma.case.findMany({
            where: { room: { id: roomId } },
            orderBy: { createdAt: 'desc' },
            take: 2,
            select: { casePatternType: true },
        });
        const recentPatterns = recentCases.map((c) => c.casePatternType);
        const avoidRepeat = recentPatterns.length >= 2 && new Set(recentPatterns).size === 1;
        let pattern = this.weightedRandom();
        if (avoidRepeat && pattern === recentPatterns[0]) {
            pattern = this.weightedRandom([pattern]);
        }
        return { pattern, avoidRepeat };
    }
    weightedRandom(exclude = []) {
        const entries = Object.entries(this.weights).filter(([key]) => !exclude.includes(key));
        const total = entries.reduce((sum, [, w]) => sum + w, 0);
        let r = Math.random() * total;
        for (const [key, weight] of entries) {
            r -= weight;
            if (r <= 0)
                return key;
        }
        return entries[0][0];
    }
};
exports.CasePatternService = CasePatternService;
exports.CasePatternService = CasePatternService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CasePatternService);
//# sourceMappingURL=case-pattern.service.js.map