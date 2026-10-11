/**
 * Utilidades de TENDENCIA compartidas.
 *
 * Las usan la vista de progreso del estudiante (hábitos: autonomía y eficiencia)
 * y la exportación del investigador (mismas variables, para poder cruzar hábitos
 * con el uso del sistema). Viven en common/ porque el cálculo debe ser
 * IDÉNTICO en ambos sitios: si divergen, el dato que ve el estudiante y el que
 * analiza la tesis dejarían de significar lo mismo.
 *
 * La tendencia se mide sobre BLOQUES/MITADES del historial de intentos del
 * estudiante, no sobre semanas naturales: quien practica a ráfagas deja semanas
 * vacías y la serie por calendario se vuelve ilegible. Lo que interesa es
 * "conforme avanzo, ¿cómo cambio?".
 */

/** En cuántos tramos cronológicos se parte el historial para dibujar la tendencia. */
export const BLOQUES_TENDENCIA = 5;
/** Por debajo de esto, una "tendencia" sería ruido y se informa como sin_datos. */
export const MIN_INTENTOS_TENDENCIA = 6;

export type Tendencia = 'baja' | 'sube' | 'estable' | 'sin_datos';

export const promedio = (v: number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
export const redondear = (n: number, dec: number): number => Number(n.toFixed(dec));

/** Parte una lista en `n` tramos consecutivos lo más parejos posible (sin tramos vacíos). */
export function trocear<T>(items: T[], n: number): T[][] {
  if (items.length === 0) return [];
  const tramos = Math.min(n, items.length);
  const tam = items.length / tramos;
  return Array.from({ length: tramos }, (_, i) => items.slice(Math.round(i * tam), Math.round((i + 1) * tam)));
}

/** Cuánto cambió la segunda mitad del historial respecto de la primera. */
export function deltaMitades(valores: number[]): number {
  const corte = Math.floor(valores.length / 2);
  return promedio(valores.slice(corte)) - promedio(valores.slice(0, corte));
}

/** Clasifica un delta contra un umbral de ruido (por debajo del umbral: 'estable'). */
export function clasificar(delta: number, umbral: number, siBaja: Tendencia, siSube: Tendencia): Tendencia {
  if (delta < -umbral) return siBaja;
  if (delta > umbral) return siSube;
  return 'estable';
}
