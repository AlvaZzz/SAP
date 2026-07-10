import { detectarPatrones, IntentoParaPatron } from './patrones-error';

const base: Omit<IntentoParaPatron, 'correcto' | 'respuestaDada' | 'respuestaCorrecta'> = {
  categoria: 'Bucles',
  tipo: 'completar_codigo',
};

describe('detectarPatrones (errores recurrentes)', () => {
  it('sin fallos no hay patrones', () => {
    expect(detectarPatrones([{ ...base, correcto: true, respuestaDada: 'x == 5', respuestaCorrecta: 'x == 5' }])).toEqual([]);
  });

  it('detecta confundir asignación (=) con comparación (==)', () => {
    const intentos: IntentoParaPatron[] = [
      { ...base, correcto: false, respuestaDada: 'if x = 5', respuestaCorrecta: 'if x == 5' },
    ];
    const p = detectarPatrones(intentos);
    expect(p.some((x) => x.clave === 'confunde_asignacion_comparacion')).toBe(true);
  });

  it('detecta confundir for con while', () => {
    const intentos: IntentoParaPatron[] = [
      { ...base, correcto: false, respuestaDada: 'while i in range(10)', respuestaCorrecta: 'for i in range(10)' },
    ];
    const p = detectarPatrones(intentos);
    expect(p.some((x) => x.clave === 'confunde_for_while')).toBe(true);
  });

  it('detecta olvidar los dos puntos', () => {
    const intentos: IntentoParaPatron[] = [
      { ...base, correcto: false, respuestaDada: 'for i in range(3)', respuestaCorrecta: 'for i in range(3):' },
    ];
    const p = detectarPatrones(intentos);
    expect(p.some((x) => x.clave === 'olvida_dos_puntos')).toBe(true);
  });

  it('marca debilidad por categoría cuando se repiten los fallos', () => {
    const intentos: IntentoParaPatron[] = [
      { ...base, categoria: 'Listas', correcto: false, respuestaDada: 'a', respuestaCorrecta: 'b', tipo: 'opcion_multiple' },
      { ...base, categoria: 'Listas', correcto: false, respuestaDada: 'a', respuestaCorrecta: 'b', tipo: 'opcion_multiple' },
    ];
    const p = detectarPatrones(intentos);
    expect(p.some((x) => x.clave === 'debilidad_listas' && x.frecuencia === 2)).toBe(true);
  });

  it('ordena por frecuencia y acota el número de patrones', () => {
    const intentos: IntentoParaPatron[] = Array.from({ length: 5 }, () => ({
      ...base, correcto: false, respuestaDada: 'if x = 5', respuestaCorrecta: 'if x == 5',
    }));
    const p = detectarPatrones(intentos, 2);
    expect(p.length).toBeLessThanOrEqual(2);
    expect(p[0].frecuencia).toBeGreaterThanOrEqual(p[p.length - 1].frecuencia);
  });
});
