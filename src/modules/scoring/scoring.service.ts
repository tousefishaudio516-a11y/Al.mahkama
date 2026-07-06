import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * تُطبِّق جدول النقاط في القسم 5 من GDD. تُستدعى بعد إصدار الحكم وكشف الحقيقة.
 * النقاط النهائية للأدوار الثانوية/الشهود (تقييم الأداء) تعتمد جزئيًا على تصويت
 * الأقران (Peer Rating) الذي يُجمع من الواجهة بعد الكشف ويُمرَّر هنا كمدخل منفصل.
 */
@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async scoreRound(roomId: string) {
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
    if (!latestCase || !latestVerdict) return [];

    const results: { playerId: string; points: number; reason: string }[] = [];

    for (const player of room.players) {
      const roleType = player.character?.roleType;
      if (!roleType) continue;

      switch (roleType) {
        case 'judge': {
          if (latestVerdict.matchesTruth) {
            results.push({ playerId: player.id, points: 100, reason: 'حكم مطابق للحقيقة' });
          } else {
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
          } else {
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
          // شهود وأدوار ثانوية: نقاط أساسية، تُستكمل لاحقًا بتصويت الأقران من الواجهة
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

    // تحديث رصيد النقاط التراكمي لكل مستخدم (لأصحاب الحسابات فقط، غير الضيوف المحليين بلا user)
    await Promise.all(
      results.map(async (r) => {
        const player = room.players.find((p) => p.id === r.playerId);
        if (!player?.userId) return;
        await this.prisma.user.update({
          where: { id: player.userId },
          data: { totalPoints: { increment: r.points } },
        });
      }),
    );

    return results;
  }

  /** يُستدعى من الواجهة بعد الكشف لإضافة نقاط "أفضل أداء تمثيلي" (Peer Rating). */
  async addPeerRatingBonus(roomId: string, playerId: string, bonusPoints: number) {
    return this.prisma.roundScore.create({
      data: { roomId, playerId, points: bonusPoints, reason: 'مكافأة تصويت الأقران - أفضل أداء' },
    });
  }
}
