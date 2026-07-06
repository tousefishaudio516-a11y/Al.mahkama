import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { TrialService } from './trial.service';
import { ReadingService } from './reading.service';
import { CreateTrialEventDto } from './dto/create-trial-event.dto';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('rooms/:roomCode')
export class TrialController {
  constructor(
    private readonly trialService: TrialService,
    private readonly readingService: ReadingService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveRoomId(roomCode: string): Promise<string> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { code: roomCode } });
    return room.id;
  }

  // ---- القراءة: وضع الغرفة الجماعية ----
  @Post('ready')
  markReady(@Param('roomCode') roomCode: string, @Body('playerId') playerId: string) {
    return this.readingService.markReady(roomCode, playerId);
  }

  // ---- القراءة: وضع الهاتف الواحد ----
  @Get('reading/current-turn')
  getCurrentTurn(@Param('roomCode') roomCode: string) {
    return this.readingService.getCurrentTurn(roomCode);
  }

  @Post('reading/close-file')
  closeFile(@Param('roomCode') roomCode: string) {
    return this.readingService.closeFileAndAdvance(roomCode);
  }

  // ---- المحاكمة ----
  @Get('trial/remaining')
  remaining(@Param('roomCode') roomCode: string) {
    return this.trialService.getRemainingSeconds(roomCode);
  }

  @Post('trial/events')
  async recordEvent(@Param('roomCode') roomCode: string, @Body() dto: CreateTrialEventDto) {
    const roomId = await this.resolveRoomId(roomCode);
    return this.trialService.recordEvent(roomId, dto);
  }

  @Post('trial/evidence/:evidenceId/reveal')
  async revealEvidence(
    @Param('roomCode') roomCode: string,
    @Param('evidenceId') evidenceId: string,
    @Body('actorPlayerId') actorPlayerId: string,
  ) {
    const roomId = await this.resolveRoomId(roomCode);
    return this.trialService.revealEvidence(roomId, evidenceId, actorPlayerId);
  }

  @Post('trial/end-early')
  async endEarly(@Param('roomCode') roomCode: string, @Body('judgePlayerId') judgePlayerId: string) {
    const roomId = await this.resolveRoomId(roomCode);
    return this.trialService.endTrialEarly(roomId, judgePlayerId);
  }
}
