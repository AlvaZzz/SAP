import { Module } from '@nestjs/common';
import { DocentePreguntasIaController } from './docente-preguntas-ia.controller';
import { DocentePreguntasIaService } from './docente-preguntas-ia.service';
import { AuthModule } from '../../auth/auth.module';
import { TutorIaModule } from '../../tutor-ia/tutor-ia.module';

@Module({
  imports: [AuthModule, TutorIaModule],
  controllers: [DocentePreguntasIaController],
  providers: [DocentePreguntasIaService],
})
export class DocentePreguntasIaModule {}
