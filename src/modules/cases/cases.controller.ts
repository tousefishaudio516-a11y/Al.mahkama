import { Body, Controller, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CasesService } from './cases.service';

@Controller('rooms/:roomId/case')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  /**
   * المرحلة 1: يُستدعى بعد اكتمال الحد الأدنى للاعبين (من كلا النمطين).
   * أمان حرج: CasesService.generateCaseForRoom تعيد PublicCaseSummary فقط
   * (id/title/crimeType/setting) — لا ground_truth ولا correct_verdict إطلاقًا.
   * لا تُغيَّر هذه النقطة لإعادة الكائن الخام من Prisma مهما كان السبب.
   *
   * لم تعد هذه النقطة تستدعي أي API خارجي (بنك قضايا ثابت)، فلا داعي لحد صارم
   * مبني على تكلفة AI كما كان سابقًا؛ حد معتدل هنا فقط لمنع سبام الكتابة في قاعدة البيانات.
   */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('generate')
  generate(@Param('roomId') roomId: string, @Body('requestingPlayerId') requestingPlayerId?: string) {
    return this.casesService.generateCaseForRoom(roomId, requestingPlayerId);
  }
}
