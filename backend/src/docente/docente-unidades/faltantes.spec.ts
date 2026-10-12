import { faltantesPorNivel, MIN_EJERCICIOS_TEMA } from './docente-unidades.service';

describe('faltantesPorNivel — 10 ejercicios por nivel para publicar un tema', () => {
  it('la meta es 10 por nivel', () => {
    expect(MIN_EJERCICIOS_TEMA).toBe(10);
  });

  it('sin faltantes cuando los tres niveles llegan a 10', () => {
    expect(faltantesPorNivel({ basico: 10, intermedio: 12, avanzado: 10 })).toEqual([]);
  });

  it('dice cuántos faltan y de qué nivel', () => {
    expect(faltantesPorNivel({ basico: 10, intermedio: 7, avanzado: 0 })).toEqual(['3 de nivel intermedio', '10 de nivel avanzado']);
  });

  it('no basta con sumar 30 si un nivel queda corto', () => {
    expect(faltantesPorNivel({ basico: 20, intermedio: 10, avanzado: 9 })).toEqual(['1 de nivel avanzado']);
  });
});
