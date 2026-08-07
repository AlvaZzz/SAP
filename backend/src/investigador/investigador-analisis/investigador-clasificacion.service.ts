import { Injectable } from '@nestjs/common';
import { InvestigadorExportacionService } from '../investigador-exportacion/investigador-exportacion.service';
import { compararGrupos } from '../../common/estadistica/contraste';
import { descriptivos, pearson } from '../../common/estadistica/inferencia';
import {
  THETA_UMBRAL_AVANZADO, THETA_UMBRAL_BASICO, dificultadDesdeNivel,
} from '../../mediciones/irt/irt';
import { NivelDificultad } from '@prisma/client';

const NIVELES: NivelDificultad[] = ['basico', 'intermedio', 'avanzado'];

/** Mínimo de estudiantes clasificados para que la validación signifique algo. */
export const MIN_PARA_VALIDAR = 10;

/**
 * VALIDACIÓN DE LA CLASIFICACIÓN POR NIVELES (rol investigador, SOLO LECTURA).
 *
 * Responde con DATOS a la pregunta que un tribunal hace sobre el corazón de la
 * adaptatividad: ¿los umbrales θ = ±0.5 clasifican bien?
 *
 *  1. ¿Discriminan? → distribución de θ y de niveles asignados.
 *  2. ¿Predicen?    → tasa de acierto posterior por nivel asignado (lo más fuerte).
 *  3. ¿Adaptan?     → movilidad entre el nivel inicial y el alcanzado por tema.
 *  4. ¿Y si el corte fuera otro? → análisis de sensibilidad ±0.4 / ±0.5 / ±0.6.
 *
 * Sin datos suficientes NO se muestran cifras: se dice que no hay datos.
 * Justificación teórica de los umbrales: docs/CLASIFICACION_NIVELES.md
 */
@Injectable()
export class InvestigadorClasificacionService {
  constructor(private readonly exportacion: InvestigadorExportacionService) {}

  /** Reclasifica con un umbral hipotético (simétrico), para la sensibilidad. */
  private nivelCon(theta: number, umbral: number): NivelDificultad {
    if (theta < -umbral) return 'basico';
    if (theta > umbral) return 'avanzado';
    return 'intermedio';
  }

