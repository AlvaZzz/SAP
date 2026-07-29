import { Module } from '@nestjs/common';
import { RetosController } from './retos.controller';
import { RetosAccessService } from './retos-access.service';
import { RetosService } from './retos.service';
import { RetosAccessGuard } from './retos-access.guard';
import { AuthModule } from '../../auth/auth.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { EjerciciosModule } from '../../ejercicios/ejercicios.module';

@Module({
  imports: [AuthModule, NotificacionesModule, EjerciciosModule], // EjerciciosModule: AdaptatividadService (θ)
  controllers: [RetosController],
  providers: [RetosAccessService, RetosService, RetosAccessGuard],
  // Se exportan para que PracticaModule reutilice el mismo guard en su editor.
  exports: [RetosAccessService, RetosService, RetosAccessGuard],
})
export class RetosModule {}
