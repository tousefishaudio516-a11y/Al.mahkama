import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { SubmitVerdictDto } from './dto/submit-verdict.dto';

@Injectable()
export class VerdictService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
  ) {}

  /**
   * المرحلة 4: يصدر القاضي الحكم النهائي (مذنب/بريء) + عقوبة اختيارية.
   * فقط الدور judge يملك صلاحية هذا الإجراء.
   */
  async submitVerdict(roomId: string, dto: SubmitVerdictDto) {
    const player = await this.prisma.roomPlayer.findUniqueOrThrow({
      where: { id: dto.judgePlayerId },
      include: { character: true },
    });

    // كان مفقودًا سابقًا: تحقق من انتماء اللاعب لهذه الغرفة تحديدًا، وليس فقط أن دوره judge
    // في غرفة ما (قد تكون غرفة أخرى تمامًا).
    if (player.roomId !== roomId) {
      throw new ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
    }

    if (player.character?.roleType !== 'judge') {
      throw new ForbiddenException('فقط القاضي يمكنه إصدار الحكم');
    }

    const latestCase = await this.prisma.case.findFirstOrThrow({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
    });

    const correctVerdict = (latestCase.correctVerdict as any)?.verdict as
      | 'guilty'
      | 'not_guilty'
      | undefined;
    const matchesTruth = correctVerdict === dto.verdict;

    const verdict = await this.prisma.verdict.create({
      data: {
        roomId,
        judgePlayerId: dto.judgePlayerId,
        verdict: dto.verdict as any,
        penalty: dto.penalty,
        matchesTruth,
      },
    });

    await this.prisma.room.update({ where: { id: roomId }, data: { status: 'reveal' } });

    // القسم 4/5: النقاط تُحسب فور توفر الحكم، قبل عرض الكشف نفسه للاعبين
    await this.scoring.scoreRound(roomId);

    return verdict;
  }

  /**
   * المرحلة 5: كشف الحقيقة الكاملة.
   * أمان حرج (القسم 13): لا يُستدعى هذا المسار إطلاقًا قبل وجود سجل verdicts لهذه الغرفة.
   * ground_truth لا يُقرأ أو يُرسَل للعميل في أي مسار آخر بالتطبيق.
   */
  async getRevealPayload(roomId: string) {
    const verdict = await this.prisma.verdict.findFirst({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
    });

    if (!verdict) {
      // لا كشف بلا حكم صادر أولاً — يمنع أي تسريب مبكر لـ ground_truth
      throw new ForbiddenException('لا يمكن كشف الحقيقة قبل صدور الحكم');
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
}
