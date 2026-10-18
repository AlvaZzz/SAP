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
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  descriptivos, efectoUnaMuestra, levene, mannWhitney, pearson, rangos,
  shapiroWilk, spearman, tIndependiente, tUnaMuestra, tamanoEfecto, wilcoxonUnaMuestra,
} from './inferencia';
import { pValorT, pValorF, normalCdf, normalInv, tCritico } from './distribuciones';

const A = [12, 15, 18, 20, 22, 25, 28, 30, 33, 35];
const B = [10, 14, 16, 19, 21, 23, 24, 27, 29, 31];
const PRE = [45, 52, 38, 60, 55, 49, 41, 58];
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


describe('contraste de una muestra frente a un valor de referencia', () => {
  it('t de una muestra coincide con scipy.stats.ttest_1samp', () => {
    // scipy: ttest_1samp([1,2,3,4,5], 2) → t=1.4142135623730951, p=0.23019964108049873
    const r = tUnaMuestra([1, 2, 3, 4, 5], 2);
    expect(r.estadistico).toBeCloseTo(Math.SQRT2, PREC);
    expect(r.gl).toBe(4);
    expect(r.p).toBeCloseTo(0.2301996, 4);
    expect(r.diferencia).toBeCloseTo(1, PREC);
    // IC 95 % de la media: 3 ± 2.776445 · 0.7071068
    expect(r.ic95![0]).toBeCloseTo(3 - 2.776445105 * Math.SQRT1_2, 4);
    expect(r.ic95![1]).toBeCloseTo(3 + 2.776445105 * Math.SQRT1_2, 4);
  });

  it('Wilcoxon exacto: todas las diferencias positivas', () => {
    // scipy: wilcoxon([1,2,3,4,5]) → statistic=0.0, p=0.0625
    const r = wilcoxonUnaMuestra([81, 82, 83, 84, 85], 80);
    expect(r.exacto).toBe(true);
    expect(r.estadistico).toBe(0);
    expect(r.p).toBeCloseTo(0.0625, PREC);
  });

  it('Wilcoxon exacto con signos mezclados', () => {
    // diferencias -2,1,3,7,10,-5 → W⁻ = 2+4 = 6; scipy: wilcoxon(...) → statistic=6.0, p=0.4375
    const r = wilcoxonUnaMuestra([78, 81, 83, 87, 90, 75], 80);
    expect(r.estadistico).toBe(6);
    expect(r.p).toBeCloseTo(0.4375, PREC);
  });

  it('Wilcoxon descarta las diferencias nulas y usa la aproximación normal con empates', () => {
    const r = wilcoxonUnaMuestra([80, 80, 82, 82, 84, 84, 70], 80);
    expect(r.exacto).toBe(false);
    expect(r.p).toBeGreaterThan(0);
    expect(r.p).toBeLessThanOrEqual(1);
  });

  it('d de Cohen de una muestra = (x̄ − μ₀)/s', () => {
    const e = efectoUnaMuestra([1, 2, 3, 4, 5], 2);
    expect(e.d).toBeCloseTo(1 / Math.sqrt(2.5), PREC);
    expect(e.magnitud).toBe('mediano');
  });
});
