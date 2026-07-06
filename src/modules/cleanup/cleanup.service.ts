import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * تنظيف تلقائي دوري — كان موثَّقًا كنيّة فقط في تعليق داخل trial.service.ts
 * ("يُستدعى من مهمة مجدولة") دون أي Cron مسجَّل فعليًا في أي مكان بالمشروع.
 * بدونه: قاعدة البيانات تكبر بلا حدود بغرف مهجورة في الـ lobby وقضايا/أحداث قديمة،
 * حتى على خطة مجانية محدودة المساحة.
 *
 * القواعد:
 * - غرف عالقة في lobby (لم يبدأ توليد القضية) لأكثر من 6 ساعات: تُحذف بالكامل، على الأرجح مهجورة.
 * - غرف انتهت فعليًا (status='ended' أو مضى على وصولها لـ reveal أكثر من 48 ساعة): تُحذف مع كل بياناتها المرتبطة.
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupAbandonedLobbies() {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const abandoned = await this.prisma.room.findMany({
      where: { status: 'lobby', createdAt: { lt: sixHoursAgo } },
      select: { id: true, code: true },
    });

    if (abandoned.length === 0) return;

    await this.deleteRoomsCascade(abandoned.map((r) => r.id));
    this.logger.log(`تم حذف ${abandoned.length} غرفة مهجورة في الـ lobby (أقدم من 6 ساعات)`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupFinishedRooms() {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const finished = await this.prisma.room.findMany({
      where: {
        OR: [
          { status: 'ended', createdAt: { lt: fortyEightHoursAgo } },
          { status: 'reveal', createdAt: { lt: fortyEightHoursAgo } },
        ],
      },
      select: { id: true },
    });

    if (finished.length === 0) return;

    await this.deleteRoomsCascade(finished.map((r) => r.id));
    this.logger.log(`تم حذف ${finished.length} غرفة منتهية (أقدم من 48 ساعة)`);
  }

  /**
   * حذف يدوي بالترتيب الصحيح لعدم وجود onDelete: Cascade في المخطط الحالي.
   * الترتيب: أوراق الشجرة أولاً (roundScores/verdicts/trialEvents/evidences/characters)
   * ثم cases وأخيرًا roomPlayers/room نفسها.
   */
  private async deleteRoomsCascade(roomIds: string[]) {
    if (roomIds.length === 0) return;

    const cases = await this.prisma.case.findMany({
      where: { roomId: { in: roomIds } },
      select: { id: true },
    });
    const caseIds = cases.map((c) => c.id);

    await this.prisma.$transaction([
      this.prisma.roundScore.deleteMany({ where: { roomId: { in: roomIds } } }),
      this.prisma.verdict.deleteMany({ where: { roomId: { in: roomIds } } }),
      this.prisma.trialEvent.deleteMany({ where: { roomId: { in: roomIds } } }),
      // يجب فك ارتباط RoomPlayer.characterId قبل حذف Character، وإلا ينتهك قيد FK
      // (RoomPlayer.characterId يشير إلى Character دون onDelete: Cascade في المخطط الحالي).
      this.prisma.roomPlayer.updateMany({
        where: { roomId: { in: roomIds } },
        data: { characterId: null },
      }),
      this.prisma.evidence.deleteMany({ where: { caseId: { in: caseIds } } }),
      this.prisma.character.deleteMany({ where: { caseId: { in: caseIds } } }),
      this.prisma.case.deleteMany({ where: { id: { in: caseIds } } }),
      this.prisma.roomPlayer.deleteMany({ where: { roomId: { in: roomIds } } }),
      this.prisma.room.deleteMany({ where: { id: { in: roomIds } } }),
    ]);
  }
}
