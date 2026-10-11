import { Module } from '@nestjs/common';
import { InvestigadorValidacionController } from './investigador-validacion.controller';
import { InvestigadorValidacionService } from './investigador-validacion.service';
import { AuthModule } from '../../auth/auth.module';
import { InstrumentosModule } from '../../mediciones/instrumentos/instrumentos.module';

/** Panel de validación del sistema: los indicadores que declara la tesis. */
@Module({
  imports: [AuthModule, InstrumentosModule],
  controllers: [InvestigadorValidacionController],
  providers: [InvestigadorValidacionService],
})
export class InvestigadorValidacionModule {}
