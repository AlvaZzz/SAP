// ════════════════════════════════════════════════════════════════════════════
//  EQUILIBRADO DE LA CLAVE DE RESPUESTAS
//
//  Problema que resuelve (defecto de instrumento, no de interfaz): si la opción
//  correcta se concentra en una posición, el ítem deja de medir conocimiento.
//  Un estudiante que marque siempre la misma letra obtiene una puntuación alta
//  sin dominar el contenido, lo que contamina θ (IRT), el nivel adaptativo
//  asignado y la comparación pre/post. La clave debe repartirse de forma
//  aproximadamente uniforme entre todas las posiciones de cada banco.
//
//  Propiedades del algoritmo (relevantes para documentarlo en la tesis):
//   · DETERMINISTA: misma semilla + mismos ítems ⇒ misma disposición. Reproducible.
//   · INDEPENDIENTE DEL ORDEN de entrada: la posición de destino depende solo de
//     la identidad del ítem (`clave`), no de su índice. Por eso el seed (que lee
//     JSON/TS) y la migración (que lee la BD) producen EXACTAMENTE lo mismo.
//   · EXACTAMENTE EQUILIBRADO: reparto round-robin sobre un orden pseudoaleatorio,
//     así cada posición recibe ⌊n/k⌋ o ⌈n/k⌉ ítems (no una uniformidad "en promedio").
//   · IDEMPOTENTE: aplicarlo dos veces deja el banco igual.
//
//  La clave correcta SIEMPRE viaja con su opción: `reubicar()` mueve el texto y
//  devuelve el nuevo índice; ninguna capa superior recalcula la clave por su cuenta.
// ════════════════════════════════════════════════════════════════════════════

/**
 * SEMILLA oficial del equilibrado de bancos. Fijarla (y no cambiarla) es lo que
 * hace el reordenamiento reproducible y documentable en la tesis: cualquiera
 * puede regenerar exactamente la misma disposición de opciones a partir del
 * contenido fuente. Cambiarla reordenaría todo el banco de nuevo.
 */
export const SEMILLA_BANCO = 'prexi-clave-v1';

/** Etiquetas de opción por posición. El índice 0 es siempre "A". */
export const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

/** FNV-1a de 32 bits: hash estable entre ejecuciones, versiones de Node y plataformas. */
function fnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Identidad estable de un ítem, INVARIANTE al reordenamiento de sus opciones
 * (los textos se ordenan antes de mezclarse con el enunciado). Esa invariancia
 * es lo que hace idempotente al equilibrado: reordenar no cambia la identidad,
 * así que el destino calculado tampoco cambia.
 */
export function claveEstable(enunciado: string, textosOpciones: string[]): string {
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
  return [norm(enunciado), ...textosOpciones.map(norm).sort()].join('\u0001');
}

export interface EntradaClave<O> {
  /** Identidad estable del ítem (ver `claveEstable`). */
  clave: string;
  opciones: O[];
  /** Índice de la opción correcta dentro de `opciones`. */
  correcta: number;
}

export interface SalidaClave<O> {
  opciones: O[];
  correcta: number;
}

/**
 * Mueve la opción correcta a la posición `destino` conservando el orden relativo
 * de los distractores. Devuelve el nuevo índice de la correcta: la clave nunca
 * se deduce fuera de aquí.
 */
export function reubicar<O>(opciones: O[], correcta: number, destino: number): SalidaClave<O> {
  if (!Number.isInteger(correcta) || correcta < 0 || correcta >= opciones.length) {
    throw new RangeError(`índice de respuesta correcta fuera de rango: ${correcta} (opciones: ${opciones.length})`);
  }
  const d = Math.min(Math.max(destino, 0), opciones.length - 1);
  const arr = [...opciones];
  const [op] = arr.splice(correcta, 1);
  arr.splice(d, 0, op);
  return { opciones: arr, correcta: d };
}

/**
 * Equilibra la posición de la clave en un conjunto de ítems.
 *
 * Los ítems se agrupan por número de opciones (un banco puede mezclar ítems de
 * 3 y de 4). Dentro de cada grupo se ordenan por el hash de su identidad —orden
 * pseudoaleatorio pero fijo— y se les reparten las posiciones en round-robin,
 * lo que garantiza el equilibrio exacto sin que la posición sea predecible a
 * partir del orden en que se presentan los ítems.
 *
 * Devuelve un resultado por ítem, en el MISMO orden de entrada. No muta la entrada.
 */
