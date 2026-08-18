/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  FIABILIDAD Y VALIDEZ DEL INSTRUMENTO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Es lo PRIMERO que pregunta un tribunal: si el pretest/postest no es fiable,
 *  ningún resultado obtenido con él significa nada. Este módulo responde:
 *
 *   · ¿Mide de forma consistente?      → KR-20 / alfa de Cronbach
 *   · ¿Cada ítem aporta o estorba?     → dificultad y discriminación por ítem
 *   · ¿El modelo de Rasch describe
 *     razonablemente estos datos?      → infit / outfit
 *
 *  Funciones puras sobre una MATRIZ DE RESPUESTAS dicotómica:
 *  `respuestas[persona][item]` = true si acertó. Verificadas en
 *  `fiabilidad.spec.ts` contra referencias calculadas con numpy/scipy.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { pearson, varianza } from './inferencia';

export interface Fiabilidad {
  /** Coeficiente KR-20 (o alfa), en (−∞, 1]. */
  coeficiente: number;
  k: number;
  n: number;
  interpretacion: 'inaceptable' | 'cuestionable' | 'aceptable' | 'buena' | 'excelente';
  /** true si hay datos suficientes para que el coeficiente signifique algo. */
  confiable: boolean;
}

export interface AnalisisItem {
  indice: number;
  /** Proporción de aciertos p ∈ [0,1]. En medición, "dificultad" ALTA = ítem FÁCIL. */
  dificultad: number;
  /** Correlación ítem-total CORREGIDA (el propio ítem se excluye del total). */
  discriminacion: number | null;
  /** Índice D por grupos extremos del 27 %: p(superior) − p(inferior). */
  d27: number | null;
  /** Diagnóstico legible del ítem. */
  veredicto: 'problemático' | 'débil' | 'aceptable' | 'bueno';
  /** Motivo del veredicto, para poder reportarlo en la tesis. */
  motivo: string;
}

/**
 * Umbrales de interpretación del coeficiente (George & Mallery, 2003).
 * Se documentan porque el corte concreto es una convención, no una ley.
 */
function interpretarCoef(a: number): Fiabilidad['interpretacion'] {
  if (a >= 0.9) return 'excelente';
  if (a >= 0.8) return 'buena';
  if (a >= 0.7) return 'aceptable';
  if (a >= 0.6) return 'cuestionable';
  return 'inaceptable';
}

/**
 * KR-20 (Kuder-Richardson 20) — fiabilidad de consistencia interna para ítems
 * DICOTÓMICOS (acierto/error), que es exactamente el caso del pretest/postest.
 *
 *      KR-20 = k/(k−1) · (1 − Σ p_i·q_i / σ²_total)
 *
 *  · k = número de ítems, p_i = proporción de acierto del ítem i, q_i = 1−p_i
 *  · σ²_total = varianza de los puntajes totales
 *
 *  Interpretación: qué parte de la variabilidad de los puntajes es señal y no
 *  ruido. Es el caso particular del alfa de Cronbach para ítems binarios, así
 *  que se reporta KR-20 y no alfa: es lo metodológicamente correcto aquí.
 *
 *  Un KR-20 solo es interpretable con un mínimo de personas: por debajo de 10
 *  el valor es tan inestable que se marca `confiable: false` en vez de
 *  presentarlo como si fuera un dato firme.
 */
export function kr20(respuestas: boolean[][]): Fiabilidad {
  const n = respuestas.length;
  const k = n > 0 ? respuestas[0].length : 0;

  if (n < 2 || k < 2) {
    return { coeficiente: NaN, k, n, interpretacion: 'inaceptable', confiable: false };
  }

  const totales = respuestas.map((fila) => fila.filter(Boolean).length);
  const varTotal = varianza(totales);
  if (!varTotal) {
    // Todos sacaron el mismo puntaje: sin variabilidad no se puede estimar.
    return { coeficiente: NaN, k, n, interpretacion: 'inaceptable', confiable: false };
  }

  let sumaPq = 0;
  for (let i = 0; i < k; i++) {
    const p = respuestas.reduce((acc, f) => acc + (f[i] ? 1 : 0), 0) / n;
    sumaPq += p * (1 - p);
  }

  const coef = (k / (k - 1)) * (1 - sumaPq / varTotal);
  return {
    coeficiente: coef,
    k,
    n,
    interpretacion: interpretarCoef(coef),
    confiable: n >= 10,
  };
}

/**
 * ALFA DE CRONBACH — fiabilidad de consistencia interna para ítems
 * POLITÓMICOS (escalas tipo Likert, donde cada ítem puntúa 1–5).
 *
 *      α = k/(k−1) · (1 − Σσ²_i / σ²_total)
 *
 *  Es la generalización del KR-20: donde aquel usa p·q (válido solo para
 *  acierto/error), este usa la varianza de cada ítem. Por eso el pretest se
 *  reporta con KR-20 y una escala de motivación con alfa: no son alternativas
 *  entre las que elegir, cada una corresponde a un tipo de ítem.
 *
 *  Se devuelve además `alfa_si_se_elimina` por ítem: si quitar un ítem SUBE el
 *  alfa, ese ítem está restando consistencia y conviene revisarlo (suele pasar
 *  con ítems inversos mal recodificados o mal redactados).
 */
