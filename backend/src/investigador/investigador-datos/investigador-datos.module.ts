import { Module } from '@nestjs/common';
import { InvestigadorDatosController } from './investigador-datos.controller';
import { InvestigadorDatosService } from './investigador-datos.service';
import { AuthModule } from '../../auth/auth.module';
import { InvestigadorExportacionModule } from '../investigador-exportacion/investigador-exportacion.module';

@Module({
  imports: [AuthModule, InvestigadorExportacionModule],
  controllers: [InvestigadorDatosController],
  providers: [InvestigadorDatosService],
})
export class InvestigadorDatosModule {}
