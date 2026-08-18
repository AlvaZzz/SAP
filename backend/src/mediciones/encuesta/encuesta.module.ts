import { Module } from '@nestjs/common';
import { EncuestaController } from './encuesta.controller';
import { EncuestaService } from './encuesta.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EncuestaController],
  providers: [EncuestaService],
  exports: [EncuestaService],
})
export class EncuestaModule {}
