/**
 * Verificación del módulo de FIABILIDAD contra referencias de numpy/scipy.
 *
 *  Matriz de prueba (8 estudiantes × 6 ítems, 1 = acierto). Es la misma que se
 *  usó en Python para producir cada valor esperado:
 *
 *      M = [[1,1,1,1,0,0],
 *           [1,1,1,0,0,0],
 *           [1,1,0,1,1,0],
 *           [1,0,1,0,0,0],
 *           [1,1,1,1,1,1],
 *           [0,1,0,0,0,0],
 *           [1,1,1,1,0,1],
 *           [1,0,0,0,0,0]]
 *
 *  KR-20 de referencia:
 *      p = M.mean(axis=0); var_total = M.sum(axis=1).var(ddof=1)
 *      kr20 = (k/(k-1))*(1 - (p*(1-p)).sum()/var_total)
 *
 *  Discriminación de referencia:
 *      scipy.stats.pearsonr(M[:,i], np.delete(M, i, axis=1).sum(axis=1))
 *
 *  Ajuste de Rasch: implementación independiente en Python de las fórmulas de
 *  Wright & Masters (1982), con θ y b fijos (no hay paquete Rasch disponible
 *  sin conexión, así que la referencia es una segunda implementación de la
 *  fórmula publicada, no un paquete certificado).
 */

import { ajusteRasch, alfaCronbach, analisisItems, kr20 } from './fiabilidad';

const M: boolean[][] = [
  [1, 1, 1, 1, 0, 0],
  [1, 1, 1, 0, 0, 0],
  [1, 1, 0, 1, 1, 0],
  [1, 0, 1, 0, 0, 0],
  [1, 1, 1, 1, 1, 1],
  [0, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0],
].map((f) => f.map(Boolean));

describe('KR-20', () => {
  it('coincide con el cálculo de referencia en numpy', () => {
    // Python: KR20 = 0.7867021276595745 ; var_total(ddof=1) = 3.357142857142857
    const r = kr20(M);
    expect(r.coeficiente).toBeCloseTo(0.7867021276595745, 12);
    expect(r.k).toBe(6);
    expect(r.n).toBe(8);
    expect(r.interpretacion).toBe('aceptable');
  });

  it('marca como NO confiable un coeficiente calculado con menos de 10 personas', () => {
    // Con n=8 el valor existe pero es inestable: el sistema debe declararlo.
    expect(kr20(M).confiable).toBe(false);
  });

  it('con puntajes sin variabilidad no inventa un coeficiente', () => {
    const iguales = [[true, true], [true, true], [true, true]];
    const r = kr20(iguales);
    expect(Number.isNaN(r.coeficiente)).toBe(true);
    expect(r.confiable).toBe(false);
  });

  it('con menos de 2 ítems o 2 personas devuelve NaN', () => {
    expect(Number.isNaN(kr20([[true]]).coeficiente)).toBe(true);
    expect(Number.isNaN(kr20([]).coeficiente)).toBe(true);
  });
});

