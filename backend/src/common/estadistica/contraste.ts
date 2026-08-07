/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MOTOR DE CONTRASTE — elige la prueba correcta y la justifica
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Aplicar una t de Student sobre datos que no cumplen sus supuestos, sin
 *  advertirlo, es un error metodológico grave. Este módulo evita que eso pueda
 *  ocurrir: dado un par de series, VERIFICA los supuestos primero y solo
 *  entonces decide qué prueba corresponde, dejando por escrito el porqué.
 *
 *  También hace algo que un tablero de métricas nunca haría: NEGARSE A
 *  RESPONDER. Si el tamaño de muestra no da, no se emite ningún valor p — se
 *  explica qué falta. Un p calculado con n=2 no es un resultado débil: es un
 *  número sin significado que invita a una conclusión falsa.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  Descriptivos, ResultadoContraste, TamanoEfecto, descriptivos, levene,
  mannWhitney, shapiroWilk, tIndependiente, tPareada, tamanoEfecto,
  tamanoEfectoPareado, wilcoxon,
} from './inferencia';

/** Nivel de significancia adoptado en el estudio. */
export const ALFA = 0.05;

/**
 * Mínimo ABSOLUTO por grupo para calcular cualquier cosa. Por debajo de 3 ni
 * siquiera se puede evaluar la normalidad (Shapiro-Wilk requiere n≥3).
 */
export const MIN_CALCULO = 3;

/**
 * Mínimo por grupo para que el resultado sea INTERPRETABLE y reportable como
 * evidencia. Entre MIN_CALCULO y este umbral el número se calcula pero se
 * marca como preliminar: con muestras así de pequeñas la prueba tiene tan poca
 * potencia que un "no significativo" no distingue entre "no hay efecto" y "no
 * hay datos para verlo".
 */
export const MIN_INTERPRETABLE = 10;

export interface Supuesto {
  nombre: string;
  estadistico: number | null;
  p: number | null;
  cumple: boolean | null;
  detalle: string;
}

export interface Comparacion {
  variable: string;
  /** Descriptivos de cada serie, siempre presentes aunque el contraste se bloquee. */
  grupoA: Descriptivos & { etiqueta: string };
  grupoB: Descriptivos & { etiqueta: string };
  /** false → no se emite ningún valor p, y `bloqueo` dice por qué. */
  calculado: boolean;
  bloqueo: string | null;
  /** true solo si además hay n suficiente para tomarlo como evidencia. */
  interpretable: boolean;
  advertencia: string | null;
  supuestos: Supuesto[];
  prueba: string | null;
  justificacion: string | null;
  resultado: ResultadoContraste | null;
  efecto: TamanoEfecto | null;
  significativo: boolean | null;
  /** Lectura en lenguaje llano, redactada para poder decirla en la defensa. */
  interpretacion: string;
}

function etiquetar(xs: number[], etiqueta: string): Descriptivos & { etiqueta: string } {
  return { ...descriptivos(xs), etiqueta };
}

function fmt(v: number, dec = 2): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(dec);
}

/** Formatea un valor p como se reporta en un informe académico. */
export function formatearP(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.001) return 'p < 0.001';
  return `p = ${p.toFixed(3)}`;
}

/**
 * COMPARACIÓN ENTRE DOS GRUPOS INDEPENDIENTES (control vs. experimental).
 *
 *  Secuencia metodológica que sigue:
 *   1. ¿Hay n suficiente? Si no → se bloquea y se explica.
 *   2. Shapiro-Wilk en cada grupo → ¿son normales?
 *   3. Si alguno NO es normal → U de Mann-Whitney (no paramétrica).
 *   4. Si ambos son normales → Levene:
 *        · varianzas homogéneas   → t de Student
 *        · varianzas heterogéneas → t de Welch
 *   5. Tamaño del efecto SIEMPRE, porque un p sin efecto está incompleto.
 */