export function equilibrarClaves<O>(entradas: EntradaClave<O>[], semilla: string): SalidaClave<O>[] {
  const salida: SalidaClave<O>[] = entradas.map((e) => ({ opciones: [...e.opciones], correcta: e.correcta }));

  const grupos = new Map<number, number[]>();
  entradas.forEach((e, i) => {
    const k = e.opciones.length;
    if (k < 2) return; // nada que reordenar
    const g = grupos.get(k);
    if (g) g.push(i);
    else grupos.set(k, [i]);
  });

  for (const [k, indices] of grupos) {
    const orden = [...indices].sort((a, b) => {
      const ha = fnv1a(`${semilla}\u0000${entradas[a].clave}`);
      const hb = fnv1a(`${semilla}\u0000${entradas[b].clave}`);
      if (ha !== hb) return ha - hb;
      // Desempate por la propia clave: dos ítems idénticos siguen siendo estables.
      if (entradas[a].clave !== entradas[b].clave) return entradas[a].clave < entradas[b].clave ? -1 : 1;
      return a - b;
    });
    // Desplazamiento inicial derivado de la semilla: distintos bancos no arrancan
    // todos por la posición A.
    const offset = fnv1a(`${semilla}\u0000k${k}`) % k;
    orden.forEach((idx, pos) => {
      salida[idx] = reubicar(entradas[idx].opciones, entradas[idx].correcta, (pos + offset) % k);
    });
  }

  return salida;
}

// Alias de tipo (no `interface`): así conserva la firma de índice implícita que
// Prisma exige para asignarlo a una columna Json sin castear en cada llamada.
export type OpcionLetra = {
  id: string;
  texto: string;
};

export interface ItemLetra {
  enunciado: string;
  opciones: OpcionLetra[];
  /** Letra de la opción correcta ("A".."D"). */
  respuestaCorrecta: string;
}

export interface ResultadoLetra {
  opciones: OpcionLetra[];
  respuestaCorrecta: string;
  /** false si el ítem no se pudo procesar (clave que no apunta a ninguna opción). */
  aplicado: boolean;
}

/**
 * Variante para el formato que usan la BD y los bancos JSON: opciones
 * `{ id, texto }` con la clave como LETRA. Tras reubicar la correcta, los `id`
 * se reetiquetan A,B,C,D por posición y `respuestaCorrecta` pasa a ser la letra
 * de la nueva posición — texto y clave se mueven juntos, siempre.
 *
 * Solo debe llamarse con ítems cuya clave sea una letra de opción
 * (`opcion_multiple`, `predecir_salida`). NO con `ordenar_lineas` (la clave es
 * una secuencia "B,A,D,C") ni con `completar_codigo` (la clave es texto libre).
 */
export function equilibrarClavesLetras(items: ItemLetra[], semilla: string): ResultadoLetra[] {
  const indiceDe = (it: ItemLetra) => {
    const buscada = (it.respuestaCorrecta ?? '').trim().toUpperCase();
    return it.opciones.findIndex((o) => (o?.id ?? '').trim().toUpperCase() === buscada);
  };

  const procesables = items.map((it) => it.opciones?.length >= 2 && indiceDe(it) >= 0);
  const entradas: EntradaClave<OpcionLetra>[] = items.map((it, i) => ({
    clave: claveEstable(it.enunciado, (it.opciones ?? []).map((o) => o.texto)),
    opciones: procesables[i] ? it.opciones : [],
    correcta: procesables[i] ? indiceDe(it) : 0,
  }));

  return equilibrarClaves(entradas, semilla).map((r, i) => {
    if (!procesables[i]) {
      return { opciones: items[i].opciones, respuestaCorrecta: items[i].respuestaCorrecta, aplicado: false };
    }
    return {
      opciones: r.opciones.map((o, pos) => ({ ...o, id: LETRAS[pos] })),
      respuestaCorrecta: LETRAS[r.correcta],
      aplicado: true,
    };
  });
}

/** Recuento de la clave por posición (A,B,C,…), para auditar la distribución. */
export function distribucionClave(letras: string[]): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const l of letras) {
    const k = (l ?? '').trim().toUpperCase();
    conteo[k] = (conteo[k] ?? 0) + 1;
  }
  return conteo;
}
