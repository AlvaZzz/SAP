/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  VERIFICACIÓN DEL MOTOR ESTADÍSTICO CONTRA scipy
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Regla del proyecto: un número mal calculado es peor que no tenerlo. Cada
 *  estadístico que PREXI reporta en la tesis se contrasta aquí contra el valor
 *  producido por scipy 1.18.0 / numpy 2.5.1, y ese valor de referencia queda
 *  escrito en el propio test junto a la llamada que lo generó.
 *
 *  Reproducir las referencias:
 *      python -c "from scipy import stats; print(stats.ttest_ind(A, B))"
 *
 *  Series de prueba usadas en todo el archivo:
 *      A = [12, 15, 18, 20, 22, 25, 28, 30, 33, 35]
 *      B = [10, 14, 16, 19, 21, 23, 24, 27, 29, 31]
 *      PRE  = [45, 52, 38, 60, 55, 49, 41, 58]
 *      POST = [62, 70, 55, 78, 68, 66, 59, 75]
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  descriptivos, hake, clasificarHake, levene, mannWhitney, pearson, rangos,
  shapiroWilk, spearman, tIndependiente, tPareada, tamanoEfecto, wilcoxon,
} from './inferencia';
import { pValorT, pValorF, normalCdf, normalInv, tCritico } from './distribuciones';

const A = [12, 15, 18, 20, 22, 25, 28, 30, 33, 35];
const B = [10, 14, 16, 19, 21, 23, 24, 27, 29, 31];
const PRE = [45, 52, 38, 60, 55, 49, 41, 58];
const POST = [62, 70, 55, 78, 68, 66, 59, 75];
// Variante sin empates en |post − pre|, necesaria para la Wilcoxon exacta.
const PRE2 = [45, 52, 38, 60, 55, 49, 41, 58];
const POST2 = [50, 60, 49, 74, 72, 68, 63, 82];
const X = [5, 8, 12, 15, 18, 22, 25, 30];
const Y = [10, 14, 13, 20, 24, 25, 31, 35];
const SESGADO = [1, 1, 2, 2, 3, 3, 4, 50, 60, 80];

/** Tolerancia por defecto: 6 decimales. Las aproximaciones asintóticas usan menos. */
const PREC = 6;

describe('distribuciones (base de todos los valores p)', () => {
  it('Φ(z) coincide con scipy.stats.norm.cdf', () => {
    // scipy: norm.cdf(0)=0.5, norm.cdf(1.96)=0.9750021048517795, norm.cdf(-2.5)=0.006209665325776132
    expect(normalCdf(0)).toBeCloseTo(0.5, 12);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021048517795, 8);
    expect(normalCdf(-2.5)).toBeCloseTo(0.006209665325776132, 8);
  });

  it('Φ⁻¹(p) coincide con scipy.stats.norm.ppf', () => {
    // scipy: norm.ppf(0.975)=1.959963984540054, norm.ppf(0.025)=-1.959963984540054
    expect(normalInv(0.975)).toBeCloseTo(1.959963984540054, 9);
    expect(normalInv(0.025)).toBeCloseTo(-1.959963984540054, 9);
    expect(normalInv(0.5)).toBeCloseTo(0, 10);
  });

  it('el valor p bilateral de la t coincide con scipy.stats.t.sf(|t|,gl)*2', () => {
    // scipy: t.sf(2.0,10)*2 = 0.07338803477074037
    expect(pValorT(2.0, 10)).toBeCloseTo(0.07338803477074037, PREC);
    // scipy: t.sf(3.5,7)*2 = 0.009993040881885549
    expect(pValorT(3.5, 7)).toBeCloseTo(0.009993040881885549, PREC);
    // Simetría: el signo de t no altera el p bilateral.
    expect(pValorT(-2.0, 10)).toBeCloseTo(pValorT(2.0, 10), 12);
  });

  it('la cola superior de la F coincide con scipy.stats.f.sf', () => {
    // scipy: f.sf(4.0, 2, 15) = 0.04052524720967114
    expect(pValorF(4.0, 2, 15)).toBeCloseTo(0.04052524720967114, PREC);
    // scipy: f.sf(2.5, 3, 20) = 0.08884375193768917
    expect(pValorF(2.5, 3, 20)).toBeCloseTo(0.08884375193768917, PREC);
  });

  it('el t crítico coincide con scipy.stats.t.ppf(0.975, gl)', () => {
    // scipy: t.ppf(0.975, 18) = 2.1009220402410382
    expect(tCritico(18, 0.95)).toBeCloseTo(2.1009220402410382, 6);
    // scipy: t.ppf(0.975, 7) = 2.364624251592784
    expect(tCritico(7, 0.95)).toBeCloseTo(2.364624251592784, 6);
  });
});