export function compararGrupos(
  a: number[], b: number[],
  opciones: { variable: string; etiquetaA?: string; etiquetaB?: string },
): Comparacion {
  const { variable, etiquetaA = 'Control', etiquetaB = 'Experimental' } = opciones;
  const base = {
    variable,
    grupoA: etiquetar(a, etiquetaA),
    grupoB: etiquetar(b, etiquetaB),
    supuestos: [] as Supuesto[],
    prueba: null,
    justificacion: null,
    resultado: null,
    efecto: null,
    significativo: null,
  };

  // ── 1. ¿Hay datos para calcular algo? ──
  if (a.length < MIN_CALCULO || b.length < MIN_CALCULO) {
    const falta = `${etiquetaA}: n=${a.length} · ${etiquetaB}: n=${b.length}`;
    return {
      ...base,
      calculado: false,
      interpretable: false,
      advertencia: null,
      bloqueo: `Se requieren al menos ${MIN_CALCULO} casos por grupo para cualquier contraste. Actualmente ${falta}.`,
      interpretacion:
        'No se emite ningún valor p: con esta cantidad de casos cualquier cifra sería ruido presentado como evidencia. ' +
        'Lo que falta no es cálculo, es recolección de datos.',
    };
  }

  // ── 2. Normalidad (Shapiro-Wilk) ──
  const swA = shapiroWilk(a);
  const swB = shapiroWilk(b);
  const normalA = Number.isFinite(swA.p) ? swA.p >= ALFA : null;
  const normalB = Number.isFinite(swB.p) ? swB.p >= ALFA : null;

  const supuestos: Supuesto[] = [
    {
      nombre: `Normalidad (Shapiro-Wilk) — ${etiquetaA}`,
      estadistico: Number.isFinite(swA.W) ? swA.W : null,
      p: Number.isFinite(swA.p) ? swA.p : null,
      cumple: normalA,
      detalle: normalA === null
        ? 'No evaluable con estos datos.'
        : normalA
          ? `W = ${fmt(swA.W, 3)}, ${formatearP(swA.p)} → la distribución no se aparta de la normal.`
          : `W = ${fmt(swA.W, 3)}, ${formatearP(swA.p)} → los datos NO son normales.`,
    },
    {
      nombre: `Normalidad (Shapiro-Wilk) — ${etiquetaB}`,
      estadistico: Number.isFinite(swB.W) ? swB.W : null,
      p: Number.isFinite(swB.p) ? swB.p : null,
      cumple: normalB,
      detalle: normalB === null
        ? 'No evaluable con estos datos.'
        : normalB
          ? `W = ${fmt(swB.W, 3)}, ${formatearP(swB.p)} → la distribución no se aparta de la normal.`
          : `W = ${fmt(swB.W, 3)}, ${formatearP(swB.p)} → los datos NO son normales.`,
    },
  ];

  // ── 3. Homogeneidad de varianzas (Levene) ──
  const lev = levene([a, b], 'media');
  const homogeneas = Number.isFinite(lev.p) ? lev.p >= ALFA : null;
  supuestos.push({
    nombre: 'Homogeneidad de varianzas (Levene)',
    estadistico: Number.isFinite(lev.F) ? lev.F : null,
    p: Number.isFinite(lev.p) ? lev.p : null,
    cumple: homogeneas,
    detalle: homogeneas === null
      ? 'No evaluable con estos datos.'
      : homogeneas
        ? `F(${lev.gl1}, ${lev.gl2}) = ${fmt(lev.F)}, ${formatearP(lev.p)} → varianzas comparables.`
        : `F(${lev.gl1}, ${lev.gl2}) = ${fmt(lev.F)}, ${formatearP(lev.p)} → las varianzas difieren.`,
  });

  // ── 4. Elección de la prueba ──
  const noNormal = normalA === false || normalB === false;
  let resultado: ResultadoContraste;
  let prueba: string;
  let justificacion: string;

  if (noNormal) {
    resultado = mannWhitney(a, b);
    const mw = resultado as ReturnType<typeof mannWhitney>;
    prueba = 'U de Mann-Whitney';
    justificacion =
      'Se usa la prueba NO PARAMÉTRICA porque Shapiro-Wilk indica que al menos un grupo no sigue una ' +
      'distribución normal, y en ese caso la t de Student no es válida. ' +
      (mw.exacto ? 'Valor p exacto.' : 'Valor p por aproximación normal con corrección por empates.');
  } else if (homogeneas === false) {
    resultado = tIndependiente(a, b, true);
    prueba = 't de Welch';
    justificacion =
      'Se usa la t de WELCH y no la de Student porque Levene indica que las varianzas de los dos grupos ' +
      'difieren; Welch no asume varianzas iguales y ajusta los grados de libertad.';
  } else {
    resultado = tIndependiente(a, b, false);
    prueba = 't de Student para muestras independientes';
    justificacion =
      'Se cumplen los dos supuestos (normalidad en ambos grupos y homogeneidad de varianzas), ' +
      'por lo que la t de Student es la prueba apropiada.';
  }

  const efecto = tamanoEfecto(a, b);
  const significativo = Number.isFinite(resultado.p) ? resultado.p < ALFA : null;

  // ── 5. ¿Es interpretable como evidencia? ──
  const interpretable = a.length >= MIN_INTERPRETABLE && b.length >= MIN_INTERPRETABLE;
  const advertencia = interpretable
    ? null
    : `Resultado PRELIMINAR: con ${a.length} y ${b.length} casos la prueba tiene muy poca potencia. ` +
      `Un resultado no significativo aquí no permite concluir que no haya diferencia — solo que no hay datos suficientes para detectarla. ` +
      `Se recomiendan al menos ${MIN_INTERPRETABLE} casos por grupo.`;

  // ── Lectura en lenguaje llano ──
  // Ojo con la redacción: las pruebas t comparan MEDIAS, pero Mann-Whitney
  // compara distribuciones y aquí la diferencia reportada es de MEDIANAS.
  // Llamarla "diferencia de medias" en ese caso sería incorrecto.
  const dif = resultado.diferencia;
  const tipoDif = noNormal ? 'la diferencia de medianas' : 'la diferencia de medias';
  const direccion = dif === null ? '' : dif > 0 ? `${etiquetaA} por encima` : `${etiquetaB} por encima`;
  let interpretacion: string;
  if (significativo === null) {
    interpretacion = 'No se pudo completar el contraste con estos datos.';
  } else if (significativo) {
    interpretacion =
      `Existe una diferencia estadísticamente significativa en ${variable} (${formatearP(resultado.p)}), con ${direccion} ` +
      `en ${fmt(Math.abs(dif ?? 0))} puntos (${tipoDif}). El tamaño del efecto es ${efecto.magnitud} (d = ${fmt(efecto.d)}, g = ${fmt(efecto.g)}), ` +
      'lo que indica la magnitud práctica de esa diferencia, más allá de que sea significativa.';
  } else {
    interpretacion =
      `No se detecta una diferencia estadísticamente significativa en ${variable} (${formatearP(resultado.p)}). ` +
      `La diferencia observada es de ${fmt(Math.abs(dif ?? 0))} puntos (${tipoDif}), con un tamaño del efecto ${efecto.magnitud} (d = ${fmt(efecto.d)}).`;
  }
  if (resultado.ic95) {
    interpretacion +=
      ` El intervalo de confianza del 95 % para la diferencia va de ${fmt(resultado.ic95[0])} a ${fmt(resultado.ic95[1])}` +
      (resultado.ic95[0] <= 0 && resultado.ic95[1] >= 0
        ? ', y al contener el cero es coherente con la ausencia de diferencia.'
        : ', y al no contener el cero respalda que la diferencia es real.');
  }

  return {
    ...base,
    calculado: true,
    bloqueo: null,
    interpretable,
    advertencia,
    supuestos,
    prueba,
    justificacion,
    resultado,
    efecto,
    significativo,
    interpretacion,
  };
}

