import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InvestigadorValidacionService } from './investigador-validacion.service';
import { MODO_DEMO } from '../investigador-exportacion/investigador-exportacion.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

/**
 * Panel de validación del sistema y sus datasets (rol investigador, SOLO LECTURA).
 * Un CSV anonimizado por instrumento, listo para Python/Pandas/SciPy.
 */
@Controller('investigador/validacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('investigador', 'admin')
export class InvestigadorValidacionController {
  constructor(private readonly service: InvestigadorValidacionService) {}

  /** Los tres indicadores de la tesis, la variable independiente y los criterios de aceptación. */
  @Get()
  resumen() {
    return this.service.resumen();
  }

  private enviar(res: Response, nombre: string, csv: string) {
    // Con el modo demostración activo el archivo lo dice en su nombre: datos
    // sintéticos no deben poder confundirse con los del estudio.
    const archivo = MODO_DEMO ? `prexi_DEMOSTRACION_${nombre}.csv` : `prexi_${nombre}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
    res.send(csv);
  }

  @Get('rendimiento-academico.csv')
  async rendimiento(@Res() res: Response) {
    this.enviar(res, 'rendimiento_academico', await this.service.rendimientoCsv());
  }

  @Get('log-adaptacion.csv')
  async logAdaptacion(@Res() res: Response) {
    this.enviar(res, 'log_adaptacion', await this.service.logAdaptacionCsv());
  }

  @Get('sus.csv')
  async sus(@Res() res: Response) {
    this.enviar(res, 'sus', await this.service.susCsv());
  }

  @Get('iso25010.csv')
  async iso25010(@Res() res: Response) {
    this.enviar(res, 'iso25010', await this.service.iso25010Csv());
  }

  @Get('uso-gamificacion.csv')
  async usoGamificacion(@Res() res: Response) {
    this.enviar(res, 'uso_gamificacion', await this.service.usoGamificacionCsv());
  }
}
