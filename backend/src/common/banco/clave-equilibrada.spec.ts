import {
  claveEstable,
  distribucionClave,
  equilibrarClaves,
  equilibrarClavesLetras,
  ItemLetra,
  LETRAS,
  reubicar,
} from './clave-equilibrada';

const SEMILLA = 'prexi-banco-v1';

/** Banco sintético con la clave SIEMPRE en A (el defecto que se corrige). */
function bancoSesgado(n: number): ItemLetra[] {
  return Array.from({ length: n }, (_, i) => ({
    enunciado: `Pregunta número ${i}`,
    opciones: [
      { id: 'A', texto: `correcta-${i}` },
      { id: 'B', texto: `distractor1-${i}` },
      { id: 'C', texto: `distractor2-${i}` },
      { id: 'D', texto: `distractor3-${i}` },
    ],
    respuestaCorrecta: 'A',
  }));
}

const textoCorrecto = (r: { opciones: { id: string; texto: string }[]; respuestaCorrecta: string }) =>
  r.opciones.find((o) => o.id === r.respuestaCorrecta)!.texto;

describe('reubicar', () => {
  it('mueve la opción correcta y devuelve su nuevo índice', () => {
    const r = reubicar(['ok', 'x', 'y', 'z'], 0, 2);
    expect(r.opciones).toEqual(['x', 'y', 'ok', 'z']);
    expect(r.correcta).toBe(2);
    expect(r.opciones[r.correcta]).toBe('ok');
  });

  it('conserva el orden relativo de los distractores', () => {
    const r = reubicar(['x', 'ok', 'y', 'z'], 1, 3);
    expect(r.opciones).toEqual(['x', 'y', 'z', 'ok']);
  });

  it('rechaza un índice de clave fuera de rango', () => {
    expect(() => reubicar(['a', 'b'], 5, 0)).toThrow(RangeError);
  });
});

describe('equilibrarClaves', () => {
  it('reparte las 4 posiciones de forma exacta', () => {
    const entradas = Array.from({ length: 200 }, (_, i) => ({
      clave: `item-${i}`,
      opciones: ['ok', 'a', 'b', 'c'],
      correcta: 0,
    }));
    const conteo = [0, 0, 0, 0];
    for (const r of equilibrarClaves(entradas, SEMILLA)) conteo[r.correcta]++;
    expect(conteo).toEqual([50, 50, 50, 50]);
  });

  it('no depende del orden de entrada', () => {
    const entradas = Array.from({ length: 40 }, (_, i) => ({
      clave: `item-${i}`,
      opciones: [`ok-${i}`, 'a', 'b', 'c'],
      correcta: 0,
    }));
    const directo = equilibrarClaves(entradas, SEMILLA);
    const invertido = equilibrarClaves([...entradas].reverse(), SEMILLA);
    entradas.forEach((_, i) => {
      expect(invertido[entradas.length - 1 - i].correcta).toBe(directo[i].correcta);
    });
  });

  it('agrupa por número de opciones y equilibra cada grupo por separado', () => {
    const entradas = [
      ...Array.from({ length: 30 }, (_, i) => ({ clave: `c3-${i}`, opciones: ['ok', 'a', 'b'], correcta: 0 })),
      ...Array.from({ length: 40 }, (_, i) => ({ clave: `c4-${i}`, opciones: ['ok', 'a', 'b', 'c'], correcta: 0 })),
    ];
    const salida = equilibrarClaves(entradas, SEMILLA);
    const tres = salida.slice(0, 30).map((r) => r.correcta);
    const cuatro = salida.slice(30).map((r) => r.correcta);
    expect(Math.max(...tres)).toBe(2); // nunca inventa una 4ª posición
    [0, 1, 2].forEach((p) => expect(tres.filter((x) => x === p).length).toBe(10));
    [0, 1, 2, 3].forEach((p) => expect(cuatro.filter((x) => x === p).length).toBe(10));
  });

  it('deja intactos los ítems sin opciones reordenables', () => {
    const salida = equilibrarClaves([{ clave: 'x', opciones: ['solo'], correcta: 0 }], SEMILLA);
    expect(salida[0]).toEqual({ opciones: ['solo'], correcta: 0 });
  });
});

