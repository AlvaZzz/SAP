import { Module } from '@nestjs/common';
import { InvestigadorPanelController } from './investigador-panel.controller';
import { InvestigadorPanelService } from './investigador-panel.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InvestigadorPanelController],
  providers: [InvestigadorPanelService],
})
export class InvestigadorPanelModule {}
