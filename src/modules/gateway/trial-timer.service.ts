import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TrialService } from '../trial/trial.service';
import { RoomsGateway } from './rooms.gateway';

/**
 * كان مفقودًا تمامًا سابقًا: `RoomsGateway.broadcastRemainingTime` و
 * `TrialService.endTrialByTimeout` معرّفتان لكن لا شيء يستدعيهما — بمعنى أن المحاكمة
 * كانت لن تنتهي تلقائيًا بانتهاء الوقت (20 دقيقة) إطلاقًا، ولن يصل أي بث لحظي للوقت
 * المتبقي لأي عميل. هذا يضيف الحلقة الدورية الفعلية التي تنفّذ ذلك.
 */
@Injectable()
export class TrialTimerService {
  private readonly logger = new Logger(TrialTimerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trialService: TrialService,
    private readonly gateway: RoomsGateway,
  ) {}

  @Interval(3000)
  async tick() {
    const activeRooms = await this.prisma.room.findMany({
      where: { status: 'trial' },
      select: { id: true, code: true },
    });

    for (const room of activeRooms) {
      try {
        const remaining = await this.trialService.getRemainingSeconds(room.code);
        this.gateway.server.to(room.code).emit('timer_update', { remaining });

        if (remaining <= 0) {
          await this.trialService.endTrialByTimeout(room.id);
          this.gateway.server.to(room.code).emit('trial_ended', { reason: 'timeout' });
        }
      } catch (err) {
        this.logger.error(
          `فشل تحديث المؤقّت للغرفة ${room.code}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
