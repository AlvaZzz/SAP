import { Module } from '@nestjs/common';
import { InvestigadorExportacionController } from './investigador-exportacion.controller';
import { InvestigadorExportacionService } from './investigador-exportacion.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InvestigadorExportacionController],
  providers: [InvestigadorExportacionService],
  exports: [InvestigadorExportacionService],
})
export class InvestigadorExportacionModule {}
