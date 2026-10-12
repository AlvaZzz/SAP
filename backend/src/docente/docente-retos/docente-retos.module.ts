import { Module } from '@nestjs/common';
import { DocenteRetosController } from './docente-retos.controller';
import { DocenteRetosService } from './docente-retos.service';
import { AuthModule } from '../../auth/auth.module';
import { TutorIaModule } from '../../tutor-ia/tutor-ia.module';

@Module({
  imports: [AuthModule, TutorIaModule],
  controllers: [DocenteRetosController],
  providers: [DocenteRetosService],
})
export class DocenteRetosModule {}