export interface FiabilidadEscala extends Fiabilidad {
  items: {
    indice: number;
    /** Correlación ítem-total corregida (el propio ítem sale del total). */
    correlacion: number | null;
    /** Alfa que tendría la escala SIN este ítem. */
    alfa_si_se_elimina: number | null;
  }[];
}

export function alfaCronbach(respuestas: number[][]): FiabilidadEscala {
  const n = respuestas.length;
  const k = n > 0 ? respuestas[0].length : 0;

  const vacio: FiabilidadEscala = {
    coeficiente: NaN, k, n, interpretacion: 'inaceptable', confiable: false, items: [],
  };
  if (n < 2 || k < 2) return vacio;

  const alfaDe = (m: number[][]): number => {
    const cols = m[0].length;
    if (cols < 2) return NaN;
    const totales = m.map((f) => f.reduce((a, b) => a + b, 0));
    const varTotal = varianza(totales);
    if (!varTotal) return NaN;
    let sumaVarItems = 0;
    for (let i = 0; i < cols; i++) sumaVarItems += varianza(m.map((f) => f[i]));
    return (cols / (cols - 1)) * (1 - sumaVarItems / varTotal);
  };

  const coef = alfaDe(respuestas);
  if (!Number.isFinite(coef)) return vacio;

  const totales = respuestas.map((f) => f.reduce((a, b) => a + b, 0));
  const items = Array.from({ length: k }, (_, i) => {
    const columna = respuestas.map((f) => f[i]);
    const resto = respuestas.map((f, j) => totales[j] - f[i]);
    const r = pearson(columna, resto);
    const sinItem = respuestas.map((f) => f.filter((_, j) => j !== i));
    const a = k > 2 ? alfaDe(sinItem) : NaN;
    return {
      indice: i,
      correlacion: Number.isNaN(r.r) ? null : r.r,
      alfa_si_se_elimina: Number.isFinite(a) ? a : null,
    };
  });

  return {
    coeficiente: coef,
    k, n,
    interpretacion: interpretarCoef(coef),
    confiable: n >= 10,
    items,
  };
}

/** Mínimo de personas para que la discriminación de un ítem sea interpretable. */
export const MIN_PERSONAS_ITEM = 10;

/**
 * ANÁLISIS DE ÍTEMS: dificultad y discriminación de cada pregunta.
 *
 *  · DIFICULTAD p: proporción que acertó. Convención de medición: p alto = ítem
 *    FÁCIL. Los ítems muy fáciles (p>0.9) o muy difíciles (p<0.1) aportan poca
 *    información porque casi nadie los distingue.
 *
 *  · DISCRIMINACIÓN (correlación ítem-total CORREGIDA): correlación entre
 *    acertar ese ítem y el puntaje en LOS DEMÁS ítems. Se corrige excluyendo el
 *    propio ítem del total; si no, todo ítem correlacionaría consigo mismo y el
 *    índice saldría inflado.
 *
 *    Un valor NEGATIVO es una alarma seria: significa que los estudiantes que
 *    más saben tienden a fallarlo — el ítem mide al revés (mal enunciado, clave
 *    equivocada o ambigüedad). Estos se marcan como `problemático` para que
 *    consten en la tesis en lugar de pasar inadvertidos.
 *
 *  · D 27 %: discriminación por grupos extremos, alternativa clásica que se
 *    reporta junto a la anterior por ser la más citada en manuales.
 */
