/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTADÍSTICA — descriptivos, supuestos y contraste entre dos series
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Funciones PURAS (sin Prisma ni Nest) para que sean testeables una a una.
 *  TODAS están verificadas contra scipy en `inferencia.spec.ts`, con el valor
 *  de referencia escrito en el propio test. Regla del proyecto: un número mal
 *  calculado es peor que no tenerlo.
 *
 *  Qué hay aquí y para qué sirve en la tesis:
 *   · t independiente (Student/Welch) → ¿difieren dos series? (p. ej. niveles)
 *   · d de Cohen / g de Hedges        → ¿cuán grande es la diferencia?
 *   · Shapiro-Wilk / Levene           → ¿se pueden usar esas pruebas?
 *   · Mann-Whitney                    → alternativa si los supuestos fallan
 *   · Pearson / Spearman              → asociación entre dos variables
 *
 *  El estudio es no experimental transversal: aquí NO hay pruebas pareadas
 *  pre→post. El IC por bootstrap vive en bootstrap.ts.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { normalCdf, normalInv, pValorF, pValorT, tCritico } from './distribuciones';

// ── Tipos de resultado ──────────────────────────────────────────────────────

export interface Descriptivos {
  n: number;
  media: number;
  sd: number;
  ee: number; // error estándar de la media
  min: number;
  max: number;
  mediana: number;
}

export interface ResultadoContraste {
  /** Estadístico de la prueba (t, U, W, F…). */
  estadistico: number;
  gl: number | null;
  p: number;
  /** Intervalo de confianza del 95 % de la diferencia (null si no aplica). */
  ic95: [number, number] | null;
  /** Diferencia observada entre medias (o mediana de diferencias). */
  diferencia: number | null;
}

export interface TamanoEfecto {
  d: number;
  g: number;
  /** Interpretación cualitativa según los cortes convencionales de Cohen. */
  magnitud: 'insignificante' | 'pequeño' | 'mediano' | 'grande';
}

// ── Descriptivos ────────────────────────────────────────────────────────────

