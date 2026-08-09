import { Module } from '@nestjs/common';
import { DocenteEstudiantesController } from './docente-estudiantes.controller';
import { DocenteEstudiantesService } from './docente-estudiantes.service';
import { DocenteRiesgoService } from './docente-riesgo.service';
import { AuthModule } from '../../auth/auth.module';
import { NotificacionesModule } from '../../modulos/notificaciones/notificaciones.module';

@Module({
  imports: [AuthModule, NotificacionesModule],
  controllers: [DocenteEstudiantesController],
  providers: [DocenteEstudiantesService, DocenteRiesgoService],
  exports: [DocenteEstudiantesService],
})
export class DocenteEstudiantesModule {}
