import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
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

  @Get('export.csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prexi_pretest_postest.csv"');
    res.send(csv);
  }
}
