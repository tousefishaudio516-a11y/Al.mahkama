import { Module } from '@nestjs/common';
import { RoomsGateway } from './rooms.gateway';
import { TrialTimerService } from './trial-timer.service';
import { TrialModule } from '../trial/trial.module';

@Module({
  imports: [TrialModule],
  providers: [RoomsGateway, TrialTimerService],
})
export class GatewayModule {}
