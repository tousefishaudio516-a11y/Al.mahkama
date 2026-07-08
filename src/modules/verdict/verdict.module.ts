import { Module } from '@nestjs/common';
import { VerdictService } from './verdict.service';
import { VerdictController } from './verdict.controller';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [ScoringModule],
  controllers: [VerdictController],
  providers: [VerdictService],
  exports: [VerdictService],
})
export class VerdictModule {}
