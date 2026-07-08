import { IsEnum, IsOptional, IsString, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export enum PlayModeDto {
  single_device = 'single_device',
  multiplayer = 'multiplayer',
}

export class CreateRoomDto {
  @IsEnum(PlayModeDto)
  playMode: PlayModeDto;

  @IsString()
  hostDisplayName: string;

  // مطلوبة فقط في وضع single_device: أسماء اللاعبين المحليين (3-20)
  // راجع GDD القسم "إضافة مرحلة إعداد اللاعبين المحليين"
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(20)
  localPlayerNames?: string[];
}
