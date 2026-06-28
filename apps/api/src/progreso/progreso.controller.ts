import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ProgresoService } from './progreso.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../common/auth/roles.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

@Controller('progreso')
@UseGuards(JwtAuthGuard)
export class ProgresoController {
  constructor(private readonly progreso: ProgresoService) {}

  @Get()
  async obtener(@CurrentUser('sub') id: number) {
    const [comp, niveles, sesiones] = await Promise.all([
      this.progreso.comparativa(id), this.progreso.niveles(id), this.progreso.sesiones(id),
    ]);
    return { ...comp, niveles, sesiones };
  }

  // ── Export para la investigación (prueba t fuera del sistema) ──
  @Get('export.csv')
  @UseGuards(RolesGuard)
  @Roles('docente', 'admin')
  async exportCsv(@Res() res: Response) {
    const csv = await this.progreso.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prexi_pretest_postest.csv"');
    res.send(csv);
  }
}
