import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(dto);
  }

  @Post('join')
  join(@Body() dto: JoinRoomDto) {
    return this.roomsService.joinRoom(dto);
  }

  @Get(':code')
  getByCode(@Param('code') code: string) {
    return this.roomsService.getRoomByCode(code);
  }
}