export function analisisItems(respuestas: boolean[][]): AnalisisItem[] {
  const n = respuestas.length;
  const k = n > 0 ? respuestas[0].length : 0;
  if (n === 0 || k === 0) return [];

  const totales = respuestas.map((f) => f.filter(Boolean).length);
  const suficientes = n >= MIN_PERSONAS_ITEM;

  // Grupos extremos del 27 % por puntaje total (Kelley, 1939).
  const orden = totales.map((t, i) => ({ t, i })).sort((a, b) => b.t - a.t);
  const n27 = Math.max(1, Math.round(n * 0.27));
  const superior = orden.slice(0, n27).map((o) => o.i);
  const inferior = orden.slice(n - n27).map((o) => o.i);

  return Array.from({ length: k }, (_, i) => {
    const columna = respuestas.map((f) => (f[i] ? 1 : 0));
    const dificultad = columna.reduce((a, b) => a + b, 0) / n;

    // Total SIN el ítem i (corrección).
    const resto = respuestas.map((f, j) => totales[j] - (f[i] ? 1 : 0));
    const r = pearson(columna, resto);
    const discriminacion = Number.isNaN(r.r) ? null : r.r;

    const pSup = superior.reduce((a, j) => a + (respuestas[j][i] ? 1 : 0), 0) / superior.length;
    const pInf = inferior.reduce((a, j) => a + (respuestas[j][i] ? 1 : 0), 0) / inferior.length;
    const d27 = pSup - pInf;

    let veredicto: AnalisisItem['veredicto'];
    let motivo: string;
    if (!suficientes) {
      veredicto = 'aceptable';
      motivo = `Con ${n} respuestas no hay base para juzgar el ítem (se requieren ${MIN_PERSONAS_ITEM}).`;
    } else if (discriminacion === null) {
      veredicto = 'problemático';
      motivo = 'Todos respondieron igual: el ítem no distingue a nadie.';
    } else if (discriminacion < 0) {
      veredicto = 'problemático';
      motivo = 'Discriminación NEGATIVA: quienes más saben tienden a fallarlo. Revisar enunciado y clave.';
    } else if (discriminacion < 0.2) {
      veredicto = 'débil';
      motivo = 'Discrimina poco entre quienes saben y quienes no.';
    } else if (dificultad > 0.9) {
      veredicto = 'débil';
      motivo = 'Casi todos lo aciertan: aporta poca información.';
    } else if (dificultad < 0.1) {
      veredicto = 'débil';
      motivo = 'Casi nadie lo acierta: aporta poca información.';
    } else if (discriminacion >= 0.4) {
      veredicto = 'bueno';
      motivo = 'Dificultad adecuada y buena discriminación.';
    } else {
      veredicto = 'aceptable';
      motivo = 'Funciona correctamente.';
    }

    return { indice: i, dificultad, discriminacion, d27, veredicto, motivo };
  });
}

// ── Ajuste al modelo de Rasch ───────────────────────────────────────────────

export interface Ajuste {
  infit: number;
  outfit: number;
  /** Interpretación conjunta según el rango productivo habitual [0.5, 1.5]. */
  veredicto: 'ajuste aceptable' | 'demasiado predecible' | 'errático';
}

/**
 * ESTADÍSTICOS DE AJUSTE INFIT y OUTFIT (Wright & Masters, 1982).
 *
 *  Permiten afirmar no solo que "se aplicó el modelo de Rasch", sino que el
 *  modelo DESCRIBE razonablemente los datos — que es lo que un tribunal pide.
 *
 *  Para cada respuesta observada x (0/1), el modelo predice P y su varianza
 *  W = P(1−P). El residual estandarizado es z = (x − P)/√W.
 *
 *      OUTFit (outlier-sensitive) = media de z²
 *          → sensible a respuestas MUY inesperadas (un experto fallando algo
 *            trivial). Un valor alto suele venir de pocos casos raros.
 *
 *      INFit (information-weighted) = Σ(x − P)² / Σ W
 *          → pondera por información, así que da más peso a las respuestas a
 *            ítems cercanos a la habilidad del estudiante, donde el modelo
 *            realmente se juega su capacidad predictiva.
 *
 *  Ambos tienen valor esperado 1. Rango productivo habitual: 0.5 – 1.5.
 *   · > 1.5 → errático: hay más ruido del que el modelo explica.
 *   · < 0.5 → demasiado predecible: las respuestas encajan "demasiado bien",
 *     lo que suele indicar dependencia entre ítems (redundancia).
 */
export function ajusteRasch(
  observado: number[], probabilidades: number[],
): Ajuste {
  if (observado.length !== probabilidades.length || observado.length === 0) {
    return { infit: NaN, outfit: NaN, veredicto: 'ajuste aceptable' };
  }

  let sumaZ2 = 0;
  let sumaResid2 = 0;
  let sumaW = 0;
  let usados = 0;

  for (let i = 0; i < observado.length; i++) {
    const P = probabilidades[i];
    const W = P * (1 - P);
    // Con P en 0 o 1 la varianza es nula y z² se indetermina: se omite.
    if (!Number.isFinite(W) || W < 1e-12) continue;
    const resid = observado[i] - P;
    sumaZ2 += (resid * resid) / W;
    sumaResid2 += resid * resid;
    sumaW += W;
    usados++;
  }

  if (usados === 0 || sumaW === 0) {
    return { infit: NaN, outfit: NaN, veredicto: 'ajuste aceptable' };
  }

  const outfit = sumaZ2 / usados;
  const infit = sumaResid2 / sumaW;

  const fuera = (v: number) => v > 1.5 || v < 0.5;
  let veredicto: Ajuste['veredicto'] = 'ajuste aceptable';
  if (infit > 1.5 || outfit > 1.5) veredicto = 'errático';
  else if (fuera(infit) || fuera(outfit)) veredicto = 'demasiado predecible';

  return { infit, outfit, veredicto };
}
