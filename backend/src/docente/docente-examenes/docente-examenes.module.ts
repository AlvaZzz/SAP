import { Module } from '@nestjs/common';
import { DocenteExamenesController } from './docente-examenes.controller';
import { DocenteExamenesService } from './docente-examenes.service';
import { AuthModule } from '../../auth/auth.module';
import { DocenteEstudiantesModule } from '../docente-estudiantes/docente-estudiantes.module';
import { NotificacionesModule } from '../../modulos/notificaciones/notificaciones.module';

/** Exámenes de unidad del rol docente (reemplaza al control de la evaluación final por paralelo). */
@Module({
  imports: [AuthModule, DocenteEstudiantesModule, NotificacionesModule],
  controllers: [DocenteExamenesController],
  providers: [DocenteExamenesService],
})
export class DocenteExamenesModule {}
