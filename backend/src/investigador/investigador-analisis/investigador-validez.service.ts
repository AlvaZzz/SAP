import { Injectable } from '@nestjs/common';
import { FilaDataset, InvestigadorExportacionService } from '../investigador-exportacion/investigador-exportacion.service';
import { descriptivos, media } from '../../common/estadistica/inferencia';

/**
 * FLUJO DE PARTICIPANTES Y USO DEL SISTEMA (rol investigador, SOLO LECTURA).
 *
 * El estudio es no experimental transversal: no hay grupos que comparar. Lo que
 * sí hay que documentar es sobre cuánta gente se sostiene cada indicador
 * (cuántos se registraron, cuántos rindieron el diagnóstico, cuántos usaron de
 * verdad el sistema) y cuánto lo usaron durante el período de uso.
 */
@Injectable()
export class InvestigadorValidezService {
  constructor(private readonly exportacion: InvestigadorExportacionService) {}

  /** Cascada registrados → diagnóstico → uso real → evaluación final. */
  private flujo(filas: FilaDataset[]) {
    const registrados = filas.length;
    const conDiagnostico = filas.filter((f) => f.pretest_total !== null).length;
    // "Usó el sistema" = tiene actividad real registrada, no solo una cuenta.
    const conActividad = filas.filter((f) => f.intentos_totales > 0).length;
    const conEvaluacionFinal = filas.filter((f) => f.postest_total !== null).length;

    const etapa = (nombre: string, n: number, anterior: number | null, nota: string) => ({
      etapa: nombre,
      n,
      perdida: anterior === null ? null : anterior - n,
      pct_del_inicial: registrados ? Math.round((n / registrados) * 100) : 0,
      nota,
    });

    return [
      etapa('Registrados', registrados, null, 'Cuentas de estudiante creadas.'),
      etapa('Rindieron el diagnóstico inicial', conDiagnostico, registrados, 'El diagnóstico clasifica el nivel y personaliza la ruta.'),
      etapa('Con actividad en el sistema', conActividad, conDiagnostico, 'Al menos un intento registrado: son quienes generan logs del motor adaptativo.'),
      etapa('Rindieron la evaluación final', conEvaluacionFinal, conActividad, 'Evaluación final del curso, habilitada por el docente.'),
    ];
  }

  async resumen() {
    const dataset = await this.exportacion.construirDataset();

    const faltantes = {
      criterio:
        'No se imputan valores: una evaluación no rendida o un cuestionario no respondido es un dato ' +
        'ausente, y rellenarlo con un cero o con la media inventaría evidencia.',
      sin_diagnostico: dataset.filter((f) => f.pretest_total === null).length,
      sin_evaluacion_final: dataset.filter((f) => f.postest_total === null).length,
      sin_actividad: dataset.filter((f) => f.intentos_totales === 0).length,
      sin_theta_inicial: dataset.filter((f) => f.theta_inicial === null).length,
      total: dataset.length,
    };

    // Uso real durante el período: responde a "¿llegó a usarse el sistema?".
    const uso = {
      n: dataset.length,
      sin_actividad: faltantes.sin_actividad,
      intentos: descriptivos(dataset.map((f) => f.intentos_totales)),
      ejercicios_resueltos: descriptivos(dataset.map((f) => f.ejercicios_resueltos)),
      dias_activos: descriptivos(dataset.map((f) => f.dias_activos)),
      minutos_estimados_media: dataset.length ? media(dataset.map((f) => f.minutos_estimados)) : null,
      retos_entregados_media: dataset.length ? media(dataset.map((f) => f.retos_entregados)) : null,
      consultas_ia_media: dataset.length ? media(dataset.map((f) => f.consultas_ia)) : null,
      consultas_ranking_media: dataset.length ? media(dataset.map((f) => f.consultas_ranking)) : null,
      que_significa:
        'El uso documenta cuánto se empleó realmente el sistema en el período de medición. Los ' +
        'indicadores del motor adaptativo solo se sostienen sobre los estudiantes con actividad.',
    };

    return { flujo: this.flujo(dataset), faltantes, uso };
  }
}
