import { TipoEjercicio } from '@prisma/client';

/** Normaliza una respuesta de opción/predicción: trim + mayúsculas. */
function normSimple(s: string): string {
  return s.trim().toUpperCase();
}

/**
 * completar_codigo: colapsa espacios, unifica comillas e ignora MAYÚSCULAS.
 *
 * Buena parte del banco pide completar un TÉRMINO en una frase ("…se llama
 * ______." → "finitud") o una palabra reservada del pseudocódigo ("Const"). Exigir
 * la capitalización exacta marcaría como error una respuesta conceptualmente
 * correcta solo por escribirla al inicio de la frase. La leniencia también aplica
 * al código (`True`/`true`), que es preferible a fallar por un detalle de forma.
 */
function normCodigo(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/"/g, "'").toLowerCase();
}

/** ordenar_lineas: normaliza la lista de ids separados por coma (case/espacios). */
function normOrden(s: string): string {
  return s.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean).join(',');
}

/**
 * Corrige una respuesta según el TIPO de ejercicio. Toda la calificación vive
 * en el backend (nunca se confía en el cliente).
 *
 *  - opcion_multiple / predecir_salida: comparación exacta (case-insensitive).
 *  - completar_codigo: comparación insensible a mayúsculas y a espacios; admite
 *    variantes equivalentes separadas por "|" en `respuestaCorrecta` (ej.
 *    "for i in range(10)|for i in range(0,10)").
 *    TODO: si el banco pasa a traer variantes separadas por COMA, normalizar ese
 *    separador aquí (hoy solo se soporta "|", que es el formato sembrado).
 *  - ordenar_lineas: `respuestaCorrecta` y la respuesta del estudiante son ids
 *    de línea separados por coma, en el orden propuesto (ej. "B,A,D,C").
 */
export function corregir(tipo: TipoEjercicio, respuestaDada: string, respuestaCorrecta: string): boolean {
  switch (tipo) {
    case 'completar_codigo': {
      const dado = normCodigo(respuestaDada);
      return respuestaCorrecta.split('|').some((variante) => normCodigo(variante) === dado);
    }
    case 'ordenar_lineas':
      return normOrden(respuestaDada) === normOrden(respuestaCorrecta);
    case 'opcion_multiple':
    case 'predecir_salida':
    default:
      return normSimple(respuestaDada) === normSimple(respuestaCorrecta);
  }
}
