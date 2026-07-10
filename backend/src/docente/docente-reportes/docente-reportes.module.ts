import { Module } from '@nestjs/common';
import { DocenteReportesController } from './docente-reportes.controller';
import { DocenteReportesService } from './docente-reportes.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DocenteReportesController],
  providers: [DocenteReportesService],
  exports: [DocenteReportesService],
})
export class DocenteReportesModule {}