describe('equilibrarClavesLetras', () => {
  it('corrige un banco 100 % "A" a un reparto de 25 % por posición', () => {
    const banco = bancoSesgado(120);
    expect(distribucionClave(banco.map((i) => i.respuestaCorrecta))).toEqual({ A: 120 });

    const salida = equilibrarClavesLetras(banco, SEMILLA);
    expect(distribucionClave(salida.map((r) => r.respuestaCorrecta))).toEqual({ A: 30, B: 30, C: 30, D: 30 });
  });

  it('LA CLAVE SIGUE A SU OPCIÓN: el texto correcto original queda bajo la nueva letra', () => {
    const banco = bancoSesgado(60);
    equilibrarClavesLetras(banco, SEMILLA).forEach((r, i) => {
      expect(textoCorrecto(r)).toBe(`correcta-${i}`);
      // y no se pierde ni se duplica ningún distractor
      expect(r.opciones.map((o) => o.texto).sort()).toEqual(banco[i].opciones.map((o) => o.texto).sort());
    });
  });

  it('reetiqueta los ids A,B,C,D por posición', () => {
    equilibrarClavesLetras(bancoSesgado(20), SEMILLA).forEach((r) => {
      expect(r.opciones.map((o) => o.id)).toEqual(LETRAS.slice(0, 4));
    });
  });

  it('es idempotente: aplicarlo dos veces no cambia nada', () => {
    const una = equilibrarClavesLetras(bancoSesgado(80), SEMILLA);
    const dos = equilibrarClavesLetras(
      una.map((r, i) => ({ enunciado: `Pregunta número ${i}`, opciones: r.opciones, respuestaCorrecta: r.respuestaCorrecta })),
      SEMILLA,
    );
    expect(dos.map((r) => r.respuestaCorrecta)).toEqual(una.map((r) => r.respuestaCorrecta));
    expect(dos.map((r) => r.opciones)).toEqual(una.map((r) => r.opciones));
  });

  it('es reproducible con la misma semilla y distinto con otra', () => {
    const a = equilibrarClavesLetras(bancoSesgado(60), SEMILLA).map((r) => r.respuestaCorrecta);
    const b = equilibrarClavesLetras(bancoSesgado(60), SEMILLA).map((r) => r.respuestaCorrecta);
    const c = equilibrarClavesLetras(bancoSesgado(60), 'otra-semilla').map((r) => r.respuestaCorrecta);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it('no toca un ítem cuya clave no apunta a ninguna opción', () => {
    const roto: ItemLetra = {
      enunciado: 'ordenar líneas',
      opciones: [{ id: 'A', texto: 'x' }, { id: 'B', texto: 'y' }],
      respuestaCorrecta: 'B,A',
    };
    const [r] = equilibrarClavesLetras([roto], SEMILLA);
    expect(r.aplicado).toBe(false);
    expect(r.respuestaCorrecta).toBe('B,A');
    expect(r.opciones).toEqual(roto.opciones);
  });

  it('ninguna posición supera el 30 % en bancos pequeños (30 ítems)', () => {
    const salida = equilibrarClavesLetras(bancoSesgado(30), SEMILLA);
    const conteo = distribucionClave(salida.map((r) => r.respuestaCorrecta));
    for (const n of Object.values(conteo)) expect(n / 30).toBeLessThanOrEqual(0.3);
  });
});

describe('claveEstable', () => {
  it('es invariante al orden de las opciones (garantiza la idempotencia)', () => {
    expect(claveEstable('¿Qué es?', ['a', 'b', 'c'])).toBe(claveEstable('¿Qué es?', ['c', 'a', 'b']));
  });

  it('distingue enunciados distintos', () => {
    expect(claveEstable('P1', ['a'])).not.toBe(claveEstable('P2', ['a']));
  });
});
