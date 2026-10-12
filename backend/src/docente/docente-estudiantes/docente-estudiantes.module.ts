import { Module } from '@nestjs/common';
import { DocenteEstudiantesController } from './docente-estudiantes.controller';
import { DocenteEstudiantesService } from './docente-estudiantes.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocenteEstudiantesController],
  providers: [DocenteEstudiantesService],
  exports: [DocenteEstudiantesService],
})
export class DocenteEstudiantesModule {}
