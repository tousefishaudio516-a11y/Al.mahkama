import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TrialService } from './trial.service';

@Injectable()
export class ReadingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly trialService: TrialService,
  ) {}

  // ==================== وضع الغرفة الجماعية ====================
  /** زر "أنا جاهز" — القسم 4 المرحلة 2 (أ). */
  async markReady(roomCode: string, playerId: string) {
    await this.redis.markPlayerReady(roomCode, playerId);

    const room = await this.prisma.room.findUniqueOrThrow({
      where: { code: roomCode },
      include: { players: true },
    });

    const readyPlayers = await this.redis.getReadyPlayers(roomCode);
    const allReady = room.players.every((p) => readyPlayers.includes(p.id));

    if (allReady) {
      await this.trialService.startTrial(roomCode);
    }

    return { readyCount: readyPlayers.length, totalCount: room.players.length, allReady };
  }

  // ==================== وضع الهاتف الواحد (Pass & Play) — القسم 6.6 ====================
  /**
   * يعيد ترتيب اللاعبين ومعرّف اللاعب الحالي الذي يجب أن يُعرض ملفه الآن.
   * لا يُستدعى إلا مرة واحدة عند دخول مرحلة القراءة.
   */
  async initSingleDeviceReadingOrder(roomId: string) {
    const room = await this.prisma.room.findUniqueOrThrow({
      where: { id: roomId },
      include: { players: true },
    });
    const orderedIds = room.players.map((p) => p.id);
    await this.redis.setRoomState(room.code, {
      readingOrder: orderedIds,
      currentReadingIndex: 0,
    });
    return orderedIds[0];
  }

  /** يعيد من يجب أن يظهر ملفه الآن في وضع الهاتف الواحد، أو null إن لم تبدأ القراءة بعد. */
  async getCurrentTurn(roomCode: string) {
    const state = await this.redis.getRoomState<{
      readingOrder: string[];
      currentReadingIndex: number;
    }>(roomCode);

    if (!state) return null;
    return {
      currentPlayerId: state.readingOrder[state.currentReadingIndex] ?? null,
      index: state.currentReadingIndex,
      total: state.readingOrder.length,
    };
  }

  /** القسم 6.6 خطوة 4-6: زر "أغلقت الملف" -> قفل نهائي -> الانتقال للاعب التالي. */
  async closeFileAndAdvance(roomCode: string) {
    const state = await this.redis.getRoomState<{
      readingOrder: string[];
      currentReadingIndex: number;
    }>(roomCode);

    if (!state) throw new BadRequestException('لم تبدأ مرحلة القراءة بعد');

    const nextIndex = state.currentReadingIndex + 1;
    const isFinished = nextIndex >= state.readingOrder.length;

    await this.redis.setRoomState(roomCode, { ...state, currentReadingIndex: nextIndex });

    if (isFinished) {
      await this.trialService.startTrial(roomCode);
      return { finished: true, nextPlayerId: null };
    }

    return { finished: false, nextPlayerId: state.readingOrder[nextIndex] };
  }
}
