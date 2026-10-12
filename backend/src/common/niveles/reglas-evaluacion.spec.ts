import { aprueba, notaSobre100, promedioGeneral, situacionPromedio, PREGUNTAS_POR_EVALUACION, PUNTOS_POR_PREGUNTA } from './reglas-evaluacion';

describe('reglas de evaluación (10 preguntas, 100 puntos, aprobar con 80)', () => {
  it('cada pregunta vale 10 puntos', () => {
    expect(PREGUNTAS_POR_EVALUACION).toBe(10);
    expect(PUNTOS_POR_PREGUNTA).toBe(10);
  });

  it('nota sobre 100 con respuestas parciales', () => {
    // 7 correctas + 2 a medias + 1 incorrecta = 8 puntos de 10 → 80.
    expect(notaSobre100([1, 1, 1, 1, 1, 1, 1, 0.5, 0.5, 0])).toBe(80);
    expect(notaSobre100([1, 1, 0])).toBe(67);
    expect(notaSobre100([])).toBe(0);
  });

  it('se aprueba con 80, no con 79', () => {
    expect(aprueba(80)).toBe(true);
    expect(aprueba(79)).toBe(false);
  });

  it('el promedio usa el mejor intento y distingue "cerca del umbral"', () => {
    expect(promedioGeneral([{ unidadId: 1, puntaje: 70 }, { unidadId: 1, puntaje: 86 }], [])).toBe(86);
    expect(situacionPromedio(78)).toBe('cerca');
    expect(situacionPromedio(null)).toBe('sin_evaluaciones');
  });
});