/**
 * COMPARACIÓN PRE-POST DENTRO DE UN MISMO GRUPO (medidas repetidas).
 *
 *  Misma disciplina: verifica la normalidad DE LAS DIFERENCIAS (que es el
 *  supuesto real de la t pareada, no la normalidad de pre y post por separado,
 *  un error frecuente) y cae a Wilcoxon si no se cumple.
 */
export function compararPrePost(
  pre: number[], post: number[],
  opciones: { variable: string; etiqueta?: string },
): Comparacion {
  const { variable, etiqueta = 'Grupo' } = opciones;
  if (pre.length !== post.length) {
    throw new Error('compararPrePost: las series pre y post deben estar emparejadas');
  }

  const base = {
    variable,
    grupoA: etiquetar(pre, `${etiqueta} — pretest`),
    grupoB: etiquetar(post, `${etiqueta} — postest`),
    supuestos: [] as Supuesto[],
    prueba: null,
    justificacion: null,
    resultado: null,
    efecto: null,
    significativo: null,
  };

  if (pre.length < MIN_CALCULO) {
    return {
      ...base,
      calculado: false,
      interpretable: false,
      advertencia: null,
      bloqueo: `Se requieren al menos ${MIN_CALCULO} estudiantes con pretest Y postest. Actualmente hay ${pre.length}.`,
      interpretacion:
        'No se emite ningún valor p: no hay casos completos suficientes para contrastar el avance.',
    };
  }

  // El supuesto de la t pareada recae sobre las DIFERENCIAS, no sobre cada serie.
  const d = post.map((v, i) => v - pre[i]);
  const sw = shapiroWilk(d);
  const normal = Number.isFinite(sw.p) ? sw.p >= ALFA : null;

  const supuestos: Supuesto[] = [{
    nombre: 'Normalidad de las diferencias (Shapiro-Wilk)',
    estadistico: Number.isFinite(sw.W) ? sw.W : null,
    p: Number.isFinite(sw.p) ? sw.p : null,
    cumple: normal,
    detalle: normal === null
      ? 'No evaluable (probablemente todas las diferencias son iguales).'
      : normal
        ? `W = ${fmt(sw.W, 3)}, ${formatearP(sw.p)} → las diferencias se distribuyen normalmente.`
        : `W = ${fmt(sw.W, 3)}, ${formatearP(sw.p)} → las diferencias NO son normales.`,
  }];

  let resultado: ResultadoContraste;
  let prueba: string;
  let justificacion: string;

  if (normal === false) {
    resultado = wilcoxon(post, pre);
    prueba = 'Wilcoxon de rangos con signo';
    justificacion =
      'Se usa la alternativa NO PARAMÉTRICA porque las diferencias pre-post no siguen una distribución ' +
      'normal, supuesto que exige la t pareada.';
  } else {
    resultado = tPareada(post, pre);
    prueba = 't de Student para muestras pareadas';
    justificacion =
      'Las diferencias pre-post se distribuyen normalmente, por lo que la t pareada es apropiada. ' +
      'Al comparar a cada estudiante consigo mismo, elimina la variabilidad entre personas.';
  }

  const efecto = tamanoEfectoPareado(post, pre);
  const significativo = Number.isFinite(resultado.p) ? resultado.p < ALFA : null;
  const interpretable = pre.length >= MIN_INTERPRETABLE;

  let interpretacion: string;
  if (significativo === null) {
    interpretacion = 'No se pudo completar el contraste con estos datos.';
  } else if (significativo) {
    const sube = (resultado.diferencia ?? 0) > 0;
    // Con Wilcoxon la diferencia reportada es la MEDIANA de las diferencias,
    // no su media: nombrarla mal induciría a error al citarla en la tesis.
    const tipoDif = normal === false ? 'mediana de las diferencias' : 'cambio medio';
    interpretacion =
      `${etiqueta} ${sube ? 'MEJORA' : 'RETROCEDE'} de forma estadísticamente significativa entre el pretest y el postest ` +
      `(${formatearP(resultado.p)}), con un ${tipoDif} de ${fmt(Math.abs(resultado.diferencia ?? 0))} puntos ` +
      `y un tamaño del efecto ${efecto.magnitud} (d = ${fmt(efecto.d)}).`;
  } else {
    interpretacion =
      `No se detecta un cambio estadísticamente significativo entre pretest y postest en ${etiqueta} ` +
      `(${formatearP(resultado.p)}).`;
  }

  return {
    ...base,
    calculado: true,
    bloqueo: null,
    interpretable,
    advertencia: interpretable
      ? null
      : `Resultado PRELIMINAR: solo ${pre.length} casos completos. Se recomiendan al menos ${MIN_INTERPRETABLE}.`,
    supuestos,
    prueba,
    justificacion,
    resultado,
    efecto,
    significativo,
    interpretacion,
  };
}
