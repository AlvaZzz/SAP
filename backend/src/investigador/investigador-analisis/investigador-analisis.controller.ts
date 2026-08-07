import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { InvestigadorFiabilidadService } from './investigador-fiabilidad.service';
import { InvestigadorInferencialService } from './investigador-inferencial.service';
import { InvestigadorValidezService } from './investigador-validez.service';
import { InvestigadorReproducibilidadService } from './investigador-reproducibilidad.service';

/**
 * Análisis del estudio (rol investigador). TODO es de SOLO LECTURA: no existe
 * aquí ningún endpoint que escriba, modifique o borre datos del estudio.
 */
@Controller('investigador')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('investigador', 'admin')
export class InvestigadorAnalisisController {
  constructor(
    private readonly fiabilidad: InvestigadorFiabilidadService,
    private readonly inferencial: InvestigadorInferencialService,
    private readonly validez: InvestigadorValidezService,
    private readonly reproducibilidad: InvestigadorReproducibilidadService,
  ) {}

  /** Fiabilidad del instrumento: KR-20, análisis de ítems y ajuste de Rasch. */
  @Get('fiabilidad')
  getFiabilidad() {
    return this.fiabilidad.resumen();
  }

  /** Equivalencia inicial de los grupos (línea base). */
  @Get('equivalencia')
  getEquivalencia() {
    return this.inferencial.equivalencia();
  }

  /** Contrastes centrales de la tesis. */
  @Get('inferencial')
  getInferencial() {
    return this.inferencial.resultados();
  }

  /** Relación entre uso del sistema y ganancia (correlaciones). */
  @Get('relacion-uso')
  getRelacionUso() {
    return this.inferencial.relacionUso();
  }

  /** Validez interna: flujo CONSORT, abandono, faltantes y dosis. */
  @Get('validez')
  getValidez() {
    return this.validez.resumen();
  }

  /** Ficha metodológica del estudio. */
  @Get('ficha-metodologica')
  getFicha() {
    return this.reproducibilidad.fichaMetodologica();
  }

  /** Diccionario de variables (codebook) del dataset. */
  @Get('codebook')
  getCodebook() {
    return { variables: this.reproducibilidad.codebook() };
  }

  @Get('codebook.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="prexi_diccionario_variables.csv"')
  getCodebookCsv() {
    return this.reproducibilidad.codebookCsv();
  }

  /** Metadatos del corte + hash SHA-256, para poder reproducir un resultado. */
  @Get('metadatos-corte')
  getMetadatos() {
    return this.reproducibilidad.metadatosCorte();
  }

  /** Ética: consentimiento verificable y confirmación de anonimización. */
  @Get('etica')
  getEtica() {
    return this.reproducibilidad.etica();
  }
}
