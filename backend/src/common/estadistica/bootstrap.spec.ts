import { bootstrapIC, mulberry32, percentil, BOOTSTRAP_REMUESTREOS, BOOTSTRAP_SEMILLA } from './bootstrap';

describe('bootstrap de percentil (IC 95 %)', () => {
  it('el generador es determinista: misma semilla, misma secuencia', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const sa = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(sa);
    for (const v of sa) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('percentil interpola linealmente (como numpy.percentile)', () => {
    // numpy.percentile([1,2,3,4], 50) = 2.5 ; ([1,2,3,4], 25) = 1.75
    expect(percentil([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10);
    expect(percentil([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10);
  });

  it('usa por defecto al menos 2000 remuestreos y una semilla fija', () => {
    const r = bootstrapIC([1, 0, 1, 1, 0, 1]);
    expect(BOOTSTRAP_REMUESTREOS).toBeGreaterThanOrEqual(2000);
    expect(r.remuestreos).toBe(BOOTSTRAP_REMUESTREOS);
    expect(r.semilla).toBe(BOOTSTRAP_SEMILLA);
    expect(r.confianza).toBe(0.95);
  });

  it('es reproducible: el mismo dato da exactamente el mismo intervalo', () => {
    const datos = [1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 0];
    expect(bootstrapIC(datos)).toEqual(bootstrapIC(datos));
  });

  it('la estimación de una serie 0/1 es la proporción y el IC la contiene', () => {
    const datos = [...Array(70).fill(1), ...Array(30).fill(0)];
    const r = bootstrapIC(datos);
    expect(r.estimacion).toBeCloseTo(0.7, 10);
    expect(r.inferior!).toBeLessThan(0.7);
    expect(r.superior!).toBeGreaterThan(0.7);
    // Referencia: el error estándar de p=0.7, n=100 es 0.0458 → IC ≈ [0.61, 0.79].
    expect(r.inferior!).toBeGreaterThan(0.58);
    expect(r.superior!).toBeLessThan(0.82);
  });

  it('una serie constante da un intervalo degenerado en ese valor', () => {
    const r = bootstrapIC([5, 5, 5, 5]);
    expect(r.inferior).toBe(5);
    expect(r.superior).toBe(5);
  });

  it('sin datos no inventa nada; con un solo dato no emite intervalo', () => {
    expect(bootstrapIC([])).toMatchObject({ estimacion: null, inferior: null, superior: null, n: 0 });
    expect(bootstrapIC([80])).toMatchObject({ estimacion: 80, inferior: null, superior: null, n: 1 });
  });
});
