import { Module } from '@nestjs/common';
import { DocenteRetosController } from './docente-retos.controller';
import { DocenteRetosService } from './docente-retos.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocenteRetosController],
  providers: [DocenteRetosService],
})
export class DocenteRetosModule {}