  async resumen() {
    const filas = await this.exportacion.desempenoPorNivelItem();
    const conTheta = filas.filter((f) => f.theta_inicial !== null);
    const clasificados = filas.filter((f) => f.nivel_asignado !== null);

    const hayDatos = clasificados.length > 0;
    const suficiente = clasificados.length >= MIN_PARA_VALIDAR;

    // ── 1. Distribución de θ y de niveles asignados ──
    const thetas = conTheta.map((f) => f.theta_inicial as number);
    const conteo = new Map<string, number>(NIVELES.map((n) => [n, 0]));
    for (const f of clasificados) conteo.set(f.nivel_asignado!, (conteo.get(f.nivel_asignado!) ?? 0) + 1);

    const distribucion = NIVELES.map((n) => ({
      nivel: n,
      n: conteo.get(n) ?? 0,
      pct: clasificados.length ? Math.round(((conteo.get(n) ?? 0) / clasificados.length) * 100) : 0,
    }));

    // ¿Discrimina? Si casi todos caen en un solo nivel, los umbrales no separan.
    const mayor = Math.max(...distribucion.map((d) => d.pct));
    const nivelDominante = distribucion.find((d) => d.pct === mayor)?.nivel ?? null;
    const concentracionExtrema = clasificados.length >= MIN_PARA_VALIDAR && mayor >= 80;

    // ── 2. Validez predictiva ──
    // Quienes fueron clasificados en un nivel superior deberían acertar MÁS los
    // ejercicios intermedios/avanzados que quienes quedaron en básico. Se usan
    // solo ejercicios fuera del pretest (el pretest generó la clasificación:
    // validarla con él sería circular).
    const tasaPorNivelAsignado = NIVELES.map((asignado) => {
      const grupo = clasificados.filter((f) => f.nivel_asignado === asignado);
      const t = (campo: 'tasa_basico' | 'tasa_intermedio' | 'tasa_avanzado') => {
        const vals = grupo.map((f) => f[campo]).filter((v): v is number => v !== null);
        return vals.length ? descriptivos(vals).media : null;
      };
      return {
        nivel_asignado: asignado,
        n: grupo.length,
        con_actividad: grupo.filter((f) => f.intentos_basico + f.intentos_intermedio + f.intentos_avanzado > 0).length,
        tasa_en_items_basicos: t('tasa_basico'),
        tasa_en_items_intermedios: t('tasa_intermedio'),
        tasa_en_items_avanzados: t('tasa_avanzado'),
      };
    });

    // Contraste: básicos vs. no básicos en la tasa de acierto sobre ítems
    // intermedios y avanzados juntos (donde la clasificación debería notarse).
    const tasaDificil = (f: (typeof filas)[number]): number | null => {
      const aciertos = (f.tasa_intermedio ?? 0) * f.intentos_intermedio + (f.tasa_avanzado ?? 0) * f.intentos_avanzado;
      const total = f.intentos_intermedio + f.intentos_avanzado;
      return total > 0 ? aciertos / total : null;
    };
    const basicos = clasificados.filter((f) => f.nivel_asignado === 'basico')
      .map(tasaDificil).filter((v): v is number => v !== null);
    const superiores = clasificados.filter((f) => f.nivel_asignado !== 'basico')
      .map(tasaDificil).filter((v): v is number => v !== null);

    const contrastePredictivo = compararGrupos(basicos, superiores, {
      variable: 'la tasa de acierto en ítems intermedios y avanzados',
      etiquetaA: 'Clasificados Básico',
      etiquetaB: 'Clasificados Intermedio/Avanzado',
    });

    // Correlación θ inicial ↔ desempeño posterior: si la clasificación mide
    // habilidad, θ debería asociarse con acertar más.
    const paresTheta: number[] = [];
    const paresTasa: number[] = [];
    for (const f of conTheta) {
      const t = tasaDificil(f);
      if (t !== null) { paresTheta.push(f.theta_inicial as number); paresTasa.push(t); }
    }
    const correlacion = paresTheta.length >= 3 ? pearson(paresTheta, paresTasa) : null;

    // ── 3. Movilidad entre niveles ──
    // Compara el nivel inicial con los niveles alcanzados por tema: evidencia de
    // que el sistema ADAPTA y no encasilla.
    let subieron = 0;
    let mantuvieron = 0;
    let sinTemas = 0;
    const orden: Record<NivelDificultad, number> = { basico: 1, intermedio: 2, avanzado: 3 };
    for (const f of clasificados) {
      if (f.niveles_por_tema.length === 0) { sinTemas++; continue; }
      const maxAlcanzado = Math.max(...f.niveles_por_tema.map((n: NivelDificultad) => orden[n]));
      if (maxAlcanzado > orden[f.nivel_asignado as NivelDificultad]) subieron++;
      else mantuvieron++;
    }

    // ── 4. Sensibilidad de los umbrales ──
    // Responde en la defensa "¿y si hubiera elegido otro corte?" con un dato.
    const sensibilidad = [0.4, 0.5, 0.6].map((umbral) => {
      const c = new Map<string, number>(NIVELES.map((n) => [n, 0]));
      for (const t of thetas) {
        const n = this.nivelCon(t, umbral);
        c.set(n, (c.get(n) ?? 0) + 1);
      }
      return {
        umbral,
        vigente: umbral === THETA_UMBRAL_AVANZADO,
        distribucion: NIVELES.map((n) => ({
          nivel: n,
          n: c.get(n) ?? 0,
          pct: thetas.length ? Math.round(((c.get(n) ?? 0) / thetas.length) * 100) : 0,
        })),
      };
    });

    return {
      hay_datos: hayDatos,
      suficiente,
      n_clasificados: clasificados.length,
      advertencia: suficiente
        ? null
        : `Solo ${clasificados.length} estudiantes tienen nivel asignado. Se requieren al menos ` +
          `${MIN_PARA_VALIDAR} para que esta validación signifique algo; hasta entonces las cifras son ` +
          'descriptivas y no permiten concluir si los umbrales discriminan.',

      umbrales_vigentes: {
        basico: THETA_UMBRAL_BASICO,
        avanzado: THETA_UMBRAL_AVANZADO,
        anclas_b: NIVELES.map((n) => ({ nivel: n, b: dificultadDesdeNivel(n) })),
        justificacion:
          'Los umbrales ±0.5 son los puntos medios entre las dificultades ancla de niveles contiguos ' +
          '(básico b=−1, intermedio b=0, avanzado b=+1). Como θ y b comparten escala (logits), un ' +
          'estudiante con θ=0.5 tiene probabilidad ≥50 % de resolver un ítem de dificultad b=0.5. ' +
          'Es un criterio de contenido, no un percentil. Ver docs/CLASIFICACION_NIVELES.md.',
      },

      distribucion: {
        por_nivel: distribucion,
        theta: thetas.length ? descriptivos(thetas) : null,
        concentracion_extrema: concentracionExtrema,
        veredicto: !hayDatos
          ? 'Todavía no hay estudiantes clasificados.'
          : concentracionExtrema
            ? `ADVERTENCIA: el ${mayor} % de los estudiantes cae en un solo nivel (${nivelDominante}). ` +
              'Con esa concentración los umbrales no están discriminando y hay que revisarlos siguiendo ' +
              'el procedimiento documentado, no de forma improvisada.'
            : 'La clasificación reparte a los estudiantes entre los tres niveles.',
      },

      validez_predictiva: {
        tasa_por_nivel_asignado: tasaPorNivelAsignado,
        contraste: contrastePredictivo,
        correlacion_theta_desempeno: correlacion
          ? { r: correlacion.r, p: correlacion.p, n: correlacion.n, magnitud: correlacion.magnitud }
          : null,
        que_significa:
          'Es la evidencia más fuerte que puede presentarse sobre la clasificación: si el nivel asignado ' +
          'predice el desempeño POSTERIOR, la clasificación mide lo que dice medir. Se excluyen los ' +
          'ejercicios del pretest, que son los que produjeron la clasificación: usarlos sería circular. ' +
          'Si no predice, hay que decirlo — significa que los umbrales no capturan la habilidad real.',
      },

      movilidad: {
        subieron_de_nivel: subieron,
        mantuvieron: mantuvieron,
        sin_temas_iniciados: sinTemas,
        que_significa:
          'Cuántos estudiantes alcanzaron en algún tema un nivel superior al que se les asignó al ' +
          'inicio. Evidencia de que el sistema ADAPTA y no encasilla: la clasificación inicial es un ' +
          'punto de partida, no una etiqueta permanente.',
      },

      sensibilidad: {
        escenarios: sensibilidad,
        que_significa:
          'Cómo cambiaría el reparto de estudiantes si los cortes fueran ±0.4 o ±0.6 en lugar de ±0.5. ' +
          'Permite responder "¿y si hubiera elegido otro corte?" con un dato y no con una opinión. ' +
          'Un reparto estable entre escenarios indica que la clasificación no depende críticamente del ' +
          'valor exacto elegido.',
      },

      regla_de_revision:
        'Los umbrales NO se ajustan por intuición ni a mitad del estudio: cambiarlos reclasifica ' +
        'retroactivamente a los participantes e invalida las comparaciones pre/post. Solo se revisan ' +
        'tras recolectar datos reales, si esta pantalla muestra concentración extrema o ausencia de ' +
        'validez predictiva, y todo cambio se documenta con su justificación y fecha.',
    };
  }
}
