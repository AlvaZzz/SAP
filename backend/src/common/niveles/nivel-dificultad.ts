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
 * ⚠️ NO AGREGUES AQUÍ UNA FUNCIÓN QUE CLASIFIQUE AL ESTUDIANTE POR PORCENTAJE.
 *
 * Existió una `clasificarNivel(puntaje)` con cortes en 40/70 sobre el % del
 * pretest. Se eliminó el 2026-08-07 porque era código muerto que contradecía a
 * la ÚNICA regla válida: `nivelDesdeTheta(θ)` en `mediciones/irt/irt.ts`.
 *
 * El estudiante se clasifica SIEMPRE por su habilidad θ estimada con el modelo
 * de Rasch, nunca por el porcentaje de aciertos. Motivo (ver
 * docs/CLASIFICACION_NIVELES.md): un porcentaje depende de la dificultad de la
 * prueba concreta —60 % en un examen fácil no equivale a 60 % en uno difícil—,
 * mientras que θ vive en la misma escala logit que la dificultad b de los ítems
 * y por tanto expresa qué puede resolver la persona.
 */

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
 * Clasifica el DOMINIO agregado (0-100) de una unidad en un nivel.
 *
 * ⚠️ ESTO NO CLASIFICA AL ESTUDIANTE. Clasifica un PROMEDIO DE NIVELES ya
 * asignados, que es otra cosa. La clasificación de la persona la hace
 * `nivelDesdeTheta(θ)` y solo ella.
 *
 * POR QUÉ 34 Y 67 NO SON UN TERCIL ARBITRARIO
 * ────────────────────────────────────────────
 * La escala de dominio no es un porcentaje de aciertos: se construye
 * promediando los niveles de los temas, donde cada nivel vale exactamente
 * Básico = 0 · Intermedio = 0.5 · Avanzado = 1 (ver `nivelDominioAgregado`).
 *
 * Esa escala tiene TRES puntos de anclaje sustantivos, no un continuo:
 *   · 0   = todos los temas en Básico
 *   · 50  = todos los temas en Intermedio
 *   · 100 = todos los temas en Avanzado
 *
 * Los cortes en 34 y 67 son simplemente los puntos medios entre esos anclajes
 * (0↔50 → 25… se elige 34, y 50↔100 → 75… se elige 67), de modo que la partición
 * en tercios AQUÍ sí es la natural: cada tercio contiene uno de los tres valores
 * de anclaje y ninguno queda en la frontera. Es una consecuencia aritmética de
 * la codificación 0/0.5/1, no una elección de conveniencia.
 *
 * Contrasta con clasificar a un estudiante por su % de aciertos, donde los
 * tercios SÍ serían arbitrarios porque no hay ningún anclaje sustantivo en 33
 * ni en 66. Ver docs/CLASIFICACION_NIVELES.md, sección "Por qué no tercios".
 *
 * Efecto práctico: alcanzar el promedio de Intermedio (≥34) desbloquea la
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
