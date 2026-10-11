import {
  evaluarAsignacion, msDesde, percentilDe, porcentajePersonalizacion, rangoDesdeConfig,
  RANGO_OBJETIVO_MAX, RANGO_OBJETIVO_MIN,
} from './motor';

const RANGO = { min: 0.5, max: 0.85 };

describe('motor adaptativo — asignación dentro del rango objetivo', () => {
  it('θ = b da P = 0,50: es el borde inferior y cuenta como dentro del rango', () => {
    const r = evaluarAsignacion(0, 0, RANGO);
    expect(r.probAcierto).toBeCloseTo(0.5, 4);
    expect(r.enRangoObjetivo).toBe(true);
  });

  it('un ejercicio algo más fácil que la habilidad cae dentro del rango', () => {
    // θ − b = 1 → P = 1/(1+e^-1) = 0,7311
    const r = evaluarAsignacion(0.5, -0.5, RANGO);
    expect(r.probAcierto).toBeCloseTo(0.7311, 4);
    expect(r.enRangoObjetivo).toBe(true);
  });

  it('un ejercicio demasiado fácil queda FUERA (P > 0,85)', () => {
    // θ − b = 2 → P = 0,8808
    const r = evaluarAsignacion(1, -1, RANGO);
    expect(r.probAcierto).toBeCloseTo(0.8808, 4);
    expect(r.enRangoObjetivo).toBe(false);
  });

  it('un ejercicio demasiado difícil queda FUERA (P < 0,50)', () => {
    // θ − b = −1 → P = 0,2689
    const r = evaluarAsignacion(-1, 0, RANGO);
    expect(r.probAcierto).toBeCloseTo(0.2689, 4);
    expect(r.enRangoObjetivo).toBe(false);
  });

  it('sin θ previa no es evaluable: null, ni acierto ni fallo del motor', () => {
    expect(evaluarAsignacion(null, 0, RANGO)).toEqual({ probAcierto: null, enRangoObjetivo: null });
    expect(evaluarAsignacion(undefined, 0, RANGO)).toEqual({ probAcierto: null, enRangoObjetivo: null });
  });
});

describe('rango objetivo desde la configuración', () => {
  it('convierte los porcentajes a proporción', () => {
    expect(rangoDesdeConfig({ rangoObjetivoMin: 40, rangoObjetivoMax: 90 })).toEqual({ min: 0.4, max: 0.9 });
  });

  it('sin configuración usa 0,50–0,85', () => {
    expect(rangoDesdeConfig(null)).toEqual({ min: RANGO_OBJETIVO_MIN, max: RANGO_OBJETIVO_MAX });
  });

  it('un rango invertido cae al valor por defecto', () => {
    expect(rangoDesdeConfig({ rangoObjetivoMin: 90, rangoObjetivoMax: 40 })).toEqual({ min: 0.5, max: 0.85 });
  });
});

describe('personalización, latencia y percentiles', () => {
  it('% de personalización = personalizados / total', () => {
    expect(porcentajePersonalizacion(45, 50)).toBe(90);
    expect(porcentajePersonalizacion(1, 3)).toBe(33.3);
    expect(porcentajePersonalizacion(0, 0)).toBeNull();
  });

  it('msDesde convierte nanosegundos a milisegundos enteros y nunca es negativo', () => {
    expect(msDesde(1_000_000_000n, 1_250_000_000n)).toBe(250);
    expect(msDesde(5n, 1n)).toBe(0);
  });

  it('percentilDe interpola y no muta la serie', () => {
    const xs = [40, 10, 30, 20];
    expect(percentilDe(xs, 0.5)).toBe(25);
    expect(percentilDe(xs, 0.95)).toBeCloseTo(38.5, 10);
    expect(xs).toEqual([40, 10, 30, 20]);
    expect(percentilDe([], 0.5)).toBeNull();
  });
});
