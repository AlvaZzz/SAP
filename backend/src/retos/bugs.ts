import { TipoBug } from '@prisma/client';

/**
 * CATÁLOGO DE BUGS CONTROLADOS para los retos de depuración.
 *
 * Cada transformación toma el `codigoPython` YA VALIDADO de un ejercicio del banco
 * e introduce UN ÚNICO error localizado. No se inventa código: se altera mínimamente
 * el original, de modo que corregirlo devuelve exactamente la salida que el banco ya
 * declara como correcta.
 *
 * La selección es DETERMINISTA (hash del código de ejercicio como semilla), para que
 * regenerar el banco produzca siempre el mismo reto y el seed sea reproducible.
 */

export interface BugAplicado {
  tipo: TipoBug;
  codigo: string;
  /** Línea (1-indexada) donde quedó el error; alimenta las pistas. */
  linea: number;
  /** Descripción corta de qué se tocó, para la pista de nivel 2. */
  detalle: string;
}

/** PRNG con semilla (xorshift32): mismo código de ejercicio → misma elección. */
function semillaDesde(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

function siguiente(estado: { s: number }): number {
  let x = estado.s;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17;
  x ^= x << 5; x >>>= 0;
  estado.s = x || 1;
  return estado.s;
}

/** Solo se altera código real: se ignoran comentarios y cadenas de texto. */
function esLineaAlterable(linea: string): boolean {
  const t = linea.trim();
  return t.length > 0 && !t.startsWith('#');
}

type Transformacion = (lineas: string[], rnd: () => number) => BugAplicado | null;

/** Invierte un operador aritmético (+↔-, *↔/) en una asignación. */
const operadorAritmetico: Transformacion = (lineas) => {
  const pares: [RegExp, string][] = [[/ \+ /, ' - '], [/ - /, ' + '], [/ \* /, ' / '], [/ \/ /, ' * ']];
  for (let i = 0; i < lineas.length; i++) {
    if (!esLineaAlterable(lineas[i])) continue;
    // Solo en asignaciones: cambiar dentro de un print alteraría el enunciado.
    if (!/=/.test(lineas[i]) || /[=!<>]=/.test(lineas[i])) continue;
    for (const [re, rep] of pares) {
      if (re.test(lineas[i])) {
        const original = lineas[i];
        const copia = [...lineas];
        copia[i] = lineas[i].replace(re, rep);
        return {
          tipo: 'operador_aritmetico_invertido',
          codigo: copia.join('\n'),
          linea: i + 1,
          detalle: `se cambió el operador de «${original.trim()}»`,
        };
      }
    }
  }
  return null;
};

/** Invierte un operador relacional (>↔<, >=↔<=, ==↔!=). */
const operadorRelacional: Transformacion = (lineas) => {
  const pares: [RegExp, string][] = [
    [/>=/, '<='], [/<=/, '>='], [/==/, '!='], [/!=/, '=='], [/ > /, ' < '], [/ < /, ' > '],
  ];
  for (let i = 0; i < lineas.length; i++) {
    if (!esLineaAlterable(lineas[i])) continue;
    for (const [re, rep] of pares) {
      if (re.test(lineas[i])) {
        const copia = [...lineas];
        copia[i] = lineas[i].replace(re, rep);
        return {
          tipo: 'operador_relacional_invertido',
          codigo: copia.join('\n'),
          linea: i + 1,
          detalle: `se invirtió la comparación de «${lineas[i].trim()}»`,
        };
      }
    }
  }
  return null;
};

/** Corre un literal numérico en ±1 (error clásico de límite). */
const limiteRango: Transformacion = (lineas, rnd) => {
  for (let i = 0; i < lineas.length; i++) {
    if (!esLineaAlterable(lineas[i])) continue;
    const m = lineas[i].match(/\b(\d+)\b/);
    if (!m) continue;
    const valor = Number(m[1]);
    const delta = rnd() % 2 === 0 ? 1 : -1;
    const nuevo = valor + delta;
    if (nuevo < 0) continue;
    const copia = [...lineas];
    copia[i] = lineas[i].replace(new RegExp(`\\b${m[1]}\\b`), String(nuevo));
    return {
      tipo: 'limite_rango_corrido',
      codigo: copia.join('\n'),
      linea: i + 1,
      detalle: `un valor numérico de la línea ${i + 1} está corrido en ${delta > 0 ? '+1' : '-1'}`,
    };
  }
  return null;
};

/** Intercambia dos líneas consecutivas independientes (altera el orden de salida). */
const ordenLineas: Transformacion = (lineas) => {
  for (let i = 0; i < lineas.length - 1; i++) {
    const a = lineas[i], b = lineas[i + 1];
    if (!esLineaAlterable(a) || !esLineaAlterable(b)) continue;
    // Ambas deben ser prints: intercambiar asignaciones puede romper el programa
    // en vez de producir una salida distinta (y el reto dejaría de ser depurable).
    if (!/^\s*print\(/.test(a) || !/^\s*print\(/.test(b)) continue;
    if (a.trim() === b.trim()) continue;
    const copia = [...lineas];
    copia[i] = b; copia[i + 1] = a;
    return {
      tipo: 'orden_lineas_intercambiado',
      codigo: copia.join('\n'),
      linea: i + 1,
      detalle: `las líneas ${i + 1} y ${i + 2} están en el orden equivocado`,
    };
  }
  return null;
};

/** Sustituye una variable por otra existente en el mismo bloque. */
const variableTrocada: Transformacion = (lineas) => {
  const asignadas = new Set<string>();
  for (const l of lineas) {
    const m = l.match(/^\s*([A-Za-z_]\w*)\s*=(?!=)/);
    if (m) asignadas.add(m[1]);
  }
  if (asignadas.size < 2) return null;
  const nombres = [...asignadas];
  for (let i = 0; i < lineas.length; i++) {
    if (!esLineaAlterable(lineas[i])) continue;
    if (!/^\s*print\(/.test(lineas[i])) continue;
    for (const n of nombres) {
      if (!new RegExp(`\\b${n}\\b`).test(lineas[i])) continue;
      const otro = nombres.find((x) => x !== n);
      if (!otro) continue;
      const copia = [...lineas];
      copia[i] = lineas[i].replace(new RegExp(`\\b${n}\\b`), otro);
      return {
        tipo: 'variable_trocada',
        codigo: copia.join('\n'),
        linea: i + 1,
        detalle: `en la línea ${i + 1} se usa la variable equivocada`,
      };
    }
  }
  return null;
};

const TRANSFORMACIONES: Transformacion[] = [
  operadorAritmetico,
  operadorRelacional,
  limiteRango,
  ordenLineas,
  variableTrocada,
];

/**
 * Introduce UN bug en `codigoPython`. Determinista: la misma `semilla` (el código
 * del ejercicio, ej. "E1.5.I.06") produce siempre el mismo reto.
 *
 * Devuelve null si ninguna transformación aplica (código demasiado simple): ese
 * ejercicio no genera reto de depuración en vez de forzar un bug artificial.
 */
export function introducirBug(codigoPython: string, semilla: string): BugAplicado | null {
  const lineas = codigoPython.replace(/\s+$/, '').split('\n');
  if (lineas.length === 0) return null;

  const estado = { s: semillaDesde(semilla) };
  const rnd = () => siguiente(estado);

  // Se recorre el catálogo desde un punto de arranque que depende de la semilla,
  // para variar el tipo de bug entre ejercicios sin perder el determinismo.
  const inicio = rnd() % TRANSFORMACIONES.length;
  for (let k = 0; k < TRANSFORMACIONES.length; k++) {
    const t = TRANSFORMACIONES[(inicio + k) % TRANSFORMACIONES.length];
    const r = t(lineas, rnd);
    // Un bug que no cambia nada no es un bug: el reto sería irresoluble.
    if (r && r.codigo.trim() !== codigoPython.trim()) return r;
  }
  return null;
}
