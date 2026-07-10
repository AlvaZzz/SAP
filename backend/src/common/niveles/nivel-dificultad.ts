import { NivelDificultad } from '@prisma/client';

/**
 * Lógica PURA de los niveles adaptativos (Básico/Intermedio/Avanzado). Sin
 * dependencias de Prisma en runtime → fácilmente testeable y reutilizable por
 * pretest, adaptatividad, unidades y gamificación (evita duplicar reglas).
 */

// Orden ascendente del nivel (mayor = más difícil).
export const ORDEN_NIVEL: Record<NivelDificultad, number> = {
  basico: 1,
  intermedio: 2,
  avanzado: 3,
};

// Etiqueta legible (para DTOs/UI que no quieran mapear a mano).
export const ETIQUETA_NIVEL: Record<NivelDificultad, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

export const NIVELES: NivelDificultad[] = ['basico', 'intermedio', 'avanzado'];

/**
 * Clasifica el NIVEL INICIAL del estudiante a partir del puntaje del pretest
 * (0-100). Alineado con la clasificación legible Bajo/Medio/Alto ya existente:
 * <40 Básico, 40–70 Intermedio, >70 Avanzado.
 */
export function clasificarNivel(puntaje: number): NivelDificultad {
  if (puntaje < 40) return 'basico';
  if (puntaje <= 70) return 'intermedio';
  return 'avanzado';
}

/**
 * Deriva el NIVEL de dificultad adaptativo desde las estrellas (1-5) del
 * ejercicio: ★1-2 = Básico, ★3 = Intermedio, ★4-5 = Avanzado. Misma regla que
 * usa el seed; se comparte para que el contenido creado por el docente quede
 * clasificado de forma consistente (y con una dificultad b IRT coherente).
 */
export function nivelDesdeEstrellas(estrellas: number): NivelDificultad {
  if (estrellas <= 2) return 'basico';
  if (estrellas === 3) return 'intermedio';
  return 'avanzado';
}

/** Nivel inmediatamente superior, o null si ya está en Avanzado. */
export function siguienteNivel(n: NivelDificultad): NivelDificultad | null {
  if (n === 'basico') return 'intermedio';
  if (n === 'intermedio') return 'avanzado';
  return null;
}

/** Nivel inmediatamente inferior, o null si ya está en Básico (para fallback). */
export function nivelInferior(n: NivelDificultad): NivelDificultad | null {
  if (n === 'avanzado') return 'intermedio';
  if (n === 'intermedio') return 'basico';
  return null;
}

/** ¿`a` es de igual o mayor dificultad que `b`? */
export function nivelAlMenos(a: NivelDificultad, b: NivelDificultad): boolean {
  return ORDEN_NIVEL[a] >= ORDEN_NIVEL[b];
}

/**
 * DOMINIO AGREGADO de una unidad. Combina (promedia) el NIVEL del estudiante en
 * TODOS los temas de la unidad — refleja su habilidad estimada (θ, IRT), NO el
 * progreso de ejercicios (ese es un dato aparte). Cada tema aporta un score en
 * [0,1] según su nivel: score = (orden(nivel) − 1) / 2.
 *  · Básico → 0 · Intermedio → 0.5 · Avanzado → 1
 *  · Todos los temas en Básico     → 0   → dominio Básico   (NO desbloquea la siguiente unidad).
 *  · Todos los temas en Intermedio → 50  → dominio Intermedio (ya puede avanzar).
 *  · Todos los temas en Avanzado   → 100 → dominio Avanzado.
 * El dominio (0-100) es el promedio de los scores. Así, si el estudiante está en
 * Avanzado en sus temas, el dominio NO puede ser Básico (coherencia nivel↔dominio).
 */
export function nivelDominioAgregado(
  niveles: NivelDificultad[],
): { dominioPct: number; nivelDominio: NivelDificultad } {
  if (niveles.length === 0) return { dominioPct: 0, nivelDominio: 'basico' };
  const suma = niveles.reduce((acc, n) => acc + (ORDEN_NIVEL[n] - 1) / 2, 0);
  const dominioPct = Math.round((suma / niveles.length) * 100);
  return { dominioPct, nivelDominio: clasificarDominio(dominioPct) };
}

/**
 * Clasifica el DOMINIO agregado (0-100) en un nivel. Umbrales alineados con los
 * scores por nivel (Básico 0 / Intermedio 50 / Avanzado 100): todo en Básico (0)
 * queda `basico`; alcanzar el promedio de Intermedio (≥34) desbloquea la
 * siguiente unidad; el promedio de Avanzado (≥67) queda `avanzado`.
 */
export function clasificarDominio(dominioPct: number): NivelDificultad {
  if (dominioPct < 34) return 'basico';
  if (dominioPct < 67) return 'intermedio';
  return 'avanzado';
}

/** Factor de XP (porcentaje) según el nivel del ejercicio. Básico = 100%. */
export function factorXpNivel(
  nivel: NivelDificultad,
  cfg: { xpFactorIntermedio: number; xpFactorAvanzado: number },
): number {
  if (nivel === 'intermedio') return cfg.xpFactorIntermedio / 100;
  if (nivel === 'avanzado') return cfg.xpFactorAvanzado / 100;
  return 1;
}
