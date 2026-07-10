import { Module } from '@nestjs/common';
import { RetosController } from './retos.controller';
import { AuthModule } from '../../auth/auth.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [AuthModule, NotificacionesModule],
  controllers: [RetosController],
})
export class RetosModule {}
