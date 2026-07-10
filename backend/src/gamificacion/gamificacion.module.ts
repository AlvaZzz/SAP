import { Module } from '@nestjs/common';
import { GamificacionController } from './gamificacion.controller';
import { GamificacionService } from './gamificacion.service';
import { EmblemasService } from './emblemas.service';
import { RangosService } from './rangos.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GamificacionController],
  providers: [GamificacionService, EmblemasService, RangosService],
  // Exportados para que EjerciciosService/PostestService otorguen emblemas y
  // recalculen rangos tras cada intento/postest.
  exports: [EmblemasService, RangosService],
})
export class GamificacionModule {}