describe('alfa de Cronbach (escalas Likert)', () => {
  /**
   * Escala de 8 personas × 5 ítems con puntuaciones 1–5. Referencia calculada
   * con numpy:
   *   var_items = M.var(axis=0, ddof=1).sum()  → 9.5
   *   var_total = M.sum(axis=1).var(ddof=1)    → 41.92857142857143
   *   alfa = (k/(k-1))*(1 - var_items/var_total) → 0.9667802385008518
   */
  const ESCALA = [
    [5, 4, 5, 4, 5],
    [3, 3, 4, 2, 3],
    [4, 5, 4, 5, 4],
    [2, 2, 1, 2, 2],
    [5, 5, 5, 4, 5],
    [3, 4, 3, 3, 4],
    [1, 2, 2, 1, 1],
    [4, 4, 5, 4, 4],
  ];

  it('coincide con el cálculo de referencia en numpy', () => {
    const r = alfaCronbach(ESCALA);
    expect(r.coeficiente).toBeCloseTo(0.9667802385008518, 12);
    expect(r.k).toBe(5);
    expect(r.n).toBe(8);
    expect(r.interpretacion).toBe('excelente');
  });

  it('la correlación ítem-total corregida coincide con scipy', () => {
    // scipy.stats.pearsonr(M[:,0], np.delete(M,0,axis=1).sum(axis=1))
    //   → 0.9603450729319978
    expect(alfaCronbach(ESCALA).items[0].correlacion!).toBeCloseTo(0.9603450729319978, 12);
  });

  it('calcula el alfa que quedaría al eliminar cada ítem', () => {
    // numpy sobre M sin la columna 0 → 0.9496468443836863
    expect(alfaCronbach(ESCALA).items[0].alfa_si_se_elimina!).toBeCloseTo(0.9496468443836863, 12);
  });

  /**
   * OJO CON ESTA DIFERENCIA, que es fácil confundir con un error de cálculo.
   *
   * Sobre los MISMOS datos dicotómicos, KR-20 y alfa NO dan el mismo número:
   *   KR-20 = 0.7867021276595745   (usa Σp·q, la varianza POBLACIONAL del ítem)
   *   alfa  = 0.7276595744680852   (usa la varianza MUESTRAL, ddof=1)
   *
   * Ambas fórmulas son las estándar de su respectivo coeficiente; la diferencia
   * es solo la convención de varianza del numerador (factor n/(n−1) = 8/7 aquí).
   * Se fija por prueba para que nadie "corrija" uno de los dos creyendo que hay
   * un fallo, y para que quede claro cuál se reporta en cada instrumento:
   * KR-20 en el pretest/postest (ítems de acierto/error) y alfa en las escalas
   * Likert (ítems 1–5).
   */
  it('KR-20 y alfa difieren por la convención de varianza, y ambos son correctos', () => {
    const dicotomica = M.map((f) => f.map((v) => (v ? 1 : 0)));
    expect(kr20(M).coeficiente).toBeCloseTo(0.7867021276595745, 12);
    expect(alfaCronbach(dicotomica).coeficiente).toBeCloseTo(0.7276595744680852, 12);
    // La diferencia es exactamente la esperada por el cambio de convención.
    expect(kr20(M).coeficiente - alfaCronbach(dicotomica).coeficiente)
      .toBeCloseTo(0.05904255319148932, 12);
  });

  it('marca como NO confiable un alfa calculado con menos de 10 personas', () => {
    expect(alfaCronbach(ESCALA).confiable).toBe(false);
  });

  it('sin variabilidad en los totales no inventa un coeficiente', () => {
    const planas = [[3, 3, 3], [3, 3, 3], [3, 3, 3]];
    expect(Number.isNaN(alfaCronbach(planas).coeficiente)).toBe(true);
  });

  it('con menos de 2 ítems o 2 personas devuelve NaN', () => {
    expect(Number.isNaN(alfaCronbach([[4]]).coeficiente)).toBe(true);
    expect(Number.isNaN(alfaCronbach([]).coeficiente)).toBe(true);
  });
});

describe('análisis de ítems', () => {
  const items = analisisItems(M);

  it('la dificultad es la proporción de aciertos', () => {
    // numpy M.mean(axis=0) = [0.875, 0.75, 0.625, 0.5, 0.25, 0.25]
    expect(items.map((i) => i.dificultad)).toEqual([0.875, 0.75, 0.625, 0.5, 0.25, 0.25]);
  });

  it('la discriminación coincide con la correlación ítem-total corregida de scipy', () => {
    // scipy.stats.pearsonr por ítem contra el total SIN ese ítem:
    const esperado = [
      0.32971985713159935, 0.3849001794597506, 0.3238751378156479,
      0.7698003589195009, 0.3849001794597506, 0.6123724356957946,
    ];
    items.forEach((it, i) => expect(it.discriminacion!).toBeCloseTo(esperado[i], 12));
  });

  it('el índice D del 27 % coincide con la referencia', () => {
    // Python con n27 = round(8*0.27) = 2
    expect(items.map((i) => i.d27)).toEqual([0.5, 0.5, 1, 1, 0.5, 1]);
  });

  it('marca como PROBLEMÁTICO un ítem con discriminación negativa', () => {
    // Ítem construido al revés: lo aciertan justo quienes peor puntúan.
    const invertido: boolean[][] = [
      [true, true, true, false],
      [true, true, true, false],
      [true, true, false, false],
      [true, false, false, true],
      [false, false, false, true],
      [false, false, false, true],
      [true, true, true, false],
      [true, true, false, false],
      [false, false, false, true],
      [true, true, true, false],
    ];
    const r = analisisItems(invertido);
    expect(r[3].discriminacion!).toBeLessThan(0);
    expect(r[3].veredicto).toBe('problemático');
    expect(r[3].motivo).toContain('NEGATIVA');
  });

  it('no juzga ítems cuando hay menos de 10 respuestas', () => {
    // Con n=8 ningún ítem puede declararse problemático de forma responsable.
    expect(items.every((i) => i.motivo.includes('no hay base'))).toBe(true);
  });

  it('con matriz vacía devuelve lista vacía', () => {
    expect(analisisItems([])).toEqual([]);
  });
});

