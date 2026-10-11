import { probabilidadAcierto } from '../irt/irt';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  INDICADORES DEL MOTOR ADAPTATIVO — funciones puras
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Definición operativa de "ASIGNACIÓN DENTRO DEL RANGO OBJETIVO":
 *
 *      P = 1 / (1 + e^-(θ − b))        rangoMin ≤ P ≤ rangoMax
 *
 *   · θ = habilidad estimada del estudiante ANTES de responder (logits).
 *   · b = dificultad del ejercicio que el motor le asignó (logits).
 *   · P = probabilidad de acierto esperada (modelo de Rasch).
 *
 *  Un ejercicio con P demasiado alta es trivial y no produce aprendizaje; uno
 *  con P demasiado baja frustra. El rango objetivo (por defecto 0,50–0,85) es
 *  el margen de "desafío productivo" y vive en ConfiguracionSistema, no aquí.
 *
 *  Sin Prisma ni Nest: se prueba una a una en motor.spec.ts.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Rango objetivo por defecto, en proporción (0–1). */
export const RANGO_OBJETIVO_MIN = 0.5;
export const RANGO_OBJETIVO_MAX = 0.85;

export interface RangoObjetivo {
  min: number;
  max: number;
}

/** Convierte los porcentajes de la configuración (50, 85) a proporción, saneados. */
export function rangoDesdeConfig(cfg?: { rangoObjetivoMin?: number | null; rangoObjetivoMax?: number | null } | null): RangoObjetivo {
  const min = (cfg?.rangoObjetivoMin ?? RANGO_OBJETIVO_MIN * 100) / 100;
  const max = (cfg?.rangoObjetivoMax ?? RANGO_OBJETIVO_MAX * 100) / 100;
  // Un rango invertido o fuera de [0,1] es un error de configuración: se cae al
  // valor por defecto en vez de marcar todo como "fuera de rango" en silencio.
  if (!(min >= 0 && max <= 1 && min < max)) return { min: RANGO_OBJETIVO_MIN, max: RANGO_OBJETIVO_MAX };
  return { min, max };
}

export interface EvaluacionAsignacion {
  probAcierto: number | null;
  enRangoObjetivo: boolean | null;
}

/**
 * Evalúa una asignación del motor. Si el estudiante aún no tiene θ no hay nada
 * contra qué comparar: se devuelve null (no evaluable), que NO cuenta ni como
 * acierto ni como fallo del motor.
 */
export function evaluarAsignacion(theta: number | null | undefined, b: number, rango: RangoObjetivo): EvaluacionAsignacion {
  if (theta == null || !Number.isFinite(theta) || !Number.isFinite(b)) {
    return { probAcierto: null, enRangoObjetivo: null };
  }
  const p = probabilidadAcierto(theta, b);
  return {
    probAcierto: Math.round(p * 10000) / 10000,
    enRangoObjetivo: p >= rango.min && p <= rango.max,
  };
}

/** Nanosegundos transcurridos desde `inicio` (process.hrtime.bigint), en ms enteros. */
export function msDesde(inicio: bigint, ahora: bigint = process.hrtime.bigint()): number {
  return Math.max(0, Math.round(Number(ahora - inicio) / 1e6));
}

/**
 * NIVEL DE PERSONALIZACIÓN DEL CONTENIDO (%).
 *
 *      personalización = ejercicios servidos por la ruta adaptativa
 *                        ─────────────────────────────────────────── × 100
 *                              total de ejercicios servidos
 *
 *  "Ruta adaptativa" = el ejercicio se seleccionó según el nivel del estudiante
 *  en ese tema y se ordenó por información respecto a su θ, frente a un orden
 *  fijo igual para todos. Devuelve null si no hay ejercicios servidos.
 */
export function porcentajePersonalizacion(personalizados: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((personalizados / total) * 1000) / 10;
}

/** Percentil de una serie (interpolación lineal). null si está vacía. */
export function percentilDe(valores: number[], p: number): number | null {
  if (valores.length === 0) return null;
  const xs = [...valores].sort((a, b) => a - b);
  const pos = (xs.length - 1) * p;
  const base = Math.floor(pos);
  const sig = xs[Math.min(base + 1, xs.length - 1)];
  return xs[base] + (sig - xs[base]) * (pos - base);
}
