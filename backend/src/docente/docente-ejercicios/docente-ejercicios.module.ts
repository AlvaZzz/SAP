import { Module } from '@nestjs/common';
import { DocenteEjerciciosController } from './docente-ejercicios.controller';
import { DocenteEjerciciosService } from './docente-ejercicios.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocenteEjerciciosController],
  providers: [DocenteEjerciciosService],
})
export class DocenteEjerciciosModule {}
