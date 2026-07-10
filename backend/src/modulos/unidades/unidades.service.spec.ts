import { UnidadesService } from './unidades.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

describe('UnidadesService (coherencia nivel por tema ↔ dominio de unidad)', () => {
  let prisma: PrismaMock;
  let service: UnidadesService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new UnidadesService(prisma as never);
  });

  /** Un tema publicado mínimo, sin progreso (hereda el nivel inicial del estudiante). */
  const tema = (id: number, over: Partial<Record<string, unknown>> = {}) => ({
    id, numero: `1.${id}`, titulo: `Tema ${id}`, descripcion: null, umbral: 10,
    ejercicios: [{ nivelDificultad: 'basico' }, { nivelDificultad: 'intermedio' }, { nivelDificultad: 'avanzado' }],
    progreso: [], subtemas: [], ...over,
  });

  it('BUG: un tema en Avanzado NO puede dar dominio Básico (son coherentes)', async () => {
    // Estudiante diagnosticado Avanzado; el tema hereda ese nivel (sin ProgresoTema).
    prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'avanzado' });
    prisma.unidad.findMany.mockResolvedValue([
      { id: 1, numero: 1, titulo: 'U1', descripcion: null, xp: 100, temas: [tema(1)] },
    ]);

    const [u] = await service.listar(7);

    // El tema se muestra en Avanzado…
    expect(u.temas[0].nivel_actual).toBe('avanzado');
    // …y el dominio de la unidad TAMBIÉN es Avanzado (no Básico como antes).
    expect(u.nivel_dominio).toBe('avanzado');
    expect(u.dominio_pct).toBe(100);
    expect(u.habilita_siguiente).toBe(true);
  });

  it('el nivelActual guardado por tema manda sobre el inicial y promedia el dominio', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
    prisma.unidad.findMany.mockResolvedValue([
      {
        id: 1, numero: 1, titulo: 'U1', descripcion: null, xp: 100,
        temas: [
          tema(1, { progreso: [{ nivelActual: 'avanzado', ejerciciosCompletados: 0, desbloqueado: true }] }),
          tema(2, { progreso: [{ nivelActual: 'basico', ejerciciosCompletados: 0, desbloqueado: true }] }),
        ],
      },
    ]);

    const [u] = await service.listar(7);

    // (avanzado=1 + basico=0)/2 = 0.5 → 50 → intermedio.
    expect(u.dominio_pct).toBe(50);
    expect(u.nivel_dominio).toBe('intermedio');
    expect(u.habilita_siguiente).toBe(true); // ≥ intermedio desbloquea la siguiente
  });

  it('todo en Básico → dominio Básico, no habilita la siguiente unidad', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
    prisma.unidad.findMany.mockResolvedValue([
      { id: 1, numero: 1, titulo: 'U1', descripcion: null, xp: 100, temas: [tema(1), tema(2)] },
    ]);

    const [u] = await service.listar(7);

    expect(u.nivel_dominio).toBe('basico');
    expect(u.dominio_pct).toBe(0);
    expect(u.habilita_siguiente).toBe(false);
  });

  it('un tema en Avanzado se marca como nivel máximo y no ofrece subir', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'avanzado' });
    prisma.unidad.findMany.mockResolvedValue([
      { id: 1, numero: 1, titulo: 'U1', descripcion: null, xp: 100, temas: [tema(1, { progreso: [{ nivelActual: 'avanzado', ejerciciosCompletados: 3, desbloqueado: true }] })] },
    ]);

    const [u] = await service.listar(7);

    expect(u.temas[0].nivel_maximo).toBe(true);
    expect(u.temas[0].puede_subir).toBe(false);
    expect(u.temas[0].nivel_objetivo).toBeNull();
  });
});
