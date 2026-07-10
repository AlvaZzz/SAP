import { Module } from '@nestjs/common';
import { InvestigadorResultadosController } from './investigador-resultados.controller';
import { InvestigadorResultadosService } from './investigador-resultados.service';
import { AuthModule } from '../../auth/auth.module';
import { InvestigadorExportacionModule } from '../investigador-exportacion/investigador-exportacion.module';

@Module({
  imports: [AuthModule, InvestigadorExportacionModule],
  controllers: [InvestigadorResultadosController],
  providers: [InvestigadorResultadosService],
})
export class InvestigadorResultadosModule {}