describe('descriptivos', () => {
  it('media y desviación muestral coinciden con numpy (ddof=1)', () => {
    // numpy: mean(A)=23.8, std(A, ddof=1)=7.714344503009384
    const d = descriptivos(A);
    expect(d.n).toBe(10);
    expect(d.media).toBeCloseTo(23.8, 10);
    expect(d.sd).toBeCloseTo(7.714344503009384, 10);
    expect(d.min).toBe(12);
    expect(d.max).toBe(35);
  });

  it('la mediana promedia los dos centrales cuando n es par', () => {
    expect(descriptivos([1, 2, 3, 4]).mediana).toBe(2.5);
    expect(descriptivos([1, 2, 3]).mediana).toBe(2);
  });

  it('con n<2 no inventa una desviación', () => {
    const d = descriptivos([5]);
    expect(d.n).toBe(1);
    expect(d.sd).toBe(0);
  });
});

describe('prueba t de muestras independientes', () => {
  it('Student coincide con scipy.stats.ttest_ind(A, B, equal_var=True)', () => {
    // scipy: statistic=0.740264509037399, pvalue=0.46868613138693627, df=18
    const r = tIndependiente(A, B, false);
    expect(r.estadistico).toBeCloseTo(0.740264509037399, PREC);
    expect(r.p).toBeCloseTo(0.46868613138693627, PREC);
    expect(r.gl).toBe(18);
  });

  it('el IC95 coincide con scipy .confidence_interval(0.95)', () => {
    // scipy: low=-4.411366525102118, high=9.211366525102122
    const r = tIndependiente(A, B, false);
    expect(r.ic95![0]).toBeCloseTo(-4.411366525102118, 6);
    expect(r.ic95![1]).toBeCloseTo(9.211366525102122, 6);
  });

  it('Welch coincide con scipy.stats.ttest_ind(A, B, equal_var=False)', () => {
    // scipy: statistic=0.7402645090373992, pvalue=0.46885136240363584, df=17.69014551252338
    const r = tIndependiente(A, B, true);
    expect(r.estadistico).toBeCloseTo(0.7402645090373992, PREC);
    expect(r.p).toBeCloseTo(0.46885136240363584, PREC);
    expect(r.gl).toBeCloseTo(17.69014551252338, 8);
    // scipy IC95 Welch: low=-4.4199283624783385, high=9.219928362478342
    expect(r.ic95![0]).toBeCloseTo(-4.4199283624783385, 6);
    expect(r.ic95![1]).toBeCloseTo(9.219928362478342, 6);
  });

  it('con menos de 2 observaciones por grupo devuelve NaN en vez de un número falso', () => {
    const r = tIndependiente([5], [3, 4, 5], false);
    expect(Number.isNaN(r.estadistico)).toBe(true);
    expect(r.ic95).toBeNull();
  });
});

describe('prueba t de muestras pareadas', () => {
  it('coincide con scipy.stats.ttest_rel(POST, PRE)', () => {
    // scipy: statistic=29.066605403260873, pvalue=1.4684716658450866e-08, df=7
    const r = tPareada(POST, PRE);
    expect(r.estadistico).toBeCloseTo(29.066605403260873, 6);
    expect(r.p).toBeCloseTo(1.4684716658450866e-8, 12);
    expect(r.gl).toBe(7);
  });

  it('el IC95 de la diferencia media coincide con scipy', () => {
    // scipy: low=15.502186295336998, high=18.247813704663002
    const r = tPareada(POST, PRE);
    expect(r.ic95![0]).toBeCloseTo(15.502186295336998, 6);
    expect(r.ic95![1]).toBeCloseTo(18.247813704663002, 6);
    expect(r.diferencia).toBeCloseTo(16.875, 10);
  });

  it('rechaza series de distinto tamaño en vez de emparejar mal', () => {
    expect(() => tPareada([1, 2, 3], [1, 2])).toThrow();
  });
});

