/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  INSTRUMENTO: MOTIVACIÓN ACADÉMICA (escala Likert 1–5)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  POR QUÉ EXISTE
 *  La tesis declara la motivación académica como dimensión de una VARIABLE
 *  DEPENDIENTE, operacionalizada mediante un cuestionario Likert. Hasta ahora el
 *  sistema no tenía forma de aplicarlo ni de almacenarlo, así que esa mitad de
 *  la hipótesis quedaba sin medir.
 *
 *  ⚠️ ADVERTENCIA METODOLÓGICA — LÉELA ANTES DE APLICARLO
 *
 *  Este conjunto de ítems NO es una escala validada. Está redactado a partir de
 *  las dimensiones que la propia tesis declara (interés y satisfacción) y sirve
 *  como CONTENEDOR funcional: el sistema aplica, guarda, puntúa y analiza. Pero
 *  un instrumento sin evidencia de validez previa es atacable en una defensa.
 *
 *  Lo recomendable es sustituir estos ítems por los de una escala YA VALIDADA en
 *  población hispanohablante (por ejemplo una adaptación del MSLQ de Pintrich et
 *  al., o de la Escala de Motivación Académica de Vallerand), citando la fuente
 *  en el marco metodológico. La estructura de este archivo está pensada para que
 *  ese reemplazo sea cambiar esta lista y subir `VERSION_INSTRUMENTO`, sin tocar
 *  nada más.
 *
 *  En cualquier caso, el sistema calcula el ALFA DE CRONBACH sobre las
 *  respuestas reales, así que la fiabilidad del instrumento —sea este o uno
 *  adaptado— queda reportada con datos y no supuesta.
 *
 *  SOBRE LOS ÍTEMS INVERSOS
 *  Algunos ítems están redactados en negativo a propósito: rompen la tendencia a
 *  responder en piloto automático marcando siempre la misma columna. Se
 *  recodifican al puntuar (6 − valor), nunca al guardar: el dato crudo queda
 *  intacto y auditable.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Versión del instrumento. Subir SIEMPRE que cambien los ítems: las respuestas
 *  guardan su versión y así no se mezclan aplicaciones distintas en un análisis. */
export const VERSION_INSTRUMENTO = '2026-08-v1';

/** Puntuación mínima y máxima de la escala Likert. */
export const LIKERT_MIN = 1;
export const LIKERT_MAX = 5;

export type DimensionMotivacion = 'interes' | 'satisfaccion' | 'competitividad';

export interface ItemEncuesta {
  id: string;
  texto: string;
  dimension: DimensionMotivacion;
  /** true = redactado en negativo; se recodifica (6 − valor) al puntuar. */
  inverso?: boolean;
}

export const ETIQUETA_DIMENSION: Record<DimensionMotivacion, string> = {
  interes: 'Interés por la materia',
  satisfaccion: 'Satisfacción con el aprendizaje',
  competitividad: 'Competitividad y comparación con pares',
};

/** Anclajes de la escala, los mismos que ve el estudiante en pantalla. */
export const ANCLAJES: { valor: number; etiqueta: string }[] = [
  { valor: 1, etiqueta: 'Totalmente en desacuerdo' },
  { valor: 2, etiqueta: 'En desacuerdo' },
  { valor: 3, etiqueta: 'Ni de acuerdo ni en desacuerdo' },
  { valor: 4, etiqueta: 'De acuerdo' },
  { valor: 5, etiqueta: 'Totalmente de acuerdo' },
];

export const ITEMS: ItemEncuesta[] = [
  // ── Interés por la materia ──
  { id: 'int1', dimension: 'interes', texto: 'Programar me resulta interesante.' },
  { id: 'int2', dimension: 'interes', texto: 'Tengo ganas de aprender más sobre programación de las que tenía antes.' },
  { id: 'int3', dimension: 'interes', texto: 'Dedico tiempo a practicar programación aunque no me lo pidan.' },
  { id: 'int4', dimension: 'interes', texto: 'Las clases de programación se me hacen aburridas.', inverso: true },

  // ── Satisfacción con el aprendizaje ──
  { id: 'sat1', dimension: 'satisfaccion', texto: 'Estoy conforme con lo que estoy aprendiendo en esta materia.' },
  { id: 'sat2', dimension: 'satisfaccion', texto: 'Cuando resuelvo un ejercicio siento que realmente aprendí algo.' },
  { id: 'sat3', dimension: 'satisfaccion', texto: 'Siento que estoy avanzando a un ritmo adecuado para mí.' },
  { id: 'sat4', dimension: 'satisfaccion', texto: 'Me frustro con frecuencia cuando estudio programación.', inverso: true },

  // ── Competitividad (la tesis la nombra explícitamente en la hipótesis) ──
  { id: 'com1', dimension: 'competitividad', texto: 'Ver mi posición frente a mis compañeros me motiva a esforzarme más.' },
  { id: 'com2', dimension: 'competitividad', texto: 'Me propongo metas para mejorar mi desempeño en la materia.' },
  { id: 'com3', dimension: 'competitividad', texto: 'Comparar mi avance con el de otros me desanima.', inverso: true },
];

/** Puntuación de un ítem, recodificando los inversos. */
export function puntuar(item: ItemEncuesta, valor: number): number {
  return item.inverso ? LIKERT_MIN + LIKERT_MAX - valor : valor;
}

/** Ítem por id (o undefined si el id no pertenece a este instrumento). */
export function itemPorId(id: string): ItemEncuesta | undefined {
  return ITEMS.find((i) => i.id === id);
}

export const DIMENSIONES: DimensionMotivacion[] = ['interes', 'satisfaccion', 'competitividad'];

/**
 * Nota que acompaña a cualquier resultado de esta escala. Se muestra en el rol
 * investigador para que el dato nunca se presente sin su advertencia.
 */
export const NOTA_INSTRUMENTO =
  'Escala Likert de 1 a 5 con ' + ITEMS.length + ' ítems en tres dimensiones. Los ítems inversos se ' +
  'recodifican al puntuar (6 − valor); el dato crudo se conserva sin modificar. ATENCIÓN: este ' +
  'conjunto de ítems no procede de una escala previamente validada, así que su validez de contenido ' +
  'debe justificarse o sustituirse por una escala validada antes de reportar resultados. Su ' +
  'fiabilidad SÍ se calcula con datos reales (alfa de Cronbach).';
