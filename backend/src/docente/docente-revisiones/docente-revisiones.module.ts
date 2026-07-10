import { Module } from '@nestjs/common';
import { DocenteRevisionesController } from './docente-revisiones.controller';
import { DocenteRevisionesService } from './docente-revisiones.service';
import { AuthModule } from '../../auth/auth.module';
import { NotificacionesModule } from '../../modulos/notificaciones/notificaciones.module';
import { TutorIaModule } from '../../tutor-ia/tutor-ia.module';

@Module({
  imports: [AuthModule, NotificacionesModule, TutorIaModule],
  controllers: [DocenteRevisionesController],
  providers: [DocenteRevisionesService],
  exports: [DocenteRevisionesService],
})
export class DocenteRevisionesModule {}
