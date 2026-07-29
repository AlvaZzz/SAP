import { introducirBug } from './bugs';

/** Código real del banco (E1.5.I.06): S = 5 y dos incrementos de 10 → 5 / 15 / 25. */
const CODIGO_S = 'S = 5\nprint(S)\nS = S + 10\nprint(S)\nS = S + 10\nprint(S)';

describe('introducirBug', () => {
  it('es DETERMINISTA: la misma semilla produce siempre el mismo bug', () => {
    const a = introducirBug(CODIGO_S, 'E1.5.I.06');
    const b = introducirBug(CODIGO_S, 'E1.5.I.06');
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
  });

  it('siempre altera el código (un bug que no cambia nada haría el reto irresoluble)', () => {
    const r = introducirBug(CODIGO_S, 'E1.5.I.06');
    expect(r!.codigo.trim()).not.toBe(CODIGO_S.trim());
  });

  it('introduce UN solo cambio de línea', () => {
    const r = introducirBug(CODIGO_S, 'E1.5.I.06')!;
    const orig = CODIGO_S.split('\n');
    const roto = r.codigo.split('\n');
    expect(roto).toHaveLength(orig.length);
    const distintas = orig.filter((l, i) => l !== roto[i]);
    // El intercambio de orden toca dos líneas; el resto, una sola.
    expect(distintas.length).toBeGreaterThanOrEqual(1);
    expect(distintas.length).toBeLessThanOrEqual(2);
  });

  it('reporta una línea válida dentro del código', () => {
    const r = introducirBug(CODIGO_S, 'E1.5.I.06')!;
    expect(r.linea).toBeGreaterThanOrEqual(1);
    expect(r.linea).toBeLessThanOrEqual(CODIGO_S.split('\n').length);
  });

  it('semillas distintas pueden dar bugs distintos (variedad del catálogo)', () => {
    const semillas = ['E1.1.B.01', 'E1.5.I.06', 'E2.3.I.07', 'E1.6.A.03', 'E2.4.B.02', 'E3.6.I.01'];
    const tipos = new Set(semillas.map((s) => introducirBug(CODIGO_S, s)?.tipo).filter(Boolean));
    expect(tipos.size).toBeGreaterThan(1);
  });

  it('no toca comentarios', () => {
    const codigo = '# S = 5 + 1\nS = 2\nprint(S)';
    const r = introducirBug(codigo, 'X');
    if (r) expect(r.codigo.split('\n')[0]).toBe('# S = 5 + 1');
  });

  it('devuelve null cuando no hay nada que romper de forma controlada', () => {
    expect(introducirBug('', 'X')).toBeNull();
    expect(introducirBug('# solo un comentario', 'X')).toBeNull();
  });

  it('invierte operadores relacionales cuando los hay', () => {
    const codigo = 'x = 5\nif x >= 3:\n    print(1)\nelse:\n    print(2)';
    const r = introducirBug(codigo, 'REL')!;
    expect(r).not.toBeNull();
    expect(r.codigo).not.toBe(codigo);
  });
});