export function media(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

/** Varianza MUESTRAL (denominador n−1), que es la que corresponde a una muestra. */
export function varianza(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = media(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1);
}

export function desviacion(xs: number[]): number {
  return Math.sqrt(varianza(xs));
}

export function mediana(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function descriptivos(xs: number[]): Descriptivos {
  const n = xs.length;
  if (n === 0) {
    return { n: 0, media: NaN, sd: NaN, ee: NaN, min: NaN, max: NaN, mediana: NaN };
  }
  const sd = n > 1 ? desviacion(xs) : 0;
  return {
    n,
    media: media(xs),
    sd,
    ee: n > 1 ? sd / Math.sqrt(n) : 0,
    min: Math.min(...xs),
    max: Math.max(...xs),
    mediana: mediana(xs),
  };
}

// ── Prueba t de muestras INDEPENDIENTES ─────────────────────────────────────

/**
 * PRUEBA t DE MUESTRAS INDEPENDIENTES (dos series independientes).
 *
 *  · `welch = false` → t de Student, asume varianzas iguales:
 *        s_p² = [(n₁−1)s₁² + (n₂−1)s₂²] / (n₁+n₂−2)
 *        t = (x̄₁ − x̄₂) / (s_p · √(1/n₁ + 1/n₂)) ,  gl = n₁+n₂−2
 *
 *  · `welch = true` → t de Welch, NO asume varianzas iguales (la correcta
 *    cuando Levene resulta significativo):
 *        t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)
 *        gl por la ecuación de Welch-Satterthwaite (no entero).
 *
 *  El intervalo de confianza del 95 % se calcula sobre la DIFERENCIA de medias:
 *  si contiene el 0, la diferencia no es significativa al 5 %.
 */
export function tIndependiente(a: number[], b: number[], welch = false): ResultadoContraste {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 2 || n2 < 2) {
    return { estadistico: NaN, gl: null, p: NaN, ic95: null, diferencia: null };
  }

  const m1 = media(a);
  const m2 = media(b);
  const v1 = varianza(a);
  const v2 = varianza(b);
  const dif = m1 - m2;

  let ee: number;
  let gl: number;

  if (welch) {
    ee = Math.sqrt(v1 / n1 + v2 / n2);
    // Welch-Satterthwaite
    gl = (v1 / n1 + v2 / n2) ** 2 /
      ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  } else {
    const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
    ee = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    gl = n1 + n2 - 2;
  }

  if (ee === 0) return { estadistico: NaN, gl, p: NaN, ic95: null, diferencia: dif };

  const t = dif / ee;
  const p = pValorT(t, gl);
  const tc = tCritico(gl, 0.95);
  return { estadistico: t, gl, p, ic95: [dif - tc * ee, dif + tc * ee], diferencia: dif };
}

// ── Tamaño del efecto ───────────────────────────────────────────────────────

/**
 * d DE COHEN y g DE HEDGES para dos grupos independientes.
 *
 *      d = (x̄₁ − x̄₂) / s_p        (s_p = desviación combinada)
 *      g = d · J,  J = 1 − 3/(4·gl − 1)
 *
 *  `g` corrige el SESGO al alza que tiene `d` con muestras pequeñas — que es
 *  exactamente el caso de una tesis. Con n grande, J→1 y ambas coinciden.
 *
 *  Cortes convencionales de Cohen (1988): 0.2 pequeño · 0.5 mediano · 0.8 grande.
 */
export function tamanoEfecto(a: number[], b: number[]): TamanoEfecto {
  const n1 = a.length;
  const n2 = b.length;
  const gl = n1 + n2 - 2;
  const sp = Math.sqrt(((n1 - 1) * varianza(a) + (n2 - 1) * varianza(b)) / gl);
  const d = sp === 0 ? NaN : (media(a) - media(b)) / sp;
  const J = 1 - 3 / (4 * gl - 1);
  const g = d * J;

  const abs = Math.abs(d);
  const magnitud: TamanoEfecto['magnitud'] =
    abs < 0.2 ? 'insignificante' : abs < 0.5 ? 'pequeño' : abs < 0.8 ? 'mediano' : 'grande';

  return { d, g, magnitud };
}

// ── Supuesto 1: NORMALIDAD (Shapiro-Wilk) ───────────────────────────────────

/**
 * PRUEBA DE SHAPIRO-WILK de normalidad (algoritmo de Royston 1995, AS R94).
 *
 *  H₀: los datos proceden de una distribución normal.
 *  → p < 0.05 significa que NO son normales, y entonces la prueba t no es
 *    apropiada: hay que usar la alternativa no paramétrica.
 *
 *  Idea: compara el orden observado de los datos con el que cabría esperar de
 *  una normal. W ∈ (0,1]; cuanto más cerca de 1, más normal.
 *
 *  Requiere n ≥ 3. Por encima de n ≈ 50 la aproximación pierde algo de
 *  precisión, pero para el tamaño de muestra de una tesis es holgadamente
 *  suficiente.
 */
export function shapiroWilk(xs: number[]): { W: number; p: number } {
  const n = xs.length;
  if (n < 3) return { W: NaN, p: NaN };

  const x = [...xs].sort((a, b) => a - b);
  const m = media(x);
  const ss = x.reduce((acc, v) => acc + (v - m) ** 2, 0);
  if (ss === 0) return { W: NaN, p: NaN }; // todos iguales: no hay variabilidad

  // Scores normales esperados m_i = Φ⁻¹((i − 3/8)/(n + 1/4))
  const mi: number[] = [];
  for (let i = 1; i <= n; i++) mi.push(normalInv((i - 0.375) / (n + 0.25)));
  const sumM2 = mi.reduce((acc, v) => acc + v * v, 0);

  // Coeficientes a_i, con la corrección polinómica de Royston en los extremos.
  const c = mi.map((v) => v / Math.sqrt(sumM2));
  const a = new Array<number>(n).fill(0);
  const u = 1 / Math.sqrt(n);

  if (n === 3) {
    a[0] = -Math.SQRT1_2;
    a[2] = Math.SQRT1_2;
  } else {
    const an =
      c[n - 1] + 0.221157 * u - 0.147981 * u ** 2 - 2.071190 * u ** 3 +
      4.434685 * u ** 4 - 2.706056 * u ** 5;

    let phi: number;
    let desde: number;
    if (n > 5) {
      const an1 =
        c[n - 2] + 0.042981 * u - 0.293762 * u ** 2 - 1.752461 * u ** 3 +
        5.682633 * u ** 4 - 3.582633 * u ** 5;
      a[n - 1] = an; a[0] = -an;
      a[n - 2] = an1; a[1] = -an1;
      phi = (sumM2 - 2 * mi[n - 1] ** 2 - 2 * mi[n - 2] ** 2) /
        (1 - 2 * an ** 2 - 2 * an1 ** 2);
      desde = 2;
    } else {
      a[n - 1] = an; a[0] = -an;
      phi = (sumM2 - 2 * mi[n - 1] ** 2) / (1 - 2 * an ** 2);
      desde = 1;
    }
    for (let i = desde; i < n - desde; i++) a[i] = mi[i] / Math.sqrt(phi);
  }

  const num = a.reduce((acc, ai, i) => acc + ai * x[i], 0);
  const W = (num * num) / ss;

  // ── Valor p, por los tres regímenes de Royston según n ──
  let p: number;
  if (n === 3) {
    // Caso exacto: la distribución de W con n=3 se conoce en forma cerrada.
    const pi6 = 6 / Math.PI;
    const stqr = Math.asin(Math.sqrt(0.75));
    p = pi6 * (Math.asin(Math.sqrt(W)) - stqr);
    p = Math.min(1, Math.max(0, p));
  } else if (n <= 11) {
    const gamma = -2.273 + 0.459 * n;
    const w = -Math.log(gamma - Math.log(1 - W));
    const mu = 0.5440 - 0.39978 * n + 0.025054 * n ** 2 - 0.0006714 * n ** 3;
    const sigma = Math.exp(1.3822 - 0.77857 * n + 0.062767 * n ** 2 - 0.0020322 * n ** 3);
    p = 1 - normalCdf((w - mu) / sigma);
  } else {
    const ln = Math.log(n);
    const w = Math.log(1 - W);
    const mu = -1.5861 - 0.31082 * ln - 0.083751 * ln ** 2 + 0.0038915 * ln ** 3;
    const sigma = Math.exp(-0.4803 - 0.082676 * ln + 0.0030302 * ln ** 2);
    p = 1 - normalCdf((w - mu) / sigma);
  }

  return { W, p: Math.min(1, Math.max(0, p)) };
}

// ── Supuesto 2: HOMOGENEIDAD DE VARIANZAS (Levene) ──────────────────────────

/**
 * PRUEBA DE LEVENE de homogeneidad de varianzas.
 *
 *  H₀: los grupos tienen la misma varianza.
 *  → p < 0.05 significa que NO son homogéneas y hay que usar la t de WELCH
 *    en lugar de la de Student.
 *
 *  Mecánica: transforma cada dato en su desviación absoluta respecto al centro
 *  de su grupo (z_ij = |x_ij − centro_i|) y aplica un ANOVA sobre esas z.
 *
 *  `centro`: 'media' es el Levene clásico; 'mediana' es la variante de
 *  Brown-Forsythe, más robusta ante asimetría.
 */
export function levene(
  grupos: number[][],
  centro: 'media' | 'mediana' = 'media',
): { F: number; gl1: number; gl2: number; p: number } {
  const k = grupos.length;
  const N = grupos.reduce((acc, g) => acc + g.length, 0);
  if (k < 2 || N <= k) return { F: NaN, gl1: NaN, gl2: NaN, p: NaN };

  const z = grupos.map((g) => {
    const c = centro === 'media' ? media(g) : mediana(g);
    return g.map((v) => Math.abs(v - c));
  });

  const zMediaGrupo = z.map((g) => media(g));
  const zMediaGlobal = media(z.flat());

  const entre = z.reduce(
    (acc, g, i) => acc + g.length * (zMediaGrupo[i] - zMediaGlobal) ** 2, 0,
  );
  const dentro = z.reduce(
    (acc, g, i) => acc + g.reduce((s, v) => s + (v - zMediaGrupo[i]) ** 2, 0), 0,
  );

  if (dentro === 0) return { F: NaN, gl1: k - 1, gl2: N - k, p: NaN };

  const F = ((N - k) * entre) / ((k - 1) * dentro);
  return { F, gl1: k - 1, gl2: N - k, p: pValorF(F, k - 1, N - k) };
}

// ── Alternativas NO PARAMÉTRICAS ────────────────────────────────────────────

/** Rangos promediados (empates reciben el rango medio). Base de las pruebas de rangos. */
export function rangos(xs: number[]): number[] {
  const idx = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const r = new Array<number>(xs.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const rango = (i + j + 2) / 2; // promedio de los rangos 1-indexados
    for (let k = i; k <= j; k++) r[idx[k].i] = rango;
    i = j + 1;
  }
  return r;
}

/** ¿Hay valores repetidos? Determina si se puede usar la versión exacta. */
function hayEmpates(xs: number[]): boolean {
  return new Set(xs).size !== xs.length;
}

/**
 * Distribución exacta del estadístico U de Mann-Whitney bajo H₀: cuenta cuántas
 * de las C(n1+n2, n1) ordenaciones posibles producen cada valor de U.
 *
 * Recurrencia clásica (coeficiente binomial gaussiano):
 *     N(i, j, u) = N(i−1, j, u−j) + N(i, j−1, u)
 * donde N(i,j,u) es el número de formas de obtener U=u con i y j elementos.
 */
function distribucionU(n1: number, n2: number): number[] {
  const maxU = n1 * n2;
  // dp[i][j] = vector de conteos por valor de U para submuestras de tamaño i y j.
  const dp: number[][][] = Array.from({ length: n1 + 1 }, () =>
    Array.from({ length: n2 + 1 }, () => new Array<number>(maxU + 1).fill(0)),
  );
  for (let j = 0; j <= n2; j++) dp[0][j][0] = 1; // sin elementos del grupo 1 → U=0
  for (let i = 0; i <= n1; i++) dp[i][0][0] = 1; // sin elementos del grupo 2 → U=0

  for (let i = 1; i <= n1; i++) {
    for (let j = 1; j <= n2; j++) {
      const lim = i * j;
      for (let u = 0; u <= lim; u++) {
        dp[i][j][u] = (u - j >= 0 ? dp[i - 1][j][u - j] : 0) + dp[i][j - 1][u];
      }
    }
  }
  return dp[n1][n2];
}

/**
 * PRUEBA U DE MANN-WHITNEY (alternativa no paramétrica a la t independiente).
 *
 *  H₀: las dos poblaciones tienen la misma distribución. No exige normalidad:
 *  trabaja con rangos, no con los valores. Es la prueba correcta cuando
 *  Shapiro-Wilk indica que los datos no son normales.
 *
 *  Sin empates y con muestras pequeñas usa la distribución EXACTA; en otro caso
 *  la aproximación normal con corrección por empates.
 */
export function mannWhitney(a: number[], b: number[]): ResultadoContraste & { exacto: boolean } {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 1 || n2 < 1) {
    return { estadistico: NaN, gl: null, p: NaN, ic95: null, diferencia: null, exacto: false };
  }

  const todos = [...a, ...b];
  const r = rangos(todos);
  const R1 = r.slice(0, n1).reduce((x, y) => x + y, 0);
  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const dif = mediana(a) - mediana(b);

  const empates = hayEmpates(todos);
  // Límite práctico: la DP es O(n1·n2²) y con muestras de tesis siempre cabe.
  const usarExacto = !empates && n1 <= 20 && n2 <= 20;

  if (usarExacto) {
    const f = distribucionU(n1, n2);
    const total = f.reduce((x, y) => x + y, 0);
    const uMin = Math.min(U1, U2);
    let acum = 0;
    for (let u = 0; u <= uMin; u++) acum += f[u];
    const p = Math.min(1, (2 * acum) / total);
    return { estadistico: U1, gl: null, p, ic95: null, diferencia: dif, exacto: true };
  }

  // Aproximación normal con corrección por empates.
  const mu = (n1 * n2) / 2;
  const N = n1 + n2;
  const conteos = new Map<number, number>();
  for (const v of todos) conteos.set(v, (conteos.get(v) ?? 0) + 1);
  const correccion = [...conteos.values()].reduce((acc, t) => acc + (t ** 3 - t), 0);
  const sigma = Math.sqrt(
    ((n1 * n2) / 12) * (N + 1 - correccion / (N * (N - 1))),
  );
  if (sigma === 0) {
    return { estadistico: U1, gl: null, p: NaN, ic95: null, diferencia: dif, exacto: false };
  }
  const z = (U1 - mu) / sigma;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { estadistico: U1, gl: null, p: Math.min(1, p), ic95: null, diferencia: dif, exacto: false };
}

