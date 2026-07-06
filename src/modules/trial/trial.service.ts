import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateTrialEventDto } from './dto/create-trial-event.dto';

const TRIAL_DURATION_SECONDS_DEFAULT = 1200; // 20 دقيقة (القسم 4، المرحلة 3)

@Injectable()
export class TrialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** يبدأ عند جاهزية 100% من اللاعبين (جماعي) أو انتهاء آخر لاعب من القراءة (هاتف واحد). */
  async startTrial(roomCode: string) {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { code: roomCode } });

    const durationSeconds = room.trialDurationSeconds ?? TRIAL_DURATION_SECONDS_DEFAULT;
    const endsAt = Date.now() + durationSeconds * 1000;

    await this.redis.setTrialEndTimestamp(roomCode, endsAt);
    await this.redis.clearReadyPlayers(roomCode);

    await this.prisma.room.update({
      where: { id: room.id },
      data: { status: 'trial', trialStartedAt: new Date() },
    });

    await this.logSystemEvent(room.id, 'بدأت المحاكمة. لديكم 20 دقيقة للتحقيق والمرافعة.');

    return { endsAt };
  }

  async getRemainingSeconds(roomCode: string): Promise<number> {
    const endsAt = await this.redis.getTrialEndTimestamp(roomCode);
    if (!endsAt) return 0;
    return Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
  }

  /**
   * تحقق ملكية: يمنع أي لاعب من التصرف باسم لاعب آخر عبر مجرد إرسال playerId مختلف
   * في جسم الطلب. سابقًا لم يوجد أي تحقق من أن actorPlayerId ينتمي فعلاً لهذه الغرفة،
   * سواء عبر REST أو WebSocket.
   */
  private async assertPlayerInRoom(roomId: string, playerId: string) {
    const player = await this.prisma.roomPlayer.findUnique({ where: { id: playerId } });
    if (!player || player.roomId !== roomId) {
      throw new ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
    }
  }

  /** المرحلة 3: أي لاعب (حسب دوره) يسجّل حدثًا علنيًا في سجل المحاكمة. */
  async recordEvent(roomId: string, dto: CreateTrialEventDto) {
    if (dto.actorPlayerId) {
      await this.assertPlayerInRoom(roomId, dto.actorPlayerId);
    }
    return this.prisma.trialEvent.create({
      data: {
        roomId,
        actorPlayerId: dto.actorPlayerId,
        eventType: dto.eventType as any,
        content: dto.content,
        metadata: dto.metadata as any,
      },
    });
  }

  /** عرض دليل: يُحدَّث is_revealed=true ويُسجَّل كحدث علني في نفس الوقت. */
  async revealEvidence(roomId: string, evidenceId: string, actorPlayerId: string) {
    await this.assertPlayerInRoom(roomId, actorPlayerId);
    const evidence = await this.prisma.evidence.findUniqueOrThrow({ where: { id: evidenceId } });

    const updated = await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: { isRevealed: true, revealedAt: new Date() },
    });

    await this.recordEvent(roomId, {
      actorPlayerId,
      eventType: 'evidence_reveal' as any,
      content: evidence.title,
      metadata: { evidenceId },
    });

    return updated;
  }

  /** المرحلة 3: يمكن للقاضي فقط إنهاء المحاكمة مبكرًا إذا رأى أن القضية أصبحت واضحة. */
  async endTrialEarly(roomId: string, requestingPlayerId: string) {
    const player = await this.prisma.roomPlayer.findUniqueOrThrow({
      where: { id: requestingPlayerId },
      include: { character: true },
    });

    // كان مفقودًا سابقًا: لا تحقق من أن هذا اللاعب/القاضي ينتمي فعلاً لغرفة roomId،
    // ما كان يسمح نظريًا لقاضٍ في غرفة أخرى بإنهاء محاكمة غرفة ليست له.
    if (player.roomId !== roomId) {
      throw new ForbiddenException('لاعب غير منتمٍ لهذه الغرفة');
    }

    if (player.character?.roleType !== 'judge') {
      throw new ForbiddenException('فقط القاضي يمكنه إنهاء المحاكمة مبكرًا');
    }

    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.status !== 'trial') {
      throw new BadRequestException('المحاكمة ليست جارية حاليًا');
    }

    await this.redis.setTrialEndTimestamp(room.code, Date.now());
    await this.prisma.room.update({ where: { id: roomId }, data: { status: 'verdict' } });
    await this.logSystemEvent(roomId, 'أنهى القاضي المحاكمة مبكرًا.');

    return { ended: true };
  }

  /** يُستدعى من مهمة مجدولة (Cron/interval) على مستوى الـ Gateway عند انتهاء الوقت تلقائيًا. */
  async endTrialByTimeout(roomId: string) {
    await this.prisma.room.update({ where: { id: roomId }, data: { status: 'verdict' } });
    await this.logSystemEvent(roomId, 'انتهى وقت المحاكمة (20 دقيقة).');
  }

  private async logSystemEvent(roomId: string, content: string) {
    return this.prisma.trialEvent.create({
      data: { roomId, eventType: 'system', content },
    });
  }
}
