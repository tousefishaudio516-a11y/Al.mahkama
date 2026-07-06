import { Controller, Get, Param } from '@nestjs/common';
import { PlayersService } from './players.service';

@Controller('rooms/:roomCode/players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get(':playerId/me')
  getMyCharacter(@Param('roomCode') roomCode: string, @Param('playerId') playerId: string) {
    return this.playersService.getMyCharacter(roomCode, playerId);
  }

  @Get()
  getRoomPlayersPublic(@Param('roomCode') roomCode: string) {
    return this.playersService.getRoomPlayersPublic(roomCode);
  }
}