describe('tamaño del efecto', () => {
  it('d de Cohen y g de Hedges coinciden con el cálculo de referencia', () => {
    // numpy: sp=sqrt(((n1-1)v1+(n2-1)v2)/(n1+n2-2)); d=(mean(A)-mean(B))/sp
    //        d = 0.33105635270762634
    //        J = 1 - 3/(4*18-1) = 0.9577464788732395  →  g = 0.31706805611434635
    const e = tamanoEfecto(A, B);
    expect(e.d).toBeCloseTo(0.33105635270762634, 10);
    expect(e.g).toBeCloseTo(0.31706805611434635, 10);
    expect(e.magnitud).toBe('pequeño');
  });

  it('g siempre es menor que d en magnitud (corrección por muestra pequeña)', () => {
    const e = tamanoEfecto(A, B);
    expect(Math.abs(e.g)).toBeLessThan(Math.abs(e.d));
  });

  it('clasifica la magnitud por los cortes de Cohen', () => {
    expect(tamanoEfecto([1, 2, 3], [1, 2, 3]).magnitud).toBe('insignificante');
    // Diferencia de 10 con sd≈1 → d muy grande
    expect(tamanoEfecto([11, 12, 13], [1, 2, 3]).magnitud).toBe('grande');
  });
});

describe('Shapiro-Wilk (supuesto de normalidad)', () => {
  it('coincide con scipy.stats.shapiro sobre datos normales (A)', () => {
    // scipy: W=0.9698667029008294, p=0.8896066125991257
    const r = shapiroWilk(A);
    expect(r.W).toBeCloseTo(0.9698667029008294, 4);
    expect(r.p).toBeCloseTo(0.8896066125991257, 3);
  });

  it('coincide con scipy sobre datos claramente NO normales (SESGADO)', () => {
    // scipy: W=0.6825123617325896, p=0.0005411357974647065
    const r = shapiroWilk(SESGADO);
    expect(r.W).toBeCloseTo(0.6825123617325896, 4);
    expect(r.p).toBeCloseTo(0.0005411357974647065, 4);
    // Lo esencial para el sistema: detecta que NO es normal.
    expect(r.p).toBeLessThan(0.05);
  });

  it('coincide con scipy con n=8 (PRE)', () => {
    // scipy: W=0.9576829641610314, p=0.7877617322702859
    const r = shapiroWilk(PRE);
    expect(r.W).toBeCloseTo(0.9576829641610314, 4);
    expect(r.p).toBeCloseTo(0.7877617322702859, 3);
  });

  it('con n<3 devuelve NaN en vez de un veredicto inventado', () => {
    expect(Number.isNaN(shapiroWilk([1, 2]).W)).toBe(true);
  });

  it('sin variabilidad (todos iguales) devuelve NaN', () => {
    expect(Number.isNaN(shapiroWilk([5, 5, 5, 5]).W)).toBe(true);
  });
});

describe('Levene (supuesto de homogeneidad de varianzas)', () => {
  it('coincide con scipy.stats.levene(A, B, center="mean")', () => {
    // scipy: statistic=0.3676470588235294, pvalue=0.5518606093839844
    const r = levene([A, B], 'media');
    expect(r.F).toBeCloseTo(0.3676470588235294, 8);
    expect(r.p).toBeCloseTo(0.5518606093839844, PREC);
    expect(r.gl1).toBe(1);
    expect(r.gl2).toBe(18);
  });

  it('la variante Brown-Forsythe coincide con center="median"', () => {
    // scipy: statistic=0.3610108303249097, pvalue=0.5554365257273373
    const r = levene([A, B], 'mediana');
    expect(r.F).toBeCloseTo(0.3610108303249097, 8);
    expect(r.p).toBeCloseTo(0.5554365257273373, PREC);
  });

  it('detecta varianzas heterogéneas', () => {
    // scipy levene(A, SESGADO, center='mean'): statistic=17.986239839680753,
    //                                          pvalue=0.0004913607633635009
    const r = levene([A, SESGADO], 'media');
    expect(r.F).toBeCloseTo(17.986239839680753, 6);
    expect(r.p).toBeCloseTo(0.0004913607633635009, PREC);
    expect(r.p).toBeLessThan(0.05);
  });
});

