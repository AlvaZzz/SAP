import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { InvestigadorExportacionService, MODO_DEMO } from './investigador-exportacion.service';
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
    return {
      dataset: await this.service.construirDataset(),
      calculado_en: this.service.calculadoEn,
    };
  }

  /**
   * Fuerza el recálculo del dataset (botón "Actualizar datos").
   *
   * Es un GET a propósito y no un POST: no modifica datos del estudio, solo
   * descarta una caché en memoria del backend. El rol sigue siendo de solo
   * lectura sobre la base.
   */
  @Get('actualizar')
  async actualizar() {
    this.service.invalidarCache();
    const dataset = await this.service.construirDataset(true);
    return {
      ok: true,
      n: dataset.length,
      calculado_en: this.service.calculadoEn,
    };
  }

  /** Descarga del CSV consolidado y anonimizado (insumo para la prueba t en Colab). */
  @Get('export.csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv();
    // Si el modo demostración está activo, el archivo lo dice en su propio
    // nombre: un CSV con datos sintéticos jamás debe poder confundirse con el
    // dataset del estudio, ni siquiera meses después en la carpeta de descargas.
    const nombre = MODO_DEMO
      ? 'prexi_DEMOSTRACION_NO_ES_EL_ESTUDIO.csv'
      : 'prexi_dataset_estudio.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(csv);
  }

  /** Dificultad b (IRT/Rasch) de cada ítem del banco (JSON). */
  // TODO: REVISAR_ANTES_DE_ELIMINAR — export auxiliar sin pantalla que lo llame; útil si se anexa a la tesis, inútil si no.
  @Get('items-irt')
  async itemsIrt() {
    return { items: await this.service.itemsIrt() };
  }

  /** Evolución de θ (habilidad estimada) por estudiante, anonimizada (JSON). */
  // TODO: REVISAR_ANTES_DE_ELIMINAR — ídem: sin consumidor en el frontend.
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
