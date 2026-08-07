/**
 * Verificación del MOTOR DE CONTRASTE: que elija la prueba correcta según los
 * supuestos, y que se NIEGUE a emitir un valor p cuando el n no da.
 *
 * Los estadísticos en sí ya están verificados contra scipy en
 * `inferencia.spec.ts`; aquí se verifica la lógica metodológica que los usa.
 */

import { compararGrupos, compararPrePost, formatearP, MIN_CALCULO, MIN_INTERPRETABLE } from './contraste';

// Dos grupos normales, varianzas parecidas, sin diferencia real.
const NORMAL_A = [52, 55, 58, 60, 62, 64, 66, 68, 70, 73];
const NORMAL_B = [50, 54, 57, 59, 61, 63, 66, 69, 71, 74];
// Grupo con una distribución claramente NO normal (asimétrica y con extremos).
const NO_NORMAL = [1, 1, 2, 2, 3, 3, 4, 50, 60, 80];
// Grupo con varianza mucho mayor, pero razonablemente simétrico.
const DISPERSO = [20, 35, 45, 55, 62, 68, 78, 88, 95, 110];

describe('bloqueo por tamaño de muestra insuficiente', () => {
  it('NO emite valor p con menos de 3 casos en un grupo', () => {
    const c = compararGrupos([70, 75], NORMAL_B, { variable: 'postest' });
    expect(c.calculado).toBe(false);
    expect(c.resultado).toBeNull();
    expect(c.significativo).toBeNull();
    expect(c.bloqueo).toContain(String(MIN_CALCULO));
  });

  it('el bloqueo explica que el problema es de recolección, no de cálculo', () => {
    const c = compararGrupos([70, 75], NORMAL_B, { variable: 'postest' });
    expect(c.interpretacion).toContain('recolección');
  });

  it('aun bloqueado, conserva los descriptivos de ambos grupos', () => {
    const c = compararGrupos([70, 75], NORMAL_B, { variable: 'postest' });
    expect(c.grupoA.n).toBe(2);
    expect(c.grupoA.media).toBe(72.5);
    expect(c.grupoB.n).toBe(10);
  });

  it('reproduce el caso real del estudio (2 control vs 7 experimental): bloquea', () => {
    const control = [45, 52];
    const experimental = [50, 55, 60, 58, 62, 49, 66];
    const c = compararGrupos(control, experimental, { variable: 'postest' });
    expect(c.calculado).toBe(false);
  });

  it('calcula pero marca como PRELIMINAR entre 3 y 10 casos', () => {
    const a = [50, 55, 60, 58];
    const b = [62, 66, 70, 68];
    const c = compararGrupos(a, b, { variable: 'postest' });
    expect(c.calculado).toBe(true);
    expect(c.interpretable).toBe(false);
    expect(c.advertencia).toContain('PRELIMINAR');
    expect(c.advertencia).toContain(String(MIN_INTERPRETABLE));
  });

  it('con n suficiente en ambos grupos no advierte nada', () => {
    const c = compararGrupos(NORMAL_A, NORMAL_B, { variable: 'postest' });
    expect(c.interpretable).toBe(true);
    expect(c.advertencia).toBeNull();
  });
});

describe('elección de la prueba según los supuestos', () => {
  it('con normalidad y varianzas homogéneas usa la t de Student', () => {
    const c = compararGrupos(NORMAL_A, NORMAL_B, { variable: 'postest' });
    expect(c.prueba).toContain('Student');
    expect(c.supuestos.every((s) => s.cumple === true)).toBe(true);
  });

  it('con normalidad pero varianzas heterogéneas usa Welch y lo justifica', () => {
    const c = compararGrupos(NORMAL_A, DISPERSO, { variable: 'postest' });
    const levene = c.supuestos.find((s) => s.nombre.includes('Levene'))!;
    expect(levene.cumple).toBe(false);
    expect(c.prueba).toBe('t de Welch');
    expect(c.justificacion).toContain('WELCH');
  });

  it('si algún grupo NO es normal usa Mann-Whitney, no la t', () => {
    const c = compararGrupos(NORMAL_A, NO_NORMAL, { variable: 'postest' });
    expect(c.prueba).toBe('U de Mann-Whitney');
    expect(c.justificacion).toContain('NO PARAMÉTRICA');
  });

  it('nunca aplica una t sin haber comprobado antes los supuestos', () => {
    const c = compararGrupos(NORMAL_A, NORMAL_B, { variable: 'postest' });
    // Dos de normalidad + uno de homogeneidad, todos con su valor p.
    expect(c.supuestos).toHaveLength(3);
    expect(c.supuestos.every((s) => s.p !== null)).toBe(true);
  });
});

