import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum TrialEventTypeDto {
  statement = 'statement',
  evidence_reveal = 'evidence_reveal',
  question = 'question',
  objection = 'objection',
  system = 'system',
}

export class CreateTrialEventDto {
  @IsString()
  actorPlayerId: string;

  @IsEnum(TrialEventTypeDto)
  eventType: TrialEventTypeDto;

  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
