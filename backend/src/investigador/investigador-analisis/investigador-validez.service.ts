import { Injectable } from '@nestjs/common';
import { FilaDataset, InvestigadorExportacionService } from '../investigador-exportacion/investigador-exportacion.service';
import { descriptivos, media } from '../../common/estadistica/inferencia';
import { compararGrupos } from '../../common/estadistica/contraste';

const GRUPOS = ['control', 'experimental'] as const;

/**
 * VALIDEZ INTERNA DEL ESTUDIO (rol investigador, SOLO LECTURA).
 *
 * Es lo que un tribunal busca para objetar, así que conviene tenerlo antes de
 * que lo pregunten: cuánta gente entró, cuánta se perdió en cada etapa, si el
 * abandono fue distinto entre grupos, y cuánto usó realmente el sistema el
 * grupo experimental.
 */
@Injectable()
export class InvestigadorValidezService {
  constructor(private readonly exportacion: InvestigadorExportacionService) {}

  /**
   * FLUJO DE PARTICIPANTES estilo CONSORT.
   *
   * La cascada registrados → pretest → intervención → postest → análisis, con
   * la pérdida en cada paso. Es una figura que vale por sí sola en el capítulo
   * de resultados, porque muestra de un vistazo sobre cuánta gente se sostiene
   * realmente la conclusión.
   */
  private flujo(filas: FilaDataset[]) {
    const registrados = filas.length;
    const conPretest = filas.filter((f) => f.pretest_total !== null).length;
    // "Participó de la intervención" = tiene actividad real registrada, no solo
    // una cuenta creada. Sin actividad no hubo exposición al tratamiento.
    const conActividad = filas.filter((f) => f.intentos_totales > 0).length;
    const conPostest = filas.filter((f) => f.postest_total !== null).length;
    const analizables = filas.filter(
      (f) => f.pretest_total !== null && f.postest_total !== null,
    ).length;

    const etapa = (nombre: string, n: number, anterior: number | null, nota: string) => ({
      etapa: nombre,
      n,
      perdida: anterior === null ? null : anterior - n,
      pct_del_inicial: registrados ? Math.round((n / registrados) * 100) : 0,
      nota,
    });

    return [
      etapa('Registrados', registrados, null, 'Cuentas de estudiante creadas.'),
      etapa('Rindieron el pretest', conPretest, registrados, 'Sin pretest no hay línea base: no entran al análisis.'),
      etapa('Con actividad en el sistema', conActividad, conPretest, 'Al menos un intento registrado (exposición real a la intervención).'),
      etapa('Rindieron el postest', conPostest, conActividad, 'Sin postest no hay medida final.'),
      etapa('En el análisis final', analizables, conPostest, 'Casos COMPLETOS: con pretest Y postest.'),
    ];
  }

