import { Module } from '@nestjs/common';
import { DocentePostestController } from './docente-postest.controller';
import { DocentePostestService } from './docente-postest.service';
import { AuthModule } from '../../auth/auth.module';
import { NotificacionesModule } from '../../modulos/notificaciones/notificaciones.module';

@Module({
  imports: [AuthModule, NotificacionesModule],
  controllers: [DocentePostestController],
  providers: [DocentePostestService],
})
export class DocentePostestModule {}
