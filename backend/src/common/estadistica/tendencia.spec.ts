import { clasificar, deltaMitades, promedio, trocear } from './tendencia';

describe('tendencia (hábitos de estudio)', () => {
  describe('trocear', () => {
    it('reparte en tramos parejos y no pierde elementos', () => {
      const t = trocear([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
      expect(t).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]);
      expect(t.flat()).toHaveLength(10);
    });

    it('NUNCA devuelve tramos vacíos cuando hay menos elementos que tramos', () => {
      const t = trocear([1, 2, 3], 5);
      expect(t).toHaveLength(3);
      expect(t.every((x) => x.length > 0)).toBe(true);
    });

    it('con reparto desigual conserva todos los elementos y el orden', () => {
      const t = trocear([1, 2, 3, 4, 5, 6, 7], 5);
      expect(t.flat()).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(t.every((x) => x.length > 0)).toBe(true);
    });

    it('lista vacía → sin tramos (no revienta)', () => {
      expect(trocear([], 5)).toEqual([]);
    });
  });

  describe('deltaMitades', () => {
    it('detecta MEJORA de autonomía: usar menos pistas da delta negativo', () => {
      // Primero pide 2 pistas por ejercicio; al final, ninguna.
      expect(deltaMitades([2, 2, 2, 0, 0, 0])).toBe(-2);
    });

    it('detecta más apoyo: delta positivo', () => {
      expect(deltaMitades([0, 0, 0, 2, 2, 2])).toBe(2);
    });

    it('sin cambio → 0', () => {
      expect(deltaMitades([1, 1, 1, 1])).toBe(0);
    });

    it('con longitud impar ignora el elemento central (mitades limpias)', () => {
      // corte = 2 → primera [0,0], segunda [9,10,10]... el central entra en la segunda.
      expect(deltaMitades([0, 0, 9, 10, 10])).toBeCloseTo(9.67, 1);
    });
  });

  describe('clasificar', () => {
    it('respeta el umbral de ruido: un cambio mínimo es estable', () => {
      expect(clasificar(-0.05, 0.1, 'baja', 'sube')).toBe('estable');
      expect(clasificar(0.05, 0.1, 'baja', 'sube')).toBe('estable');
    });

    it('por debajo del umbral negativo → baja; por encima → sube', () => {
      expect(clasificar(-0.5, 0.1, 'baja', 'sube')).toBe('baja');
      expect(clasificar(0.5, 0.1, 'baja', 'sube')).toBe('sube');
    });

    it('el significado lo pone quien llama: en autonomía, "baja" es la buena noticia', () => {
      // Menos pistas (delta negativo) se etiqueta como 'baja' = gana independencia.
      expect(clasificar(deltaMitades([2, 2, 0, 0]), 0.1, 'baja', 'sube')).toBe('baja');
    });
  });

  describe('promedio', () => {
    it('lista vacía → 0 (no NaN, que rompería el JSON de la respuesta)', () => {
      expect(promedio([])).toBe(0);
    });
  });
});
