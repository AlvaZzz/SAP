/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  INTERVALO DE CONFIANZA POR BOOTSTRAP DE PERCENTIL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  La tesis contrasta la hipótesis con IC del 95 % por bootstrap de percentil,
 *  apropiado cuando el grupo es reducido y no puede asumirse normalidad.
 *
 *  Procedimiento: se remuestrea CON reemplazo la serie original B veces, se
 *  calcula el estadístico en cada remuestra y se toman los percentiles
 *  (1−c)/2 y 1−(1−c)/2 de esa distribución.
 *
 *  REPRODUCIBLE: el generador aleatorio es determinista (mulberry32) con semilla
 *  fija. El mismo dato produce SIEMPRE el mismo intervalo, que es lo que permite
 *  citar un número en la tesis y volver a obtenerlo después.
 *
 *  El análisis definitivo se hace fuera del sistema (Python/SciPy); este cálculo
 *  es el que muestra el panel del investigador.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Remuestreos por defecto (la tesis exige al menos 2000). */
export const BOOTSTRAP_REMUESTREOS = 2000;
/** Semilla fija: cambiarla cambia los intervalos reportados. */
export const BOOTSTRAP_SEMILLA = 20261011;

export interface IntervaloBootstrap {
  /** Estadístico calculado sobre la serie original. */
  estimacion: number | null;
  inferior: number | null;
  superior: number | null;
  n: number;
  confianza: number;
  remuestreos: number;
  semilla: number;
}

export interface OpcionesBootstrap {
  remuestreos?: number;
  semilla?: number;
  confianza?: number;
}

/** Generador pseudoaleatorio determinista en [0, 1). */
export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mediaDe = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Percentil por interpolación lineal (mismo criterio que numpy.percentile por defecto). */
export function percentil(ordenados: number[], p: number): number {
  if (ordenados.length === 1) return ordenados[0];
  const pos = (ordenados.length - 1) * p;
  const base = Math.floor(pos);
  const resto = pos - base;
  const siguiente = ordenados[Math.min(base + 1, ordenados.length - 1)];
  return ordenados[base] + (siguiente - ordenados[base]) * resto;
}

/**
 * IC por bootstrap de percentil de un estadístico (por defecto, la media).
 *
 * Una PROPORCIÓN es la media de una serie de 0/1, así que el % de asignaciones
 * en rango objetivo se calcula pasando esa serie tal cual.
 *
 * Con menos de 2 datos no hay nada que remuestrear: se devuelve la estimación
 * (si existe) y el intervalo en null, en vez de un intervalo de ancho cero que
 * aparentaría una precisión que no se tiene.
 */
export function bootstrapIC(
  valores: number[],
  estadistico: (xs: number[]) => number = mediaDe,
  opts: OpcionesBootstrap = {},
): IntervaloBootstrap {
  const remuestreos = opts.remuestreos ?? BOOTSTRAP_REMUESTREOS;
  const semilla = opts.semilla ?? BOOTSTRAP_SEMILLA;
  const confianza = opts.confianza ?? 0.95;
  const n = valores.length;
  const base = { n, confianza, remuestreos, semilla };

  if (n === 0) return { estimacion: null, inferior: null, superior: null, ...base };
  const estimacion = estadistico(valores);
  if (n < 2) return { estimacion, inferior: null, superior: null, ...base };

  const rnd = mulberry32(semilla);
  const replicas: number[] = new Array(remuestreos);
  const muestra: number[] = new Array(n);
  for (let b = 0; b < remuestreos; b++) {
    for (let i = 0; i < n; i++) muestra[i] = valores[Math.floor(rnd() * n)];
    replicas[b] = estadistico(muestra);
  }
  replicas.sort((x, y) => x - y);

  const cola = (1 - confianza) / 2;
  return {
    estimacion,
    inferior: percentil(replicas, cola),
    superior: percentil(replicas, 1 - cola),
    ...base,
  };
}
