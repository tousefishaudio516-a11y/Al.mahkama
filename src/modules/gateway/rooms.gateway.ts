import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TrialService } from '../trial/trial.service';
import { ReadingService } from '../trial/reading.service';

type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * قناة الاتصال اللحظي بين الغرفة وكل اللاعبين.
 *
 * أمان الهوية: أول ربط عبر join_room يُتحقق من أن playerId ينتمي فعلاً لهذه الغرفة في
 * قاعدة البيانات، ثم يُربط الـ socket بذلك اللاعب في Redis؛ كل حدث لاحق من نفس الـ socket
 * يُستخدم فيه playerId المربوط فعليًا، وليس أي قيمة أخرى يرسلها العميل ضمن الحمولة.
 *
 * أخطاء ونمط الرد (Ack): كل معالج يعيد كائن { ok, data|error } كقيمة إرجاع — Socket.IO
 * يرسل هذه القيمة تلقائيًا كـ acknowledgement إن مرّر العميل دالة callback مع emit().
 * هذا ضروري لأن استثناءات NestJS (مثل ForbiddenException) لا تصل تلقائيًا للعميل عبر
 * WebSocket كما تصل عبر REST (لا يوجد جسم استجابة HTTP هنا)؛ بدون هذا النمط، أي خطأ
 * كان يختفي بصمت من منظور العميل المرسل.
 */
@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? false, credentials: true },
  namespace: '/rooms',
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RoomsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly trialService: TrialService,
    private readonly readingService: ReadingService,
  ) {}

  handleConnection(client: Socket) {
    // الانضمام الفعلي لغرفة Socket.IO يتم عبر حدث join_room أدناه بعد التحقق من playerId
  }

  async handleDisconnect(client: Socket) {
    await this.redis.unbindSocket(client.id);
  }

  private async assertPlayerBelongsToRoom(roomCode: string, playerId: string): Promise<boolean> {
    const player = await this.prisma.roomPlayer.findUnique({
      where: { id: playerId },
      include: { room: true },
    });
    return !!player && player.room.code === roomCode;
  }

  private async getVerifiedPlayerId(
    client: Socket,
    roomCode: string,
    claimedPlayerId: string,
  ): Promise<string | null> {
    const bound = await this.redis.getPlayerForSocket(client.id);
    if (!bound || bound.code !== roomCode) {
      this.logger.warn(`Socket ${client.id} حاول إرسال حدث لغرفة ${roomCode} بلا join_room مسبق`);
      return null;
    }
    if (bound.playerId !== claimedPlayerId) {
      this.logger.warn(
        `Socket ${client.id} حاول انتحال هوية اللاعب ${claimedPlayerId} بينما هو مرتبط فعليًا بـ ${bound.playerId}`,
      );
      return null;
    }
    return bound.playerId;
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
  }

  @SubscribeMessage('join_room')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string },
  ):Promise<Ack<{ joined: true }>> {
    const belongs = await this.assertPlayerBelongsToRoom(data.roomCode, data.playerId);
    if (!belongs) {
      return { ok: false, error: 'لا يمكن الانضمام: هوية لاعب غير صالحة لهذه الغرفة' };
    }

    await client.join(data.roomCode);
    await this.redis.bindSocket(data.roomCode, data.playerId, client.id);
    this.server.to(data.roomCode).emit('player_joined', { playerId: data.playerId });
    return { ok: true, data: { joined: true } };
  }

  @SubscribeMessage('mark_ready')
  async onMarkReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string },
  ): Promise<Ack<{ readyCount: number; totalCount: number; allReady: boolean }>> {
    const playerId = await this.getVerifiedPlayerId(client, data.roomCode, data.playerId);
    if (!playerId) return { ok: false, error: 'لم يتم التحقق من هويتك في هذه الغرفة بعد' };

    try {
      const result = await this.readingService.markReady(data.roomCode, playerId);
      this.server.to(data.roomCode).emit('ready_update', result);
      if (result.allReady) {
        this.server.to(data.roomCode).emit('trial_started', { durationSeconds: 1200 });
      }
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: this.errMsg(err) };
    }
  }

  @SubscribeMessage('close_file')
  async onCloseFile(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string },
  ): Promise<Ack<{ finished: boolean; nextPlayerId: string | null }>> {
    try {
      const result = await this.readingService.closeFileAndAdvance(data.roomCode);
      if (result.finished) {
        this.server.to(data.roomCode).emit('trial_started', { durationSeconds: 1200 });
      } else {
        this.server.to(data.roomCode).emit('advance_to_next_local_player', {
          nextPlayerId: result.nextPlayerId,
        });
      }
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: this.errMsg(err) };
    }
  }

  @SubscribeMessage('trial_event')
  async onTrialEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; roomCode: string; event: any },
  ): Promise<Ack<unknown>> {
    const playerId = await this.getVerifiedPlayerId(client, data.roomCode, data.event?.actorPlayerId);
    if (!playerId) return { ok: false, error: 'لم يتم التحقق من هويتك في هذه الغرفة بعد' };

    try {
      const event = await this.trialService.recordEvent(data.roomId, { ...data.event, actorPlayerId: playerId });
      this.server.to(data.roomCode).emit('trial_event_broadcast', event);
      return { ok: true, data: event };
    } catch (err) {
      return { ok: false, error: this.errMsg(err) };
    }
  }

  @SubscribeMessage('reveal_evidence')
  async onRevealEvidence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; roomCode: string; evidenceId: string; actorPlayerId: string },
  ): Promise<Ack<unknown>> {
    const playerId = await this.getVerifiedPlayerId(client, data.roomCode, data.actorPlayerId);
    if (!playerId) return { ok: false, error: 'لم يتم التحقق من هويتك في هذه الغرفة بعد' };

    try {
      const evidence = await this.trialService.revealEvidence(data.roomId, data.evidenceId, playerId);
      this.server.to(data.roomCode).emit('evidence_revealed', evidence);
      return { ok: true, data: evidence };
    } catch (err) {
      return { ok: false, error: this.errMsg(err) };
    }
  }

  @SubscribeMessage('end_trial_early')
  async onEndTrialEarly(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; roomCode: string; judgePlayerId: string },
): Promise<Ack<{ ended: boolean }>> {
    const playerId = await this.getVerifiedPlayerId(client, data.roomCode, data.judgePlayerId);
    if (!playerId) return { ok: false, error: 'لم يتم التحقق من هويتك في هذه الغرفة بعد' };

    try {
      const result = await this.trialService.endTrialEarly(data.roomId, playerId);
      this.server.to(data.roomCode).emit('trial_ended', { reason: 'judge' });
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: this.errMsg(err) };
    }
  }
}