  async resumen() {
    const dataset = await this.exportacion.construirDataset();

    // ── Flujo por grupo y total ──
    const flujo = {
      total: this.flujo(dataset),
      por_grupo: GRUPOS.map((g) => ({
        grupo: g,
        etapas: this.flujo(dataset.filter((f) => f.grupo === g)),
      })),
    };

    // ── Mortalidad experimental (attrition) ──
    const attrition = GRUPOS.map((g) => {
      const filas = dataset.filter((f) => f.grupo === g);
      const conPre = filas.filter((f) => f.pretest_total !== null);
      const completaron = conPre.filter((f) => f.postest_total !== null).length;
      const abandonaron = conPre.length - completaron;
      return {
        grupo: g,
        con_pretest: conPre.length,
        completaron: completaron,
        abandonaron,
        tasa_abandono: conPre.length ? abandonaron / conPre.length : null,
      };
    });

    // ¿El abandono fue DIFERENCIAL? Si un grupo abandona mucho más que el otro,
    // los que quedan ya no son comparables y eso sesga el resultado.
    const tasaC = attrition[0].tasa_abandono;
    const tasaE = attrition[1].tasa_abandono;
    let attritionDiferencial: boolean | null = null;
    let attritionVeredicto: string;
    if (tasaC === null || tasaE === null) {
      attritionVeredicto = 'No hay pretest suficientes en algún grupo para evaluar el abandono.';
    } else {
      const brecha = Math.abs(tasaC - tasaE);
      attritionDiferencial = brecha > 0.2; // criterio habitual: >20 puntos
      attritionVeredicto = attritionDiferencial
        ? `ADVERTENCIA: el abandono difiere en ${Math.round(brecha * 100)} puntos porcentuales entre grupos ` +
          '(control ' + Math.round(tasaC * 100) + ' %, experimental ' + Math.round(tasaE * 100) + ' %). ' +
          'Un abandono diferencial sesga la comparación: quienes permanecen pueden no ser equivalentes.'
        : `El abandono es similar en ambos grupos (control ${Math.round(tasaC * 100)} %, experimental ${Math.round(tasaE * 100)} %), ` +
          'lo que no sugiere sesgo por pérdida diferencial.';
    }

    // ── Datos faltantes ──
    const faltantes = {
      criterio:
        'Análisis de CASOS COMPLETOS: solo entran al contraste pre-post los estudiantes con ambas ' +
        'medidas. No se imputan valores: un examen no rendido es un dato ausente, y rellenarlo con un ' +
        'cero o con la media inventaría evidencia.',
      sin_pretest: dataset.filter((f) => f.pretest_total === null).length,
      sin_postest: dataset.filter((f) => f.postest_total === null).length,
      sin_ninguno: dataset.filter((f) => f.pretest_total === null && f.postest_total === null).length,
      sin_theta_inicial: dataset.filter((f) => f.theta_inicial === null).length,
      sin_theta_final: dataset.filter((f) => f.theta_final === null).length,
      completos: dataset.filter((f) => f.pretest_total !== null && f.postest_total !== null).length,
      total: dataset.length,
    };

    // ── Dosis de intervención ──
    // Responde a "¿y si el grupo experimental simplemente no usó el sistema?".
    const dosis = GRUPOS.map((g) => {
      const filas = dataset.filter((f) => f.grupo === g);
      const intentos = filas.map((f) => f.intentos_totales);
      const ejercicios = filas.map((f) => f.ejercicios_resueltos);
      const tiempo = filas.map((f) => f.tiempo_promedio_ejercicio * f.intentos_totales);
      return {
        grupo: g,
        n: filas.length,
        sin_actividad: filas.filter((f) => f.intentos_totales === 0).length,
        intentos: descriptivos(intentos),
        ejercicios_resueltos: descriptivos(ejercicios),
        // Tiempo total aproximado, en minutos.
        minutos_totales_media: tiempo.length ? media(tiempo) / 60 : null,
        retos_entregados_media: filas.length ? media(filas.map((f) => f.retos_entregados)) : null,
        consultas_ia_media: filas.length ? media(filas.map((f) => f.consultas_ia)) : null,
      };
    });

    // ¿La dosis del experimental fue realmente mayor que la del control?
    const contrasteDosis = compararGrupos(
      dataset.filter((f) => f.grupo === 'control').map((f) => f.intentos_totales),
      dataset.filter((f) => f.grupo === 'experimental').map((f) => f.intentos_totales),
      { variable: 'la cantidad de intentos (dosis de intervención)', etiquetaA: 'Control', etiquetaB: 'Experimental' },
    );

    return {
      flujo,
      attrition: {
        por_grupo: attrition,
        diferencial: attritionDiferencial,
        veredicto: attritionVeredicto,
      },
      faltantes,
      dosis: {
        por_grupo: dosis,
        contraste: contrasteDosis,
        que_significa:
          'La dosis documenta cuánto usó realmente cada grupo el sistema. Si el grupo experimental ' +
          'apenas lo usó, un resultado nulo no refuta la intervención: indica que no llegó a aplicarse.',
      },
    };
  }
}
