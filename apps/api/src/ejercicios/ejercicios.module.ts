import { Module } from '@nestjs/common';
import { EjerciciosController } from './ejercicios.controller';
import { EjerciciosService } from './ejercicios.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // provee JwtModule para JwtAuthGuard
  controllers: [EjerciciosController],
  providers: [EjerciciosService],
  exports: [EjerciciosService],
})
export class EjerciciosModule {}
