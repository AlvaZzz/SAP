import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InvestigadorExportacionService } from './investigador-exportacion.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

/**
 * Rutas /investigador/exportacion — SOLO investigador/admin (guard de rol).
 * Rol de solo lectura: únicamente consulta y exporta, nunca modifica datos.
 */
@Controller('investigador/exportacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('investigador', 'admin')
export class InvestigadorExportacionController {
  constructor(private readonly service: InvestigadorExportacionService) {}

  /** Vista previa del dataset (JSON) para la pantalla de exportación. */
  @Get('dataset')
  async dataset() {
    return { dataset: await this.service.construirDataset() };
  }

  /** Descarga del CSV consolidado y anonimizado (insumo para la prueba t en Colab). */
  @Get('export.csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prexi_dataset_estudio.csv"');
    res.send(csv);
  }

  /** Dificultad b (IRT/Rasch) de cada ítem del banco (JSON). */
  @Get('items-irt')
  async itemsIrt() {
    return { items: await this.service.itemsIrt() };
  }

  /** Evolución de θ (habilidad estimada) por estudiante, anonimizada (JSON). */
  @Get('evolucion-theta')
  async evolucionTheta() {
    return { evolucion: await this.service.evolucionTheta() };
  }

  /** Diagnóstico inicial por tema (nivel, θ, puntaje) anonimizado (JSON). */
  @Get('diagnostico-temas')
  async diagnosticoTemas() {
    return { diagnostico: await this.service.diagnosticoTemas() };
  }

  /** Descarga del CSV del diagnóstico inicial por tema (una fila por estudiante×tema). */
  @Get('diagnostico-temas.csv')
  async diagnosticoTemasCsv(@Res() res: Response) {
    const csv = await this.service.diagnosticoTemasCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prexi_diagnostico_por_tema.csv"');
    res.send(csv);
  }

  /** Exámenes de fin de unidad (JSON) — avance interno entre unidades. */
  @Get('examenes-unidad')
  async examenesUnidad() {
    return { examenes: await this.service.examenesUnidad() };
  }

  /** Descarga del CSV de exámenes de fin de unidad (una fila por estudiante×intento). */
  @Get('examenes-unidad.csv')
  async examenesUnidadCsv(@Res() res: Response) {
    const csv = await this.service.examenesUnidadCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="prexi_examenes_unidad.csv"');
    res.send(csv);
  }
}
