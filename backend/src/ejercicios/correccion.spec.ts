import { corregir, corregirGraduado } from './correccion';

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

describe('corregirGraduado (respuestas parcialmente correctas)', () => {
  it('opción múltiple: solo correcta o incorrecta', () => {
    expect(corregirGraduado('opcion_multiple', 'b', 'B')).toMatchObject({ estado: 'correcta', puntaje: 1 });
    expect(corregirGraduado('opcion_multiple', 'C', 'B')).toMatchObject({ estado: 'incorrecta', puntaje: 0 });
  });

  it('ordenar líneas: puntaje = líneas en su posición', () => {
    // Correcto B,A,D,C. Con B,A,C,D acierta 2 de 4 → parcial 0,5.
    const r = corregirGraduado('ordenar_lineas', 'B,A,C,D', 'B,A,D,C');
    expect(r).toMatchObject({ estado: 'parcial', puntaje: 0.5 });
    expect(r.faltantes).toEqual(['la línea en la posición 3', 'la línea en la posición 4']);
    expect(r.retroalimentacion).toContain('2 de 4');
    expect(corregirGraduado('ordenar_lineas', 'b, a, d, c', 'B,A,D,C').estado).toBe('correcta');
  });

  it('ordenar líneas: muy desordenado o con otras líneas es incorrecta', () => {
    expect(corregirGraduado('ordenar_lineas', 'C,D,A,B', 'B,A,D,C').estado).toBe('incorrecta');
    expect(corregirGraduado('ordenar_lineas', 'B,A,D', 'B,A,D,C').estado).toBe('incorrecta');
  });

  it('completar código: varias piezas admiten puntaje parcial', () => {
    // Esperado: for i in range ( 10 ) → 7 piezas. Falla solo el número → 6/7.
    const r = corregirGraduado('completar_codigo', 'for i in range(5)', 'for i in range(10)');
    expect(r.estado).toBe('parcial');
    expect(r.puntaje).toBeCloseTo(0.86, 2);
    expect(r.retroalimentacion).toContain('6 de 7');
    // La retroalimentación NO revela la respuesta.
    expect(JSON.stringify(r)).not.toContain('10');
  });

  it('completar código: un solo término no tiene "a medias"', () => {
    expect(corregirGraduado('completar_codigo', 'finito', 'finitud').estado).toBe('incorrecta');
    expect(corregirGraduado('completar_codigo', '', 'finitud').estado).toBe('incorrecta');
  });

  it('completar código: escribir de más no regala puntaje', () => {
    const r = corregirGraduado('completar_codigo', 'for i in range(10) print x y z w q k m n p', 'for i in range(10)');
    expect(r.estado).toBe('incorrecta');
  });
});
