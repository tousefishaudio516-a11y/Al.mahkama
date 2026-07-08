import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum VerdictEnumDto {
  guilty = 'guilty',
  not_guilty = 'not_guilty',
}

export class SubmitVerdictDto {
  @IsString()
  judgePlayerId: string;

  @IsEnum(VerdictEnumDto)
  verdict: VerdictEnumDto;

  @IsOptional()
  @IsString()
  penalty?: string;
}
