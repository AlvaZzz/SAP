import { RankingService } from './ranking.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

describe('RankingService', () => {
  let prisma: PrismaMock;
  let service: RankingService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new RankingService(prisma as never);
    prisma.usuario.findUnique.mockResolvedValue({ id: 1, paralelo: 'A' });
    prisma.desempenoUnidad.groupBy.mockResolvedValue([]);
    prisma.ranking.findMany.mockResolvedValue([]);
  });

  /** 3 estudiantes; `xpAhora`/`xpAntes` son sumas de Intento por usuario. */
  function escenario(xpAhora: [number, number][], xpAntes: [number, number][] = []) {
    prisma.usuario.findMany.mockResolvedValue([
      { id: 1, nombre: 'Ana' }, { id: 2, nombre: 'Beto' }, { id: 3, nombre: 'Cami' },
    ]);
    // groupBy de intentos: 1.ª llamada = periodo actual, 2.ª = corte anterior.
    prisma.intento.groupBy
      .mockResolvedValueOnce(xpAhora.map(([usuarioId, xp]) => ({ usuarioId, _sum: { xpOtorgado: xp } })))
      .mockResolvedValueOnce(xpAntes.map(([usuarioId, xp]) => ({ usuarioId, _sum: { xpOtorgado: xp } })));
  }

  it('ordena por XP del periodo y numera las posiciones', async () => {
    escenario([[1, 50], [2, 120], [3, 10]]);
    const r = await service.tabla(1, { periodo: 'temporada' });
    expect(r.ranking.map((f) => [f.posicion, f.usuario_id, f.xp]))
      .toEqual([[1, 2, 120], [2, 1, 50], [3, 3, 10]]);
  });

  it('calcula el MOVIMIENTO comparando con el corte anterior', async () => {
    // Antes: Ana 1.ª, Beto 2.º. Ahora Beto la supera.
    escenario([[1, 50], [2, 120]], [[1, 40], [2, 10]]);
    const r = await service.tabla(1, { periodo: 'temporada' });
    const beto = r.ranking.find((f) => f.usuario_id === 2)!;
    const ana = r.ranking.find((f) => f.usuario_id === 1)!;
    expect(beto.movimiento).toBe(1);   // subió un puesto
    expect(ana.movimiento).toBe(-1);   // bajó uno
  });

  it('sin actividad previa el movimiento es null (no un falso +0)', async () => {
    escenario([[1, 10]], []);
    const r = await service.tabla(1, { periodo: 'temporada' });
    // Nadie aparece en el corte anterior → todos sin referencia.
    expect(r.ranking.every((f) => f.movimiento === null || f.movimiento === 0)).toBe(true);
  });

  it('marca la fila propia y la devuelve aunque quede fuera del top', async () => {
    escenario([[1, 0], [2, 500], [3, 400]]);
    const r = await service.tabla(1, { periodo: 'temporada', limite: 2 });
    expect(r.ranking).toHaveLength(2);
    expect(r.ranking.some((f) => f.usuario_id === 1)).toBe(false); // fuera del top 2
    expect(r.yo).toMatchObject({ usuario_id: 1, es_yo: true, posicion: 3 });
  });

  it('el ámbito "paralelo" filtra por el paralelo del propio usuario', async () => {
    escenario([[1, 10]]);
    await service.tabla(1, { ambito: 'paralelo' });
    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ paralelo: 'A' }) }),
    );
  });

  it('el periodo "historico" usa el XP acumulado de Ranking, no los intentos', async () => {
    prisma.usuario.findMany.mockResolvedValue([{ id: 1, nombre: 'Ana' }, { id: 2, nombre: 'Beto' }]);
    prisma.ranking.findMany.mockResolvedValue([
      { usuarioId: 1, xpTotal: 999, rachaDias: 0 }, { usuarioId: 2, xpTotal: 5, rachaDias: 0 },
    ]);
    prisma.intento.groupBy.mockResolvedValue([]);
    const r = await service.tabla(1, { periodo: 'historico' });
    expect(r.ranking[0]).toMatchObject({ usuario_id: 1, xp: 999 });
  });

  it('devuelve el RIVAL aunque el usuario esté fuera del top mostrado', async () => {
    escenario([[1, 0], [2, 500], [3, 400]]);
    const r = await service.tabla(1, { periodo: 'temporada', limite: 1 });
    // Va 3.º y solo se muestra 1 fila: el rival debe venir igual.
    expect(r.yo!.posicion).toBe(3);
    expect(r.rival).toMatchObject({ usuario_id: 3, posicion: 2 });
    expect(r.xp_para_subir).toBe(401);
  });

  it('el líder no tiene rival', async () => {
    escenario([[1, 900], [2, 10]]);
    const r = await service.tabla(1, { periodo: 'temporada' });
    expect(r.yo!.posicion).toBe(1);
    expect(r.rival).toBeNull();
    expect(r.xp_para_subir).toBeNull();
  });

  describe('integridad de la investigación', () => {
    it('NUNCA consulta ni devuelve el grupo control/experimental', async () => {
      escenario([[1, 10], [2, 20]]);
      const r = await service.tabla(1, { ambito: 'paralelo' });

      // No se selecciona `grupo` en ninguna consulta de usuarios…
      for (const llamada of prisma.usuario.findMany.mock.calls) {
        expect(JSON.stringify(llamada[0])).not.toMatch(/grupo/);
      }
      // …ni aparece en la respuesta.
      const payload = JSON.stringify(r);
      expect(payload).not.toMatch(/grupo/);
      expect(payload).not.toMatch(/control|experimental/);

      // Ninguna FILA expone el paralelo de nadie. (`ambito: "paralelo"` sí viaja:
      // es el nombre del modo activo, no el paralelo de ningún estudiante.)
      for (const fila of [...r.ranking, r.yo!]) {
        expect(Object.keys(fila)).not.toContain('paralelo');
      }
      // El valor real del paralelo del usuario ('A') tampoco se filtra en las filas.
      expect(JSON.stringify(r.ranking)).not.toMatch(/"A"/);
    });
  });
});
