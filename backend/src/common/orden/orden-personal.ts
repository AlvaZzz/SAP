import { mulberry32 } from '../estadistica/bootstrap';

/**
 * ORDEN PERSONAL DE LAS PREGUNTAS.
 *
 * Dos estudiantes del mismo nivel reciben las MISMAS preguntas, pero no en el
 * mismo orden: así "la 3 es la B" no le sirve al compañero de al lado. El orden
 * de cada estudiante es ESTABLE (sale de su id), de modo que al recargar la
 * página o volver mañana encuentra sus preguntas donde las dejó.
 */

/** Semilla reproducible a partir del estudiante y del contexto (tema, unidad…). */
export function semillaDe(usuarioId: number, ...contexto: number[]): number {
  let h = 2166136261 ^ usuarioId;
  for (const n of contexto) h = Math.imul(h ^ n, 16777619);
  return Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
}

/** Baraja (Fisher–Yates) sin tocar la lista original. Misma semilla → mismo orden. */
export function barajar<T>(items: readonly T[], semilla: number): T[] {
  const rnd = mulberry32(semilla);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Orden propio de un estudiante dentro de un contexto. */
export const ordenPersonal = <T>(items: readonly T[], usuarioId: number, ...contexto: number[]): T[] =>
  barajar(items, semillaDe(usuarioId, ...contexto));

/** Baraja distinta en cada llamada (exámenes: cada intento sale en otro orden). */
export const barajarAlAzar = <T>(items: readonly T[]): T[] => barajar(items, Math.floor(Math.random() * 0xffffffff));

/**
 * Baraja DENTRO de cada grupo, conservando el orden de los grupos. Sirve para
 * el diagnóstico, que se presenta tema por tema.
 */
export function ordenPersonalPorGrupo<T>(items: readonly T[], grupo: (x: T) => number | null, usuarioId: number): T[] {
  const grupos = new Map<number | null, T[]>();
  for (const x of items) {
    const k = grupo(x);
    grupos.set(k, [...(grupos.get(k) ?? []), x]);
  }
  return [...grupos.entries()].flatMap(([k, xs]) => ordenPersonal(xs, usuarioId, k ?? 0));
}
