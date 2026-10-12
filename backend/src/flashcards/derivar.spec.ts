import { derivarFlashcard, reversoDe } from './derivar';

const base = { enunciado: '¿Qué imprime?', explicacionIa: 'Porque suma.', codigoPython: 'print(2+3)' };

describe('derivarFlashcard — tarjeta que sale de un ejercicio', () => {
  it('opción múltiple: el reverso es el TEXTO de la opción correcta, no su letra', () => {
    const f = derivarFlashcard({ ...base, tipo: 'opcion_multiple', opciones: [{ id: 'A', texto: '23' }, { id: 'B', texto: '5' }], respuestaCorrecta: 'b' });
    expect(f).toEqual({ frente: '¿Qué imprime?', reverso: '5', explicacion: 'Porque suma.', codigoPython: 'print(2+3)' });
  });

  it('completar código: usa la primera variante válida', () => {
    expect(reversoDe({ tipo: 'completar_codigo', opciones: [], respuestaCorrecta: 'range(10) | range(0,10)' })).toBe('range(10)');
  });

  it('ordenar líneas no produce tarjeta', () => {
    expect(derivarFlashcard({ ...base, tipo: 'ordenar_lineas', opciones: [{ id: 'A', texto: 'x' }], respuestaCorrecta: 'A' })).toBeNull();
  });

  it('si la opción correcta no existe, muestra la respuesta tal cual', () => {
    expect(reversoDe({ tipo: 'predecir_salida', opciones: [], respuestaCorrecta: '42' })).toBe('42');
  });
});
