import { Module } from '@nestjs/common';
import { DocenteRegistroController } from './docente-registro.controller';
import { DocenteRegistroService } from './docente-registro.service';
import { AuthModule } from '../../auth/auth.module';
import { TutorIaModule } from '../../tutor-ia/tutor-ia.module';

/** Registro de estudiantes por el docente (materias, paralelos y carga desde Excel). */
@Module({
  imports: [AuthModule, TutorIaModule],
  controllers: [DocenteRegistroController],
  providers: [DocenteRegistroService],
  exports: [DocenteRegistroService],
})
export class DocenteRegistroModule {}
