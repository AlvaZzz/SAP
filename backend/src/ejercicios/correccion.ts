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

/** ordenar_lineas: lista de ids separados por coma (case/espacios). */
function listaOrden(s: string): string[] {
  return s.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
}

/** Parte un fragmento de código en piezas comparables: palabras, números y símbolos. */
function piezas(s: string): string[] {
  return normCodigo(s).match(/[a-záéíóúñ_][a-záéíóúñ_0-9]*|\d+(?:\.\d+)?|'[^']*'|[^\s]/gi) ?? [];
}

/** Longitud de la subsecuencia común más larga (piezas correctas y en orden). */
function lcs(a: string[], b: string[]): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export type EstadoCorreccion = 'correcta' | 'parcial' | 'incorrecta';

/**
 * Resultado GRADUADO de una corrección.
 *
 *  · correcta   → puntaje 1.
 *  · parcial    → puntaje entre 0 y 1: parte de la respuesta está bien.
 *  · incorrecta → puntaje 0.
 *
 * En los EJERCICIOS de práctica una respuesta parcial muestra qué falta y el
 * estudiante puede complementarla y reenviar. En los EXÁMENES no se puede
 * complementar: se registra el puntaje parcial y con él se calcula la nota.
 */
export interface ResultadoCorreccion {
  estado: EstadoCorreccion;
  /** Fracción de la pregunta obtenida (0..1). */
  puntaje: number;
  /** Qué le faltó, sin revelar la respuesta. */
  faltantes: string[];
  retroalimentacion: string;
}

/** Por debajo de esta fracción una respuesta no es "parcial": es incorrecta. */
export const MINIMO_PARCIAL = 0.5;

const CORRECTA: ResultadoCorreccion = { estado: 'correcta', puntaje: 1, faltantes: [], retroalimentacion: '¡Correcto!' };
const INCORRECTA: ResultadoCorreccion = { estado: 'incorrecta', puntaje: 0, faltantes: [], retroalimentacion: 'La respuesta no es correcta.' };
const redondear = (v: number) => Math.round(v * 100) / 100;

function graduar(fraccion: number, faltantes: string[], detalle: string): ResultadoCorreccion {
  if (fraccion >= 1) return CORRECTA;
  if (fraccion < MINIMO_PARCIAL) return { ...INCORRECTA, faltantes };
  return { estado: 'parcial', puntaje: redondear(fraccion), faltantes, retroalimentacion: detalle };
}

/**
 * Corrige una respuesta según el TIPO de ejercicio y devuelve un resultado
 * graduado. Toda la calificación vive en el backend (nunca se confía en el cliente).
 *
 *  - opcion_multiple / predecir_salida: se elige UNA opción → correcta o incorrecta.
 *  - completar_codigo: insensible a mayúsculas y espacios; admite variantes
 *    separadas por "|". Si la respuesta tiene varias piezas (p. ej.
 *    `for i in range(10)`), el puntaje es la proporción de piezas correctas y en
 *    orden respecto de la variante más parecida.
 *  - ordenar_lineas: ids de línea separados por coma. El puntaje es la proporción
 *    de líneas colocadas en su posición correcta.
 */
export function corregirGraduado(tipo: TipoEjercicio, respuestaDada: string, respuestaCorrecta: string): ResultadoCorreccion {
  switch (tipo) {
    case 'completar_codigo': {
      const dado = normCodigo(respuestaDada);
      if (!dado) return INCORRECTA;
      const variantes = respuestaCorrecta.split('|');
      if (variantes.some((v) => normCodigo(v) === dado)) return CORRECTA;

      const piezasDadas = piezas(respuestaDada);
      let mejor = { fraccion: 0, total: 0, bien: 0 };
      for (const v of variantes) {
        const esperadas = piezas(v);
        // Una respuesta de una sola pieza (un término, un número) no admite "a medias".
        if (esperadas.length < 2) continue;
        const bien = lcs(esperadas, piezasDadas);
        // Las piezas de más también restan: escribir todo "por si acaso" no debe puntuar.
        const fraccion = bien / Math.max(esperadas.length, piezasDadas.length);
        if (fraccion > mejor.fraccion) mejor = { fraccion, total: esperadas.length, bien };
      }
      const faltan = mejor.total - mejor.bien;
      return graduar(
        mejor.fraccion,
        faltan > 0 ? [`${faltan} parte(s) de la respuesta`] : ['Sobra algo en tu respuesta'],
        `Vas bien: ${mejor.bien} de ${mejor.total} partes de tu respuesta son correctas. ` +
          (faltan > 0 ? `Te falta ajustar ${faltan}.` : 'Revisa lo que sobra.'),
      );
    }

    case 'ordenar_lineas': {
      const dada = listaOrden(respuestaDada);
      const correcta = listaOrden(respuestaCorrecta);
      if (dada.length === 0 || correcta.length === 0) return INCORRECTA;
      if (dada.join(',') === correcta.join(',')) return CORRECTA;
      // Debe usar exactamente las mismas líneas; si no, no hay nada que graduar.
      if (dada.length !== correcta.length || [...dada].sort().join(',') !== [...correcta].sort().join(',')) return INCORRECTA;
      const malas = correcta.map((id, i) => (dada[i] === id ? 0 : i + 1)).filter((p) => p > 0);
      const bien = correcta.length - malas.length;
      return graduar(
        bien / correcta.length,
        malas.map((p) => `la línea en la posición ${p}`),
        `${bien} de ${correcta.length} líneas están en su lugar. Revisa ${malas.length === 1 ? 'la posición' : 'las posiciones'} ${malas.join(', ')}.`,
      );
    }

    case 'opcion_multiple':
    case 'predecir_salida':
    default:
      return normSimple(respuestaDada) === normSimple(respuestaCorrecta) ? CORRECTA : INCORRECTA;
  }
}

/** ¿La respuesta es totalmente correcta? (atajo de `corregirGraduado`). */
export function corregir(tipo: TipoEjercicio, respuestaDada: string, respuestaCorrecta: string): boolean {
  return corregirGraduado(tipo, respuestaDada, respuestaCorrecta).estado === 'correcta';
}