describe('contenido del resultado', () => {
  const c = compararGrupos(NORMAL_A, DISPERSO, { variable: 'postest' });

  it('siempre acompaña el valor p con el tamaño del efecto', () => {
    expect(c.efecto).not.toBeNull();
    expect(Number.isFinite(c.efecto!.d)).toBe(true);
    expect(Number.isFinite(c.efecto!.g)).toBe(true);
    expect(c.efecto!.magnitud).toBeTruthy();
  });

  it('incluye el intervalo de confianza del 95 % en las pruebas t', () => {
    expect(c.resultado!.ic95).not.toBeNull();
    expect(c.resultado!.ic95![0]).toBeLessThan(c.resultado!.ic95![1]);
  });

  it('la interpretación menciona el IC y si contiene el cero', () => {
    expect(c.interpretacion).toContain('intervalo de confianza');
    expect(c.interpretacion).toMatch(/contener el cero|no contener el cero/);
  });

  it('detecta correctamente una diferencia real y grande', () => {
    const bajo = [30, 32, 35, 33, 31, 34, 36, 30, 33, 32];
    const alto = [70, 72, 75, 73, 71, 74, 76, 70, 73, 72];
    const r = compararGrupos(bajo, alto, { variable: 'postest' });
    expect(r.significativo).toBe(true);
    expect(r.efecto!.magnitud).toBe('grande');
    expect(r.interpretacion).toContain('significativa');
  });
});

describe('comparación pre-post (medidas repetidas)', () => {
  // Diferencias verificadas como normales en scipy:
  //   stats.shapiro(POST-PRE) → W=0.970164611230666, p=0.8923673075239242
  //   stats.ttest_rel(POST, PRE) → t=15.144756068145712, p=1.0377923374742305e-07
  const PRE = [40, 45, 38, 50, 42, 47, 44, 41, 46, 43];
  const POST = [56, 57, 56, 60, 57, 60, 61, 52, 60, 62];

  it('evalúa la normalidad de las DIFERENCIAS, no de cada serie por separado', () => {
    const c = compararPrePost(PRE, POST, { variable: 'puntaje', etiqueta: 'Experimental' });
    expect(c.supuestos).toHaveLength(1);
    expect(c.supuestos[0].nombre).toContain('diferencias');
  });

  it('con diferencias normales usa la t pareada', () => {
    const c = compararPrePost(PRE, POST, { variable: 'puntaje', etiqueta: 'Experimental' });
    expect(c.prueba).toContain('pareadas');
    expect(c.significativo).toBe(true);
    expect(c.interpretacion).toContain('MEJORA');
  });

  it('con diferencias no normales cae a Wilcoxon', () => {
    // Casi todos mejoran 1 punto y uno mejora 60: diferencias muy asimétricas.
    const pre = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49];
    const post = [41, 42, 43, 44, 45, 46, 47, 48, 49, 109];
    const c = compararPrePost(pre, post, { variable: 'puntaje', etiqueta: 'Control' });
    expect(c.supuestos[0].cumple).toBe(false);
    expect(c.prueba).toContain('Wilcoxon');
  });

  it('bloquea con menos de 3 casos completos', () => {
    const c = compararPrePost([40, 45], [55, 58], { variable: 'puntaje' });
    expect(c.calculado).toBe(false);
    expect(c.bloqueo).toContain('pretest Y postest');
  });

  it('rechaza series no emparejadas', () => {
    expect(() => compararPrePost([1, 2, 3], [1, 2], { variable: 'x' })).toThrow();
  });

  it('detecta un retroceso además de una mejora', () => {
    // scipy: shapiro(d) → p=0.9146187005560238 (normales)
    //        ttest_rel → t=-14.714285714285714, p=1.333024572323029e-07
    const pre = [60, 62, 65, 63, 61, 64, 66, 60, 63, 62];
    const post = [50, 50, 57, 52, 52, 51, 59, 50, 49, 53];
    const c = compararPrePost(pre, post, { variable: 'puntaje', etiqueta: 'Control' });
    expect(c.interpretacion).toContain('RETROCEDE');
  });
});

describe('formato académico del valor p', () => {
  it('usa la convención p < 0.001 para valores muy pequeños', () => {
    expect(formatearP(0.0000004)).toBe('p < 0.001');
  });

  it('reporta tres decimales en el resto de casos', () => {
    expect(formatearP(0.0432)).toBe('p = 0.043');
    expect(formatearP(0.5)).toBe('p = 0.500');
  });
});
