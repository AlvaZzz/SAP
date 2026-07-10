import { Module } from '@nestjs/common';
import { DocenteDashboardController } from './docente-dashboard.controller';
import { DocenteDashboardService } from './docente-dashboard.service';
import { AuthModule } from '../../auth/auth.module';
import { DocenteEstudiantesModule } from '../docente-estudiantes/docente-estudiantes.module';
import { DocenteReportesModule } from '../docente-reportes/docente-reportes.module';
import { DocenteRevisionesModule } from '../docente-revisiones/docente-revisiones.module';

@Module({
  imports: [AuthModule, DocenteEstudiantesModule, DocenteReportesModule, DocenteRevisionesModule],
  controllers: [DocenteDashboardController],
  providers: [DocenteDashboardService],
})
export class DocenteDashboardModule {}
