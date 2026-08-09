import { Module } from '@nestjs/common';
import { DocenteEjerciciosController } from './docente-ejercicios.controller';
import { DocenteEjerciciosService } from './docente-ejercicios.service';
import { DocenteCoberturaService } from './docente-cobertura.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocenteEjerciciosController],
  providers: [DocenteEjerciciosService, DocenteCoberturaService],
})
export class DocenteEjerciciosModule {}
