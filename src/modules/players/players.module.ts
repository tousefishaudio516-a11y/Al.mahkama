import { Module } from '@nestjs/common';
import { RoleAssignmentService } from './role-assignment.service';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';

@Module({
  controllers: [PlayersController],
  providers: [RoleAssignmentService, PlayersService],
  exports: [RoleAssignmentService],
})
export class PlayersModule {}
