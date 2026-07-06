import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export type CasePatternType = 'defendant_guilty' | 'defendant_innocent' | 'defendant_partial';

/**
 * القسم 6.5: يحدد احتمالية كون المتهم هو الفاعل الحقيقي أم لا، مع تتبع آخر الأنماط
 * لمنع اللاعبين من "قراءة" النمط عبر الجولات. غير مرئي لأي لاعب.
 */
@Injectable()
export class CasePatternService {
  // النسب المقترحة كنقطة بداية في الوثيقة، قابلة للتعديل من إعدادات الخادم
  private readonly weights: Record<CasePatternType, number> = {
    defendant_guilty: 0.5,
    defendant_innocent: 0.35,
    defendant_partial: 0.15,
  };

  constructor(private readonly prisma: PrismaService) {}

  async pickPatternType(roomId: string): Promise<{ pattern: CasePatternType; avoidRepeat: boolean }> {
    const recentCases = await this.prisma.case.findMany({
      where: { room: { id: roomId } },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { casePatternType: true },
    });

    const recentPatterns = recentCases.map((c) => c.casePatternType);
    const avoidRepeat = recentPatterns.length >= 2 && new Set(recentPatterns).size === 1;

    let pattern = this.weightedRandom();
    // إن تكرر نفس النمط في آخر جولتين، أعد الاختيار مع استبعاده مرة واحدة
    if (avoidRepeat && pattern === recentPatterns[0]) {
      pattern = this.weightedRandom([pattern]);
    }

    return { pattern, avoidRepeat };
  }

  private weightedRandom(exclude: CasePatternType[] = []): CasePatternType {
    const entries = Object.entries(this.weights).filter(
      ([key]) => !exclude.includes(key as CasePatternType),
    ) as [CasePatternType, number][];

    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [key, weight] of entries) {
      r -= weight;
      if (r <= 0) return key;
    }
    return entries[0][0];
  }
}
