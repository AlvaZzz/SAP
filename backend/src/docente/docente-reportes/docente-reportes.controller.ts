import { Controller, Get, UseGuards } from '@nestjs/common';
import { DocenteReportesService } from './docente-reportes.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

@Controller('docente/reportes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteReportesController {
  constructor(private readonly service: DocenteReportesService) {}

  @Get('pretest-postest')
  pretestPostest() {
    return this.service.pretestPostest();
  }

  @Get('progreso-niveles')
  progresoNiveles() {
    return this.service.progresoNiveles();
  }

  @Get('actividad-semanal')
  actividadSemanal() {
    return this.service.actividadSemanal();
  }

  // La ruta `export.csv` se eliminó: revelaba el grupo del estudio y duplicaba
  // el dataset canónico del rol investigador. Ver la nota en el servicio.
}
