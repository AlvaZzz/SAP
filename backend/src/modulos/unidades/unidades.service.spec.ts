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
  });

  it('el dominio de la unidad promedia el nivelActual de sus temas (indicador)', async () => {
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
  });

  it('GATE: el avance a la siguiente unidad lo decide el EXAMEN aprobado, no el dominio', async () => {
    // Dominio alto (avanzado) pero SIN examen aprobado → no habilita la siguiente.
    prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'avanzado' });
    prisma.unidad.findMany.mockResolvedValue([
      { id: 1, numero: 1, titulo: 'U1', descripcion: null, xp: 100, temas: [tema(1)] },
    ]);
    // examenUnidad.findMany (aprobados) vacío por defecto.

    const [u] = await service.listar(7);

    expect(u.nivel_dominio).toBe('avanzado'); // el dominio sigue siendo indicador
    expect(u.examen_aprobado).toBe(false);
    expect(u.habilita_siguiente).toBe(false); // sin examen aprobado, no avanza
  });

  it('con el EXAMEN de la unidad aprobado, habilita la siguiente aunque el dominio sea Básico', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
    prisma.unidad.findMany.mockResolvedValue([
      { id: 1, numero: 1, titulo: 'U1', descripcion: null, xp: 100, temas: [tema(1), tema(2)] },
    ]);
    prisma.examenUnidad.findMany.mockResolvedValue([{ unidadId: 1 }]); // examen aprobado

    const [u] = await service.listar(7);

    expect(u.nivel_dominio).toBe('basico');
    expect(u.examen_aprobado).toBe(true);
    expect(u.habilita_siguiente).toBe(true);
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

  describe('dashboard() — Preview de Unidad', () => {
    it('arma el mapa (temas + subtemas coloreados por nivel) y devuelve las zonas', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
      prisma.unidad.findUnique.mockResolvedValue({
        id: 1, numero: 2, titulo: 'Control de flujo',
        dashObjetivos: '## Al final…\n- [ ] Usar for', dashAnalogias: '- **Bucle = línea**', dashMinutos: 80,
        dashEjemplos: [{ titulo: 'Suma', codigo: 'x=0', diagrama: '(inicio)', salida: '0' }],
        temas: [
          {
            id: 10, numero: '2.1', titulo: 'Condicionales',
            ejercicios: [{ id: 1 }, { id: 2 }],
            progreso: [{ nivelActual: 'intermedio', ejerciciosCompletados: 1 }],
            subtemas: [
              { id: 11, numero: '2.1.1', titulo: 'Booleanos', ejercicios: [{ id: 3 }], progreso: [{ nivelActual: 'avanzado', ejerciciosCompletados: 1 }] },
            ],
          },
        ],
      });

      const d = await service.dashboard(7, 1);

      expect(d.unidad.titulo).toBe('Control de flujo');
      expect(d.objetivos_md).toContain('for');
      expect(d.analogias_md).toContain('Bucle');
      expect(d.ejemplos).toHaveLength(1);
      expect(d.minutos).toBe(80);
      // Mapa: 1 tema + 1 subtema, con una arista "se_compone_de".
      expect(d.mapa.nodos).toHaveLength(2);
      expect(d.mapa.nodos.find((n) => n.id === 10)!.nivel).toBe('intermedio');
      expect(d.mapa.nodos.find((n) => n.id === 11)!.nivel).toBe('avanzado');
      expect(d.mapa.aristas).toEqual([{ de: 10, a: 11, tipo: 'se_compone_de' }]);
      // Progreso: 2 ejercicios completados de 3 → 67%.
      expect(d.progreso_pct).toBe(67);
    });

    it('lanza NotFound si la unidad no existe', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
      prisma.unidad.findUnique.mockResolvedValue(null);
      await expect(service.dashboard(7, 999)).rejects.toThrow('Unidad no encontrada');
    });
  });

  describe('prueba de nivel: la pantalla cuenta igual que el backend', () => {
    const unidadCon = (t: unknown) => [{ id: 1, numero: 1, titulo: 'U1', descripcion: null, xp: 100, temas: [t] }];

    it('solo pide ejercicios del banco de PRÁCTICA (los del diagnóstico y del examen no se pueden resolver practicando)', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
      prisma.unidad.findMany.mockResolvedValue([]);
      await service.listar(7);
      const include = prisma.unidad.findMany.mock.calls[0][0].include.temas.include;
      expect(include.ejercicios.where).toEqual({ activo: true, banco: 'practica' });
      expect(include.subtemas.include.ejercicios.where).toEqual({ activo: true, banco: 'practica' });
    });

    it('con 9 ejercicios de su nivel y los 9 resueltos, ya puede rendir la prueba (no exige 10)', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
      const ejercicios = [
        ...Array.from({ length: 9 }, (_, i) => ({ id: i + 1, nivelDificultad: 'basico' })),
        { id: 50, nivelDificultad: 'intermedio' },
      ];
      prisma.unidad.findMany.mockResolvedValue(unidadCon(tema(1, {
        ejercicios, progreso: [{ nivelActual: 'basico', ejerciciosCompletados: 9 }],
      })));
      prisma.intento.findMany.mockResolvedValue(ejercicios.slice(0, 9).map((e) => ({ ejercicioId: e.id })));

      const [u] = await service.listar(7);
      const t = u.temas[0];
      expect(t.minimo_nivel).toBe(9);
      expect(t.resueltos_nivel).toBe(9);
      expect(t.faltan_nivel).toBe(0);
      expect(t.puede_subir).toBe(true);
    });

    it('el tema se muestra completo con la misma regla que abre el siguiente (80 % del umbral)', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ nivelInicialAdaptativo: 'basico' });
      prisma.unidad.findMany.mockResolvedValue(unidadCon(tema(1, { progreso: [{ nivelActual: 'basico', ejerciciosCompletados: 8 }] })));
      const [u] = await service.listar(7);
      expect(u.temas[0].umbral).toBe(8);
      expect(u.temas[0].estado).toBe('completado');
    });
  });
});
