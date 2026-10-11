/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESCALA DE USABILIDAD DEL SISTEMA (SUS) — Brooke (1996)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Diez afirmaciones, Likert de 1 (totalmente en desacuerdo) a 5 (totalmente de
 *  acuerdo), con polaridad alterna: los ítems IMPARES son positivos y los PARES
 *  negativos. Se aplica UNA sola vez, al final del período de uso.
 *
 *  PUNTUACIÓN (Brooke, 1996):
 *      ítem impar → r − 1          ítem par → 5 − r
 *      SUS = (suma de las 10 contribuciones) × 2,5        → 0 a 100
 *
 *  El resultado NO es un porcentaje: 72 no significa "usable en un 72 %", sino
 *  que cae en el rango que la escala adjetival califica como bueno.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const VERSION_SUS = 'SUS-es-1';
export const SUS_MIN = 1;
export const SUS_MAX = 5;

export interface ItemSus {
  /** Identificador estable del ítem (S01…S10). */
  id: string;
  numero: number;
  texto: string;
}

export const ITEMS_SUS: ItemSus[] = [
  { id: 'S01', numero: 1, texto: 'Creo que me gustaría usar PREXI con frecuencia.' },
  { id: 'S02', numero: 2, texto: 'Encontré PREXI innecesariamente complejo.' },
  { id: 'S03', numero: 3, texto: 'Pensé que PREXI era fácil de usar.' },
  { id: 'S04', numero: 4, texto: 'Creo que necesitaría el apoyo de una persona técnica para poder usar PREXI.' },
  { id: 'S05', numero: 5, texto: 'Encontré que las distintas funciones de PREXI estaban bien integradas.' },
  { id: 'S06', numero: 6, texto: 'Pensé que había demasiada inconsistencia en PREXI.' },
  { id: 'S07', numero: 7, texto: 'Imagino que la mayoría de las personas aprendería a usar PREXI muy rápido.' },
  { id: 'S08', numero: 8, texto: 'Encontré PREXI muy incómodo de usar.' },
  { id: 'S09', numero: 9, texto: 'Me sentí muy seguro(a) usando PREXI.' },
  { id: 'S10', numero: 10, texto: 'Necesité aprender muchas cosas antes de poder empezar a usar PREXI.' },
];

/**
 * Puntaje SUS (0–100) a partir de las respuestas { itemId → valor 1..5 }.
 * Devuelve null si falta algún ítem o hay un valor fuera de rango: un
 * cuestionario incompleto no se puntúa (rellenarlo inventaría evidencia).
 */
export function puntajeSus(respuestas: Record<string, number>): number | null {
  let suma = 0;
  for (const item of ITEMS_SUS) {
    const r = respuestas[item.id];
    if (!Number.isInteger(r) || r < SUS_MIN || r > SUS_MAX) return null;
    suma += item.numero % 2 === 1 ? r - 1 : 5 - r;
  }
  return suma * 2.5;
}

export interface CalificativoSus {
  calificativo: 'Deficiente' | 'Aceptable con reservas' | 'Bueno' | 'Excelente';
  lectura: string;
}

/**
 * Escala adjetival adaptada de Bangor et al. (2009), con los cortes de la
 * Tabla 2 del Capítulo III de la tesis. 68 es el promedio de referencia
 * habitual en la literatura.
 */
export function interpretarSus(puntaje: number): CalificativoSus {
  if (puntaje < 51) {
    return { calificativo: 'Deficiente', lectura: 'La interfaz presenta problemas que comprometen el uso del sistema.' };
  }
  if (puntaje < 69) {
    return { calificativo: 'Aceptable con reservas', lectura: 'El sistema es utilizable, pero requiere ajustes en la interacción.' };
  }
  if (puntaje <= 80) {
    return { calificativo: 'Bueno', lectura: 'La interacción resulta satisfactoria para el usuario.' };
  }
  return { calificativo: 'Excelente', lectura: 'El sistema alcanza un nivel destacado de usabilidad percibida.' };
}