describe('alternativas no paramétricas', () => {
  it('los rangos promedian los empates', () => {
    // scipy.stats.rankdata([10,20,20,30]) = [1, 2.5, 2.5, 4]
    expect(rangos([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
  });

  it('Mann-Whitney exacta coincide con scipy (method="exact")', () => {
    // scipy: mannwhitneyu(A, B, alternative='two-sided', method='exact')
    //        U=59.0, p=0.5288488601182101
    const r = mannWhitney(A, B);
    expect(r.estadistico).toBe(59);
    expect(r.exacto).toBe(true);
    expect(r.p).toBeCloseTo(0.5288488601182101, 8);
  });

  it('con empates cae a la aproximación normal corregida', () => {
    // Series con un valor repetido entre grupos → no se puede usar la exacta.
    const r = mannWhitney([1, 2, 3, 4, 5], [3, 6, 7, 8, 9]);
    expect(r.exacto).toBe(false);
    expect(Number.isFinite(r.p)).toBe(true);
  });

  it('Wilcoxon exacta coincide con scipy (method="exact")', () => {
    // POST2/PRE2 se eligen SIN empates en |d| — diferencias [5,8,11,14,17,19,22,24] —
    // porque con empates la distribución exacta deja de ser válida y el sistema
    // (correctamente) cae a la aproximación normal.
    // scipy: wilcoxon(POST2, PRE2, method='exact') → W=0.0, p=0.0078125
    const r = wilcoxon(POST2, PRE2);
    expect(r.estadistico).toBe(0);
    expect(r.exacto).toBe(true);
    expect(r.p).toBeCloseTo(0.0078125, 10);
    expect(r.nEfectivo).toBe(8);
  });

  it('con empates en |d| NO usa la exacta (sería inválida) y lo declara', () => {
    // POST/PRE sí tiene empates: diferencias [17,18,17,18,13,17,18,17].
    const r = wilcoxon(POST, PRE);
    expect(r.exacto).toBe(false);
    expect(Number.isFinite(r.p)).toBe(true);
  });

  it('Wilcoxon descarta los pares sin cambio y lo refleja en nEfectivo', () => {
    const r = wilcoxon([10, 12, 14], [10, 11, 12]);
    expect(r.nEfectivo).toBe(2); // el primer par no cambió
  });
});

describe('correlación', () => {
  it('Pearson coincide con scipy.stats.pearsonr', () => {
    // scipy: r=0.9802247127128624, p=1.9047799177357384e-05
    const r = pearson(X, Y);
    expect(r.r).toBeCloseTo(0.9802247127128624, 10);
    expect(r.p).toBeCloseTo(1.9047799177357384e-5, 10);
    expect(r.magnitud).toBe('fuerte');
  });

  it('Spearman coincide con scipy.stats.spearmanr', () => {
    // scipy: correlation=0.9761904761904763, pvalue=3.314396026200098e-05
    const r = spearman(X, Y);
    expect(r.r).toBeCloseTo(0.9761904761904763, 10);
    expect(r.p).toBeCloseTo(3.314396026200098e-5, 9);
  });

  it('con menos de 3 pares no calcula nada', () => {
    expect(Number.isNaN(pearson([1, 2], [3, 4]).r)).toBe(true);
  });

  it('sin variabilidad en una serie devuelve NaN en vez de dividir por cero', () => {
    expect(Number.isNaN(pearson([1, 1, 1, 1], [1, 2, 3, 4]).r)).toBe(true);
  });
});

describe('ganancia normalizada de Hake', () => {
  it('expresa lo aprendido como fracción de lo que faltaba por aprender', () => {
    // (60-40)/(100-40) = 0.3333…
    expect(hake(40, 60)!).toBeCloseTo(1 / 3, 12);
    // Quien parte más alto necesita menos puntos para el mismo <g>:
    // (90-80)/(100-80) = 0.5
    expect(hake(80, 90)!).toBeCloseTo(0.5, 12);
  });

  it('un retroceso da ganancia negativa', () => {
    expect(hake(50, 40)!).toBeCloseTo(-0.2, 12);
  });

  it('con pretest de 100 devuelve null (no había margen de mejora)', () => {
    expect(hake(100, 100)).toBeNull();
  });

  it('clasifica según los cortes de Hake (1998)', () => {
    expect(clasificarHake(0.75)).toBe('alta');
    expect(clasificarHake(0.5)).toBe('media');
    expect(clasificarHake(0.1)).toBe('baja');
  });
});
