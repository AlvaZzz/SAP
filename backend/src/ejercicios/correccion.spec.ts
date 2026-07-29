import { corregir } from './correccion';

describe('corregir', () => {
  describe('opcion_multiple / predecir_salida', () => {
    it('acepta la letra correcta sin importar mayúsculas ni espacios', () => {
      expect(corregir('opcion_multiple', 'b', 'B')).toBe(true);
      expect(corregir('opcion_multiple', ' B ', 'B')).toBe(true);
      expect(corregir('predecir_salida', 'A', 'A')).toBe(true);
    });
    it('rechaza la letra incorrecta', () => {
      expect(corregir('opcion_multiple', 'C', 'B')).toBe(false);
    });
  });

  describe('completar_codigo', () => {
    // El banco oficial pide completar términos dentro de una frase; el estudiante
    // suele capitalizarlos por escribir al inicio. No debe costarle el acierto.
    it('ignora las mayúsculas del término', () => {
      expect(corregir('completar_codigo', 'Finitud', 'finitud')).toBe(true);
      expect(corregir('completar_codigo', 'const', 'Const')).toBe(true);
      expect(corregir('completar_codigo', 'PSEUDOCODIGO', 'pseudocodigo')).toBe(true);
    });
    it('ignora espacios sobrantes y unifica comillas', () => {
      expect(corregir('completar_codigo', '  finitud  ', 'finitud')).toBe(true);
      expect(corregir('completar_codigo', 'print("hola")', "print('hola')")).toBe(true);
    });
    it('admite variantes equivalentes separadas por |', () => {
      const esperado = 'for i in range(10)|for i in range(0,10)';
      expect(corregir('completar_codigo', 'for i in range(0,10)', esperado)).toBe(true);
      expect(corregir('completar_codigo', 'while True', esperado)).toBe(false);
    });
    it('sigue rechazando una respuesta distinta', () => {
      expect(corregir('completar_codigo', 'precision', 'finitud')).toBe(false);
    });
    it('respeta los operadores tal cual (no son alfabéticos)', () => {
      expect(corregir('completar_codigo', '**', '**')).toBe(true);
      expect(corregir('completar_codigo', '*', '**')).toBe(false);
    });
  });

  describe('ordenar_lineas', () => {
    it('compara el orden de ids ignorando espacios y mayúsculas', () => {
      expect(corregir('ordenar_lineas', 'b,a,d,c', 'B,A,D,C')).toBe(true);
      expect(corregir('ordenar_lineas', ' B , A , D , C ', 'B,A,D,C')).toBe(true);
    });
    it('rechaza un orden distinto', () => {
      expect(corregir('ordenar_lineas', 'A,B,D,C', 'B,A,D,C')).toBe(false);
    });
    // Los ítems consolidados de la Unidad 1 llegan hasta 6 bloques (ej. E1.8.B.15).
    it('soporta secuencias de 6 bloques', () => {
      expect(corregir('ordenar_lineas', 'E,B,F,D,A,C', 'E,B,F,D,A,C')).toBe(true);
      expect(corregir('ordenar_lineas', 'E,B,F,D,C,A', 'E,B,F,D,A,C')).toBe(false);
    });
  });
});
