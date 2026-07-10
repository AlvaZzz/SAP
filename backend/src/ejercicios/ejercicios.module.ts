import { Module } from '@nestjs/common';
import { EjerciciosController } from './ejercicios.controller';
import { EjerciciosService } from './ejercicios.service';
import { AdaptatividadService } from './adaptatividad.service';
import { AuthModule } from '../auth/auth.module';
import { GamificacionModule } from '../gamificacion/gamificacion.module';

@Module({
  imports: [AuthModule, GamificacionModule], // Auth: JwtModule; Gami: emblemas + rangos
  controllers: [EjerciciosController],
  providers: [EjerciciosService, AdaptatividadService],
  exports: [EjerciciosService, AdaptatividadService],
})
export class EjerciciosModule {}
