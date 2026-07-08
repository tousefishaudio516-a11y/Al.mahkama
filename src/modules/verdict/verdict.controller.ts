import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { VerdictService } from './verdict.service';
import { SubmitVerdictDto } from './dto/submit-verdict.dto';

@Controller('rooms/:roomId')
export class VerdictController {
  constructor(private readonly verdictService: VerdictService) {}

  @Post('verdict')
  submit(@Param('roomId') roomId: string, @Body() dto: SubmitVerdictDto) {
    return this.verdictService.submitVerdict(roomId, dto);
  }

  @Get('reveal')
  reveal(@Param('roomId') roomId: string) {
    return this.verdictService.getRevealPayload(roomId);
  }
}
