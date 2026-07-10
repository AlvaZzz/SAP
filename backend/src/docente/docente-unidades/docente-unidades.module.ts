import { Module } from '@nestjs/common';
import { DocenteUnidadesController } from './docente-unidades.controller';
import { DocenteUnidadesService } from './docente-unidades.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocenteUnidadesController],
  providers: [DocenteUnidadesService],
  exports: [DocenteUnidadesService],
})
export class DocenteUnidadesModule {}
