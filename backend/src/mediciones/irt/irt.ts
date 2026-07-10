import { NivelDificultad } from '@prisma/client';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TEORÍA DE RESPUESTA AL ÍTEM (IRT) — MODELO DE RASCH (1 parámetro / 1PL)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Este módulo contiene la matemática PURA (sin dependencias de Prisma ni de
 *  NestJS) que fundamenta la adaptatividad de PREXI. Al ser puro es fácilmente
 *  testeable (ver `irt.spec.ts`) y reutilizable por el diagnóstico (pretest),
 *  la selección adaptativa de ejercicios, la subida de nivel y el postest.
 *
 *  FUNDAMENTO (Rasch, 1960): la probabilidad de que un estudiante con habilidad
 *  θ (theta) responda correctamente un ítem de dificultad b depende ÚNICAMENTE
 *  de la DIFERENCIA (θ − b), medidas ambas en la misma escala logit.
 *
 *      P(θ) = 1 / (1 + e^(−(θ − b)))            [curva característica del ítem]
 *
 *  Se elige el modelo de 1 PARÁMETRO (solo dificultad `b`) y NO los de 2/3
 *  parámetros (que añaden discriminación `a` y azar `c`) porque estos requieren
 *  CALIBRACIÓN con datos masivos de respuestas que aún no existen en el proyecto.
 *  Honestidad metodológica: los `b` iniciales son estimaciones del docente por
 *  nivel (ver `dificultadDesdeNivel`), calibrables en trabajo futuro.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Escala de la habilidad θ y de la dificultad b (logits) ──
// θ y b viven en la MISMA escala (típicamente −3..+3). Acotamos las estimaciones
// a [−4, 4] para que los patrones extremos (todo bien / todo mal), en los que el
// MLE tiende a ±∞, devuelvan un valor finito y manejable.
export const THETA_MIN = -4;
export const THETA_MAX = 4;

// ── Dificultad b inicial por nivel adaptativo (estimación del docente) ──
// Básico ≈ −1, Intermedio ≈ 0, Avanzado ≈ +1. Son valores iniciales razonables
// en la escala de θ; se documentan como calibrables con más datos (trabajo futuro).
export const B_POR_NIVEL: Record<NivelDificultad, number> = {
  basico: -1,
  intermedio: 0,
  avanzado: 1,
};

// ── Umbrales θ → nivel adaptativo ──
// θ < −0.5 → Básico ; −0.5 ≤ θ ≤ 0.5 → Intermedio ; θ > 0.5 → Avanzado.
export const THETA_UMBRAL_BASICO = -0.5;
export const THETA_UMBRAL_AVANZADO = 0.5;

/** Una respuesta observada: la dificultad `b` del ítem y si se acertó. */
export interface RespuestaIrt {
  b: number;
  correcto: boolean;
}

/**
 * CURVA CARACTERÍSTICA DEL ÍTEM (ICC) — probabilidad de acierto.
 *
 *      P(θ) = 1 / (1 + e^(−(θ − b)))
 *
 *  · θ = habilidad estimada del estudiante (logits).
 *  · b = dificultad del ítem (logits).
 *  Propiedad clave del modelo de Rasch: cuando θ = b, P = 0.5 (el estudiante
 *  tiene 50% de probabilidad de acertar un ítem justo a su nivel).
 *
 *  @returns número en (0, 1).
 */
export function probabilidadAcierto(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)));
}

/**
 * INFORMACIÓN DE FISHER del ítem en θ (modelo de Rasch):
 *
 *      I(θ) = P(θ) · (1 − P(θ))
 *
 *  Es máxima (0.25) cuando b = θ. Fundamenta la SELECCIÓN ADAPTATIVA: un ítem
 *  aporta la MÁXIMA información sobre la habilidad cuando su dificultad coincide
 *  con la habilidad del estudiante (b ≈ θ) → es el ítem "óptimo" a presentar.
 */
export function informacionItem(theta: number, b: number): number {
  const p = probabilidadAcierto(theta, b);
  return p * (1 - p);
}

/** Dificultad `b` inicial a partir del nivel adaptativo (Básico/Intermedio/Avanzado). */
export function dificultadDesdeNivel(nivel: NivelDificultad): number {
  return B_POR_NIVEL[nivel];
}

/**
 * Dificultad `b` a partir de las estrellas (1–5) del ejercicio, para dar más
 * granularidad que los 3 niveles: b = (estrellas − 3) × 0.75, acotado a [−3, 3].
 *   ★1 → −1.5 · ★2 → −0.75 · ★3 → 0 · ★4 → +0.75 · ★5 → +1.5
 * Coherente con `dificultadDesdeNivel` (básico≈−1, intermedio 0, avanzado≈+1).
 */
export function dificultadDesdeEstrellas(estrellas: number): number {
  const b = (estrellas - 3) * 0.75;
  return Math.max(-3, Math.min(3, b));
}

