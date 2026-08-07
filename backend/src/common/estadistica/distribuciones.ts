/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DISTRIBUCIONES DE PROBABILIDAD — base de todos los valores p del sistema
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Funciones puras, sin dependencias. Todo valor p que PREXI reporta sale de
 *  aquí, así que estas funciones están verificadas contra scipy en
 *  `distribuciones.spec.ts` antes de que ninguna prueba estadística las use.
 *
 *  El núcleo es la FUNCIÓN BETA INCOMPLETA REGULARIZADA I_x(a,b): tanto la
 *  distribución t de Student como la F se expresan a través de ella, así que
 *  basta implementarla bien una vez.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Logaritmo de la función gamma (aproximación de Lanczos, g=7, n=9).
 * Se trabaja en logaritmos porque Γ(n) desborda el rango de un double muy
 * pronto (Γ(171) ya es Infinity), mientras que ln Γ se mantiene manejable.
 */
export function logGamma(x: number): number {
  const g = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Fórmula de reflexión: Γ(x)Γ(1−x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = g[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += g[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Fracción continua de la beta incompleta (método de Lentz modificado).
 * Es la maquinaria interna de `betaIncompletaRegularizada`.
 */
function betaFraccionContinua(x: number, a: number, b: number): number {
  const TINY = 1e-300;
  const EPS = 3e-16;
  const MAX_ITER = 500;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m;
    // Paso par
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    // Paso impar
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break; // convergió
  }
  return h;
}

/**
 * FUNCIÓN BETA INCOMPLETA REGULARIZADA  I_x(a, b) ∈ [0, 1].
 * De ella se derivan las colas de la t de Student y de la F.
 */
export function betaIncompletaRegularizada(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const lnFront =
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(lnFront);

  // La fracción continua converge rápido solo cuando x < (a+1)/(a+b+2);
  // fuera de ese rango se usa la simetría I_x(a,b) = 1 − I_{1−x}(b,a).
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaFraccionContinua(x, a, b)) / a;
  }
  return 1 - (Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + b * Math.log(1 - x) + a * Math.log(x),
  ) * betaFraccionContinua(1 - x, b, a)) / b;
}

/**
 * Valor p BILATERAL de la distribución t de Student con `gl` grados de libertad.
 *
 *      p = P(|T| ≥ |t|) = I_{gl/(gl+t²)}(gl/2, 1/2)
 *
 * Es la respuesta a "¿qué probabilidad hay de observar una diferencia al menos
 * tan grande como esta si en realidad NO hubiera diferencia?".
 */
export function pValorT(t: number, gl: number): number {
  if (!Number.isFinite(t) || gl <= 0) return NaN;
  const x = gl / (gl + t * t);
  return betaIncompletaRegularizada(x, gl / 2, 0.5);
}

/**
 * Cola superior de la distribución F con (gl1, gl2) grados de libertad:
 * P(F ≥ f). Es el valor p de la prueba de Levene.
 */
export function pValorF(f: number, gl1: number, gl2: number): number {
  if (!Number.isFinite(f) || f < 0 || gl1 <= 0 || gl2 <= 0) return NaN;
  const x = gl2 / (gl2 + gl1 * f);
  return betaIncompletaRegularizada(x, gl2 / 2, gl1 / 2);
}

/** Función de distribución acumulada de la normal estándar Φ(z). */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * GAMMA INCOMPLETA REGULARIZADA INFERIOR P(a, x), por serie.
 * Válida y de convergencia rápida cuando x < a+1.
 */
function gammaPSerie(a: number, x: number): number {
  const EPS = 1e-16;
  let ap = a;
  let suma = 1 / a;
  let del = suma;
  for (let n = 0; n < 500; n++) {
    ap++;
    del *= x / ap;
    suma += del;
    if (Math.abs(del) < Math.abs(suma) * EPS) break;
  }
  return suma * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/**
 * GAMMA INCOMPLETA REGULARIZADA SUPERIOR Q(a, x) = 1 − P(a, x), por fracción
 * continua (método de Lentz). Es la rama estable cuando x ≥ a+1.
 */
function gammaQFraccion(a: number, x: number): number {
  const EPS = 1e-16;
  const TINY = 1e-300;
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/**
 * FUNCIÓN ERROR erf(x), a través de la gamma incompleta:
 *
 *      erf(x) = P(1/2, x²)   para x ≥ 0,   erf(−x) = −erf(x)
 *
 * Se usa esta vía —y no una aproximación racional tipo Abramowitz & Stegun—
 * porque aquella se queda en ~1e-7 de precisión, y de erf depende Φ(z), de Φ(z)
 * depende Φ⁻¹(p), y de Φ⁻¹(p) dependen los scores normales de Shapiro-Wilk.
 * Un error de 1e-7 arrastrado hasta ahí es evitable, así que se evita.
 */
export function erf(x: number): number {
  const signo = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (ax < 1e-15) return 0;
  const x2 = ax * ax;
  const p = x2 < 1.5 ? gammaPSerie(0.5, x2) : 1 - gammaQFraccion(0.5, x2);
  return signo * p;
}

/**
 * INVERSA de la normal estándar Φ⁻¹(p) (función probit), por la aproximación
 * racional de Acklam refinada con un paso de Halley. Precisión ≈1e-15.
 * La necesita Shapiro-Wilk para construir los scores normales esperados.
 */
export function normalInv(p: number): number {
  if (p <= 0 || p >= 1) return p <= 0 ? -Infinity : Infinity;

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416];

  const pBajo = 0.02425;
  let x: number;

  if (p < pBajo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pBajo) {
    const q = p - 0.5;
    const r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // Refinamiento de Halley: corrige el error residual de la aproximación.
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/**
 * VALOR CRÍTICO t bilateral para una confianza dada (por defecto 95 %).
 * Es el multiplicador del error estándar en un intervalo de confianza.
 * Se resuelve por bisección sobre `pValorT`, que ya está verificada.
 */
export function tCritico(gl: number, confianza = 0.95): number {
  const alfa = 1 - confianza;
  let lo = 0;
  let hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (pValorT(mid, gl) > alfa) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
