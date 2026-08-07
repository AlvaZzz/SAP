import { Module } from '@nestjs/common';
import { InvestigadorAnalisisController } from './investigador-analisis.controller';
import { InvestigadorFiabilidadService } from './investigador-fiabilidad.service';
import { InvestigadorInferencialService } from './investigador-inferencial.service';
import { InvestigadorValidezService } from './investigador-validez.service';
import { InvestigadorReproducibilidadService } from './investigador-reproducibilidad.service';
import { InvestigadorClasificacionService } from './investigador-clasificacion.service';
import { AuthModule } from '../../auth/auth.module';
import { InvestigadorExportacionModule } from '../investigador-exportacion/investigador-exportacion.module';

/**
 * Análisis del estudio para la tesis. Depende de InvestigadorExportacionModule
 * porque TODO deriva del dataset canónico: no hay consultas paralelas que
 * puedan contradecir a las demás pantallas.
 */
@Module({
  imports: [AuthModule, InvestigadorExportacionModule],
  controllers: [InvestigadorAnalisisController],
  providers: [
    InvestigadorFiabilidadService,
    InvestigadorInferencialService,
    InvestigadorValidezService,
    InvestigadorReproducibilidadService,
    InvestigadorClasificacionService,
  ],
})
export class InvestigadorAnalisisModule {}
