import { barajar, ordenPersonal, ordenPersonalPorGrupo, semillaDe } from './orden-personal';

const ITEMS = Array.from({ length: 10 }, (_, i) => i + 1);

describe('Orden personal de las preguntas', () => {
  it('no pierde ni repite preguntas', () => {
    expect([...ordenPersonal(ITEMS, 7, 30)].sort((a, b) => a - b)).toEqual(ITEMS);
  });

  it('el mismo estudiante ve siempre el mismo orden (puede recargar la página)', () => {
    expect(ordenPersonal(ITEMS, 7, 30)).toEqual(ordenPersonal(ITEMS, 7, 30));
  });

  it('dos estudiantes del mismo nivel y tema NO comparten el orden', () => {
    expect(ordenPersonal(ITEMS, 7, 30)).not.toEqual(ordenPersonal(ITEMS, 8, 30));
  });

  it('en un curso de 40, casi nadie repite el orden de otro', () => {
    const ordenes = new Set(Array.from({ length: 40 }, (_, u) => ordenPersonal(ITEMS, u + 1, 30).join(',')));
    expect(ordenes.size).toBeGreaterThanOrEqual(39);
  });

  it('el mismo estudiante tiene otro orden en otro tema', () => {
    expect(semillaDe(7, 30)).not.toBe(semillaDe(7, 31));
  });

  it('no modifica la lista original', () => {
    const copia = [...ITEMS];
    barajar(ITEMS, 123);
    expect(ITEMS).toEqual(copia);
  });

  it('por grupo: baraja dentro de cada tema sin mezclar los temas', () => {
    const filas = [1, 2, 3, 4, 5, 6].map((id) => ({ id, tema: id <= 3 ? 10 : 20 }));
    const r = ordenPersonalPorGrupo(filas, (f) => f.tema, 7);
    expect(r.map((f) => f.tema)).toEqual([10, 10, 10, 20, 20, 20]);
    expect(r.map((f) => f.id).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
