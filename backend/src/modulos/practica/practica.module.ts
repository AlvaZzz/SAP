import { Module } from '@nestjs/common';
import { PracticaController } from './practica.controller';
import { PracticaService } from './practica.service';
import { PistonService } from './piston.service';
import { AiRateLimitGuard } from '../../common/auth/ai-rate-limit.guard';
import { AuthModule } from '../../auth/auth.module';
import { TutorIaModule } from '../../tutor-ia/tutor-ia.module';
import { RetosModule } from '../retos/retos.module';
import { GamificacionModule } from '../../gamificacion/gamificacion.module';

@Module({
  // RetosModule: el editor solo se usa dentro de un reto → reutiliza su guard de acceso.
  // GamificacionModule: EmblemasService para el emblema "Cazador de Bugs" del bug‑hunt.
  imports: [AuthModule, TutorIaModule, RetosModule, GamificacionModule],
  controllers: [PracticaController],
  providers: [PracticaService, PistonService, AiRateLimitGuard],
})
export class PracticaModule {}
