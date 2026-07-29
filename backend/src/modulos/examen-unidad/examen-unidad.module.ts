import { Module } from '@nestjs/common';
import { ExamenUnidadController } from './examen-unidad.controller';
import { ExamenUnidadService } from './examen-unidad.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ExamenUnidadController],
  providers: [ExamenUnidadService],
  exports: [ExamenUnidadService],
})
export class ExamenUnidadModule {}
