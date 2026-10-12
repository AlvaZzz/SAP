import { TipoEjercicio } from '@prisma/client';

/**
 * Tipos de ejercicio que dan una buena flashcard (pregunta → respuesta).
 * `ordenar_lineas` queda fuera: su respuesta es un orden, no un concepto.
 */
export const TIPOS_FLASHCARD: TipoEjercicio[] = ['opcion_multiple', 'predecir_salida', 'completar_codigo'];

type OpcionJson = { id: string; texto: string };

export interface EjercicioBase {
  tipo: TipoEjercicio;
  enunciado: string;
  opciones: unknown;
  respuestaCorrecta: string;
  explicacionIa: string | null;
  codigoPython: string | null;
}

/** Texto de la respuesta correcta tal como debe leerse en el reverso; null si el tipo no aplica. */
export function reversoDe(ej: Pick<EjercicioBase, 'tipo' | 'opciones' | 'respuestaCorrecta'>): string | null {
  if (ej.tipo === 'opcion_multiple' || ej.tipo === 'predecir_salida') {
    const ops = Array.isArray(ej.opciones) ? (ej.opciones as OpcionJson[]) : [];
    const correcta = ops.find((o) => (o?.id ?? '').trim().toUpperCase() === ej.respuestaCorrecta.trim().toUpperCase());
    return correcta?.texto ?? ej.respuestaCorrecta;
  }
  // Puede traer variantes equivalentes separadas por "|": se muestra la primera.
  if (ej.tipo === 'completar_codigo') return ej.respuestaCorrecta.split('|')[0].trim();
  return null;
}

/** Flashcard que sale directamente de un ejercicio, sin intervención de la IA. */
export function derivarFlashcard(ej: EjercicioBase): { frente: string; reverso: string; explicacion: string | null; codigoPython: string | null } | null {
  const reverso = reversoDe(ej);
  if (reverso == null) return null;
  return { frente: ej.enunciado, reverso, explicacion: ej.explicacionIa, codigoPython: ej.codigoPython };
}