// ── Correlación ─────────────────────────────────────────────────────────────

export interface Correlacion {
  r: number;
  p: number;
  n: number;
  magnitud: 'nula' | 'débil' | 'moderada' | 'fuerte';
}

function clasificarR(r: number): Correlacion['magnitud'] {
  const a = Math.abs(r);
  if (a < 0.1) return 'nula';
  if (a < 0.3) return 'débil';
  if (a < 0.5) return 'moderada';
  return 'fuerte';
}

/**
 * CORRELACIÓN DE PEARSON r y su valor p.
 *
 *      r = Σ(x−x̄)(y−ȳ) / √(Σ(x−x̄)² · Σ(y−ȳ)²)
 *      t = r·√((n−2)/(1−r²)) con gl = n−2
 *
 *  Mide asociación LINEAL. Sustituye con ventaja a la comparación de terciles:
 *  usa toda la información en vez de trocear la muestra, y trae valor p.
 */
export function pearson(x: number[], y: number[]): Correlacion {
  const n = x.length;
  if (n !== y.length || n < 3) return { r: NaN, p: NaN, n, magnitud: 'nula' };

  const mx = media(x);
  const my = media(y);
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return { r: NaN, p: NaN, n, magnitud: 'nula' };

  const r = sxy / Math.sqrt(sxx * syy);
  // r = ±1 exacto ⇒ p = 0 (la fórmula con t se indetermina).
  const p = Math.abs(r) >= 1 ? 0 : pValorT(r * Math.sqrt((n - 2) / (1 - r * r)), n - 2);
  return { r, p, n, magnitud: clasificarR(r) };
}

/**
 * CORRELACIÓN DE SPEARMAN ρ: Pearson aplicada sobre los RANGOS.
 * Mide asociación monótona (no necesariamente lineal) y no exige normalidad,
 * por lo que es la opción correcta cuando Shapiro-Wilk falla.
 */
export function spearman(x: number[], y: number[]): Correlacion {
  if (x.length !== y.length || x.length < 3) {
    return { r: NaN, p: NaN, n: x.length, magnitud: 'nula' };
  }
  return pearson(rangos(x), rangos(y));
}
