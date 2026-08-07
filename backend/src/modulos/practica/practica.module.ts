import { Module } from '@nestjs/common';
import { PracticaController } from './practica.controller';
import { PracticaService } from './practica.service';
import { AiRateLimitGuard } from '../../common/auth/ai-rate-limit.guard';
import { AuthModule } from '../../auth/auth.module';
import { TutorIaModule } from '../../tutor-ia/tutor-ia.module';
import { RetosModule } from '../retos/retos.module';

@Module({
  // RetosModule: el editor solo se usa dentro de un reto → reutiliza su guard de acceso.
  // Ya no hace falta GamificacionModule: la autocomprobación dejó de otorgar
  // emblemas (la ejecución la hace el navegador y su salida no es verificable).
  imports: [AuthModule, TutorIaModule, RetosModule],
  controllers: [PracticaController],
  providers: [PracticaService, AiRateLimitGuard],
})
export class PracticaModule {}