describe('ajuste al modelo de Rasch (infit / outfit)', () => {
  // θ y b fijos usados también en la referencia de Python.
  const THETA = [1.0, 0.5, 0.5, -0.5, 2.0, -1.5, 1.5, -1.0];
  const B = [-1.5, -1.0, -0.2, 0.3, 1.0, 1.5];
  const P = (t: number, b: number) => 1 / (1 + Math.exp(-(t - b)));

  it('el ajuste POR ÍTEM coincide con la referencia', () => {
    // Python outfit por ítem (media de z² sobre personas):
    const outfitEsp = [
      0.3008937647214228, 0.6263637764906864, 0.6470923087895493,
      0.4884695245459148, 0.7140503855366591, 0.40200344399956583,
    ];
    // Python infit por ítem (Σresid² / ΣW):
    const infitEsp = [
      0.48500959765504637, 0.8991647927821204, 0.7599679837998572,
      0.5588672945532617, 0.8761092353644794, 0.5263915546196593,
    ];

    B.forEach((b, i) => {
      const obs = M.map((f) => (f[i] ? 1 : 0));
      const probs = THETA.map((t) => P(t, b));
      const a = ajusteRasch(obs, probs);
      expect(a.outfit).toBeCloseTo(outfitEsp[i], 12);
      expect(a.infit).toBeCloseTo(infitEsp[i], 12);
    });
  });

  it('el ajuste POR PERSONA coincide con la referencia', () => {
    const outfitEsp = [
      0.4369550762127927, 0.5084772677034496, 0.867924935967512, 0.6957089878249728,
      0.22464687251488777, 0.536404003157915, 0.5440785122761379, 0.4243019497873965,
    ];
    const infitEsp = [
      0.543716484820526, 0.5842253855241443, 1.001223145975534, 0.8157977587512676,
      0.34697726964294073, 0.7990994638394447, 0.7954578538751725, 0.5319758292630031,
    ];

    THETA.forEach((t, j) => {
      const obs = M[j].map((v) => (v ? 1 : 0));
      const probs = B.map((b) => P(t, b));
      const a = ajusteRasch(obs, probs);
      expect(a.outfit).toBeCloseTo(outfitEsp[j], 12);
      expect(a.infit).toBeCloseTo(infitEsp[j], 12);
    });
  });

  it('un patrón perfectamente acorde al modelo da valores próximos a 1', () => {
    // Si el observado coincide con la probabilidad esperada en promedio, el
    // valor esperado teórico de ambos estadísticos es 1.
    const probs = [0.5, 0.5, 0.5, 0.5];
    const obs = [1, 0, 1, 0];
    const a = ajusteRasch(obs, probs);
    expect(a.outfit).toBeCloseTo(1, 12);
    expect(a.infit).toBeCloseTo(1, 12);
    expect(a.veredicto).toBe('ajuste aceptable');
  });

  it('detecta un patrón errático (respuestas muy improbables)', () => {
    // Acierta lo casi imposible y falla lo casi seguro.
    const a = ajusteRasch([1, 1, 0, 0], [0.02, 0.03, 0.97, 0.98]);
    expect(a.outfit).toBeGreaterThan(1.5);
    expect(a.veredicto).toBe('errático');
  });

  it('ignora las probabilidades degeneradas (0 o 1) en vez de dividir por cero', () => {
    const a = ajusteRasch([1, 1], [1, 0.5]);
    expect(Number.isFinite(a.outfit)).toBe(true);
  });
});
