import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { CaseBankService } from './bank/case-bank.service';
import { CasePatternService } from './bank/case-pattern.service';
import { PlayersModule } from '../players/players.module';
import { TrialModule } from '../trial/trial.module';

@Module({
  imports: [PlayersModule, TrialModule],
  controllers: [CasesController],
  providers: [CasesService, CaseBankService, CasePatternService],
  exports: [CasesService],
})
export class CasesModule {}
