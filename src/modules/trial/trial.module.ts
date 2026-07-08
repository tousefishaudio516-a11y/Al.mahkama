import { Module } from '@nestjs/common';
import { TrialService } from './trial.service';
import { ReadingService } from './reading.service';
import { TrialController } from './trial.controller';

@Module({
  controllers: [TrialController],
  providers: [TrialService, ReadingService],
  exports: [TrialService, ReadingService],
})
export class TrialModule {}
