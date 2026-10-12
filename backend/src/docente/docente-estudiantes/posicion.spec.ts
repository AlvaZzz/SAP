import { posicionEnRuta, temasQueCuestan } from './resumen-academico';

describe('posicionEnRuta — dónde va el estudiante', () => {
  const ruta = [{ id: 1, etiqueta: '1.1 A', umbral: 10 }, { id: 2, etiqueta: '1.2 B', umbral: 10 }, { id: 3, etiqueta: '1.3 C', umbral: 10 }];
  const req = (u: number) => Math.ceil(u * 0.8);

  it('el tema actual es el primero sin terminar', () => {
    expect(posicionEnRuta(ruta, new Map([[1, 8], [2, 3]]), req)).toEqual({ completos: 1, total: 3, tema_actual: { id: 2, etiqueta: '1.2 B' } });
  });

  it('sin avance, va en el primer tema', () => {
    expect(posicionEnRuta(ruta, new Map(), req).tema_actual).toEqual({ id: 1, etiqueta: '1.1 A' });
  });

  it('con todo completo no queda tema actual', () => {
    expect(posicionEnRuta(ruta, new Map([[1, 8], [2, 9], [3, 10]]), req)).toEqual({ completos: 3, total: 3, tema_actual: null });
  });
});

describe('temasQueCuestan — temas con menor acierto del curso', () => {
  const etiquetas = new Map([[1, '1.1 A'], [2, '1.2 B'], [3, '1.3 C']]);

  it('ordena de peor a mejor y descarta los que tienen pocos intentos', () => {
    const r = temasQueCuestan([
      { temaId: 1, intentos: 40, aciertos: 30 },
      { temaId: 2, intentos: 20, aciertos: 6 },
      { temaId: 3, intentos: 4, aciertos: 0 }, // muy pocos: no cuenta
    ], etiquetas);
    expect(r.map((t) => [t.tema_id, t.tasa_acierto])).toEqual([[2, 30], [1, 75]]);
  });

  it('devuelve como mucho cinco', () => {
    const filas = Array.from({ length: 8 }, (_, i) => ({ temaId: 1, intentos: 20 + i, aciertos: i }));
    expect(temasQueCuestan(filas, etiquetas).length).toBeLessThanOrEqual(5);
  });
});
