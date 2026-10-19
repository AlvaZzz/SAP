import { Controller, Get, UseGuards } from '@nestjs/common';
import { DocenteReportesService } from './docente-reportes.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('docente/reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteReportesController {
  constructor(private readonly service: DocenteReportesService) {}

  @Get('pretest-postest')
  pretestPostest(@CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string) {
    return this.service.pretestPostest(docenteId, rol);
  }

  @Get('progreso-niveles')
  progresoNiveles(@CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string) {
    return this.service.progresoNiveles(docenteId, rol);
  }

  @Get('actividad-semanal')
  actividadSemanal(@CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string) {
    return this.service.actividadSemanal(docenteId, rol);
  }

}