/** Convierte la habilidad estimada θ en un nivel adaptativo, según los umbrales. */
export function nivelDesdeTheta(theta: number): NivelDificultad {
  if (theta < THETA_UMBRAL_BASICO) return 'basico';
  if (theta > THETA_UMBRAL_AVANZADO) return 'avanzado';
  return 'intermedio';
}

/**
 * LOG-VEROSIMILITUD del patrón de respuestas dado θ (modelo de Rasch):
 *
 *      ln L(θ) = Σ_i [ u_i · (θ − b_i) − ln(1 + e^(θ − b_i)) ]
 *
 *  donde u_i ∈ {0,1} indica si el ítem i se acertó. Maximizar esta función en θ
 *  es lo que hace `estimarTheta` (MLE). Se expone para poder verificar en las
 *  pruebas que el θ estimado efectivamente maximiza la verosimilitud.
 */
export function logVerosimilitud(theta: number, respuestas: RespuestaIrt[]): number {
  let ll = 0;
  for (const r of respuestas) {
    const d = theta - r.b;
    ll += (r.correcto ? 1 : 0) * d - Math.log(1 + Math.exp(d));
  }
  return ll;
}

export interface OpcionesEstimacion {
  thetaInicial?: number;
  maxIter?: number;
  tol?: number;
}

/**
 * ESTIMACIÓN DE LA HABILIDAD θ POR MÁXIMA VEROSIMILITUD (MLE), resuelta con el
 * método iterativo de NEWTON-RAPHSON.
 *
 *  Buscamos el θ que maximiza ln L(θ), es decir, donde su derivada se anula.
 *  Para el modelo de Rasch la derivada (función "score") y la segunda derivada son:
 *
 *      L'(θ)  = Σ_i [ u_i − P_i(θ) ]                    (gradiente)
 *      L''(θ) = − Σ_i [ P_i(θ) · (1 − P_i(θ)) ]         (hessiano, siempre < 0)
 *
 *  siendo P_i(θ) = 1/(1 + e^(−(θ − b_i))). Newton-Raphson actualiza:
 *
 *      θ ← θ − L'(θ)/L''(θ) = θ + L'(θ) / Σ_i P_i(1 − P_i)
 *
 *  La información total Σ P_i(1 − P_i) es siempre positiva, así que cada paso
 *  sube por la verosimilitud (que es cóncava) → converge rápido y de forma
 *  estable al máximo global.
 *
 *  PATRONES EXTREMOS: si el estudiante acierta TODO (o falla TODO), el máximo de
 *  verosimilitud está en +∞ (o −∞); en ese caso devolvemos el extremo acotado
 *  THETA_MAX / THETA_MIN (honestidad: con un patrón perfecto no se puede estimar
 *  con precisión la habilidad, solo acotarla).
 *
 *  @param respuestas patrón observado (b del ítem + acierto).
 *  @returns θ estimado (logits), acotado a [THETA_MIN, THETA_MAX].
 */
export function estimarTheta(respuestas: RespuestaIrt[], opts: OpcionesEstimacion = {}): number {
  const { thetaInicial = 0, maxIter = 50, tol = 1e-4 } = opts;
  if (respuestas.length === 0) return 0; // sin evidencia → habilidad neutra (0)

  const aciertos = respuestas.filter((r) => r.correcto).length;
  if (aciertos === 0) return THETA_MIN; // todo mal → habilidad en el extremo inferior
  if (aciertos === respuestas.length) return THETA_MAX; // todo bien → extremo superior

  let theta = thetaInicial;
  for (let i = 0; i < maxIter; i++) {
    let score = 0; // L'(θ)
    let info = 0; //  −L''(θ) = Σ P(1−P)  (información de Fisher total)
    for (const r of respuestas) {
      const p = probabilidadAcierto(theta, r.b);
      score += (r.correcto ? 1 : 0) - p;
      info += p * (1 - p);
    }
    if (info < 1e-9) break; // información nula → no se puede seguir refinando
    // Paso de Newton (= −L'/L''), AMORTIGUADO a ±1 logit por iteración: en las
    // colas la curvatura es mínima y el paso puro puede dispararse/oscilar; el
    // amortiguamiento garantiza convergencia monótona sea cual sea el θ inicial.
    let delta = score / info;
    delta = Math.max(-1, Math.min(1, delta));
    theta += delta;
    theta = Math.max(THETA_MIN, Math.min(THETA_MAX, theta));
    if (Math.abs(delta) < tol) break; // convergió
  }
  return theta;
}

/** Ganancia de habilidad Δθ = θ_final − θ_inicial (evidencia cuantitativa IRT del progreso). */
export function gananciaTheta(thetaInicial: number | null, thetaFinal: number | null): number | null {
  if (thetaInicial == null || thetaFinal == null) return null;
  return Math.round((thetaFinal - thetaInicial) * 1000) / 1000;
}

/** Redondeo a 3 decimales para persistir/exportar θ de forma legible. */
export function redondearTheta(theta: number): number {
  return Math.round(theta * 1000) / 1000;
}
