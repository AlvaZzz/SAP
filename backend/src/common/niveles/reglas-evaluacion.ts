import { NivelDificultad } from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  REGLAS DE EVALUACIÓN — ÚNICO LUGAR DE LA VERDAD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Todo el sistema se evalúa igual, para que el criterio sea el mismo para el
 *  estudiante, el docente y la tesis:
 *
 *   · Toda evaluación tiene 10 PREGUNTAS y se califica SOBRE 100
 *     (cada pregunta vale 10 puntos; una respuesta parcial vale su fracción).
 *   · Se aprueba —y se sube de nivel— con 80 O MÁS.
 *   · Entre 70 y 79 el estudiante está "cerca del umbral": el docente puede
 *     habilitarlo manualmente para la evaluación final.
 *
 *  No repitas estos números en otro archivo: impórtalos de aquí.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const PREGUNTAS_POR_EVALUACION = 10;
export const PUNTAJE_MAXIMO = 100;
export const PUNTOS_POR_PREGUNTA = PUNTAJE_MAXIMO / PREGUNTAS_POR_EVALUACION;
/** Nota mínima para aprobar una evaluación, subir de nivel y quedar habilitado a la evaluación final. */
export const UMBRAL_APROBACION = 80;
/** Desde aquí un estudiante está "cerca del umbral". */
export const UMBRAL_CERCA = 70;

/**
 * NOTA sobre 100 a partir del puntaje de cada pregunta (cada uno entre 0 y 1:
 * 1 = correcta, 0 = incorrecta, fracción = parcialmente correcta).
 *
 * Se divide entre el número REAL de preguntas, de modo que una evaluación con
 * menos de 10 (porque al tema aún le faltan ejercicios) sigue saliendo sobre 100.
 */
export function notaSobre100(puntajes: number[]): number {
  if (puntajes.length === 0) return 0;
  const suma = puntajes.reduce((a, p) => a + Math.max(0, Math.min(1, p)), 0);
  return Math.round((suma / puntajes.length) * PUNTAJE_MAXIMO);
}

export const aprueba = (nota: number): boolean => nota >= UMBRAL_APROBACION;

export interface NotaExamen { unidadId: number; puntaje: number }
export interface NotaSubida { temaId: number; hacia: NivelDificultad; puntaje: number }

/**
 * PROMEDIO GENERAL sobre 100.
 *
 * Media de las notas de sus evaluaciones, contando el MEJOR intento de cada una:
 *   · examen de fin de unidad → mejor nota por unidad;
 *   · evaluación de subida de nivel → mejor nota por tema y nivel.
 * Devuelve null si aún no rindió ninguna: "sin evaluaciones" no es un cero.
 */
export function promedioGeneral(examenes: NotaExamen[], subidas: NotaSubida[]): number | null {
  const mejores = new Map<string, number>();
  const anotar = (clave: string, puntaje: number) => mejores.set(clave, Math.max(mejores.get(clave) ?? 0, puntaje));
  for (const e of examenes) anotar(`u${e.unidadId}`, e.puntaje);
  for (const s of subidas) anotar(`t${s.temaId}:${s.hacia}`, s.puntaje);
  if (mejores.size === 0) return null;
  const notas = [...mejores.values()];
  return Math.round(notas.reduce((a, b) => a + b, 0) / notas.length);
}

export type SituacionPromedio = 'aprobado' | 'cerca' | 'bajo' | 'sin_evaluaciones';

/** Dónde está el promedio respecto del umbral de 80. */
export function situacionPromedio(promedio: number | null): SituacionPromedio {
  if (promedio === null) return 'sin_evaluaciones';
  if (promedio >= UMBRAL_APROBACION) return 'aprobado';
  if (promedio >= UMBRAL_CERCA) return 'cerca';
  return 'bajo';
}
