import { Module } from '@nestjs/common';
import { PracticaController } from './practica.controller';
import { PracticaService } from './practica.service';
import { PistonService } from './piston.service';
import { AiRateLimitGuard } from '../../common/auth/ai-rate-limit.guard';
import { AuthModule } from '../../auth/auth.module';
import { TutorIaModule } from '../../tutor-ia/tutor-ia.module';

@Module({
  imports: [AuthModule, TutorIaModule],
  controllers: [PracticaController],
  providers: [PracticaService, PistonService, AiRateLimitGuard],
})
export class PracticaModule {}
