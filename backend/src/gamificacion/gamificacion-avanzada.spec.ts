import { EmblemasService } from './emblemas.service';
import { RangosService } from './rangos.service';
import { rangoParaPuntaje, rangoSiguiente } from './catalogo';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

describe('Catálogo de rangos', () => {
  it('deriva el rango correcto según el puntaje 0-100', () => {
    expect(rangoParaPuntaje(0).clave).toBe('aprendiz');
    expect(rangoParaPuntaje(24).clave).toBe('aprendiz');
    expect(rangoParaPuntaje(25).clave).toBe('junior');
    expect(rangoParaPuntaje(50).clave).toBe('semi_senior');
    expect(rangoParaPuntaje(70).clave).toBe('senior');
    expect(rangoParaPuntaje(90).clave).toBe('arquitecto');
    expect(rangoParaPuntaje(100).clave).toBe('maestro');
  });

  it('el rango siguiente es el inmediato superior, o null en el máximo', () => {
    expect(rangoSiguiente('aprendiz')?.clave).toBe('junior');
    expect(rangoSiguiente('senior')?.clave).toBe('arquitecto');
    expect(rangoSiguiente('maestro')).toBeNull();
  });
});

describe('EmblemasService (otorgamiento validado en backend, sin duplicar)', () => {
  let prisma: PrismaMock;
  let service: EmblemasService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new EmblemasService(prisma as never);
    // Por defecto, el catálogo mapea clave→id y el usuario no tiene ninguno.
    prisma.logro.findMany.mockImplementation((args: { where: { clave: { in: string[] } } }) =>
      Promise.resolve(args.where.clave.in.map((clave, i) => ({ id: i + 1, clave, nombre: clave, descripcion: '', svgKey: 'x', icono: '🏅' }))),
    );
    prisma.logroUsuario.findMany.mockResolvedValue([]);
  });

  it('otorga "primer_acierto" solo en el primer acierto', async () => {
    prisma.intento.count.mockResolvedValue(1); // este es el primer correcto
    const r = await service.evaluarIntento(prisma as never, 7, {
      ejercicio: { id: 10, categoria: 'Variables', temaId: null }, correcto: true, pistasUsadas: 0, rachaDias: 1,
    });
    expect(r.map((e) => e.clave)).toContain('primer_acierto');
  });

  it('NO duplica un emblema que el usuario ya tiene', async () => {
    prisma.intento.count.mockResolvedValue(1);
    prisma.logroUsuario.findMany.mockResolvedValue([{ logroId: 1 }]); // ya tiene el #1
    await service.evaluarIntento(prisma as never, 7, {
      ejercicio: { id: 10, categoria: 'Variables', temaId: null }, correcto: true, pistasUsadas: 0, rachaDias: 1,
    });
    // El primer emblema evaluado (primer_acierto→id 1) no se re-otorga.
    expect(prisma.logroUsuario.createMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([{ usuarioId: 7, logroId: 1 }]) }),
    );
  });

  it('otorga emblemas de racha según los días', async () => {
    prisma.intento.count.mockResolvedValue(3);
    prisma.ranking.findUnique.mockResolvedValue({ posicion: 99 });
    const r = await service.evaluarIntento(prisma as never, 7, {
      ejercicio: { id: 10, categoria: 'Variables', temaId: null }, correcto: true, pistasUsadas: 0, rachaDias: 14,
    });
    const claves = r.map((e) => e.clave);
    expect(claves).toContain('racha_fuego');
    expect(claves).toContain('racha_titan');
  });

  it('otorga "top_5" cuando la posición del ranking es ≤ 5', async () => {
    prisma.intento.count.mockResolvedValue(3);
    prisma.ranking.findUnique.mockResolvedValue({ posicion: 3 });
    const r = await service.evaluarIntento(prisma as never, 7, {
      ejercicio: { id: 10, categoria: 'Variables', temaId: null }, correcto: true, pistasUsadas: 0, rachaDias: 1,
    });
    expect(r.map((e) => e.clave)).toContain('top_5');
  });

  it('al completar un tema sin fallos ni pistas, otorga tema_completado + sin_errores + mente_brillante', async () => {
    prisma.intento.count.mockImplementation((args: { where: Record<string, unknown> }) => {
      if (args.where.correcto === false) return Promise.resolve(0); // sin fallos
      return Promise.resolve(3);
    });
    prisma.ranking.findUnique.mockResolvedValue({ posicion: 50 });
    prisma.tema.findUnique.mockResolvedValue({ id: 5, unidadId: 2, umbral: 3, ejercicios: [{ id: 10 }, { id: 11 }, { id: 12 }] });
    // 3 ejercicios correctos distintos → alcanza el umbral 3.
    prisma.intento.findMany.mockResolvedValue([{ ejercicioId: 10 }, { ejercicioId: 11 }, { ejercicioId: 12 }]);
    prisma.consultaIa.count.mockResolvedValue(0); // sin pistas en el tema
    prisma.intento.findFirst.mockResolvedValue({ fecha: new Date() }); // veloz
    prisma.tema.findMany.mockResolvedValue([{ id: 5, umbral: 3 }]); // único tema de la unidad
    prisma.progresoTema.findMany.mockResolvedValue([]);

    const r = await service.evaluarIntento(prisma as never, 7, {
      ejercicio: { id: 12, categoria: 'Bucles', temaId: 5 }, correcto: true, pistasUsadas: 0, rachaDias: 1,
    });
    const claves = r.map((e) => e.clave);
    expect(claves).toContain('tema_completado');
    expect(claves).toContain('sin_errores');
    expect(claves).toContain('mente_brillante');
    expect(claves).toContain('unidad_conquistada');
  });

  it('evaluarPostest otorga "perfeccionista" solo con 100', async () => {
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));
    const con100 = await service.evaluarPostest(7, 100);
    expect(con100.map((e) => e.clave)).toContain('perfeccionista');

    const sin100 = await service.evaluarPostest(7, 95);
    expect(sin100).toEqual([]);
  });
});

describe('RangosService (desempeño por unidad → rango)', () => {
  let prisma: PrismaMock;
  let service: RangosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new RangosService(prisma as never);
  });

  it('recalcula el desempeño de una unidad y persiste el rango derivado', async () => {
    prisma.unidad.findMany.mockResolvedValue([
      { id: 2, titulo: 'Unidad 2', temas: [{ id: 5, umbral: 2, ejercicios: [{ id: 10 }, { id: 11 }] }] },
    ]);
    prisma.evaluacion.findUnique.mockResolvedValue({ puntajeTotal: 80 }); // postest global
    // 2 de 2 correctos → 100% acierto; ambos distintos.
    prisma.intento.count.mockImplementation(() => Promise.resolve(2));
    prisma.intento.findMany.mockResolvedValue([{ ejercicioId: 10 }, { ejercicioId: 11 }]);
    prisma.progresoTema.findMany.mockResolvedValue([{ temaId: 5, ejerciciosCompletados: 2 }]);
    prisma.desempenoUnidad.findUnique.mockResolvedValue(null);

    const cambios = await service.recalcular(7, 2);
    // puntaje = 100*0.5 + 100*0.3 + 80*0.2 = 96 → maestro
    expect(prisma.desempenoUnidad.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ puntaje: 96, rangoClave: 'maestro' }) }),
    );
    // No hay rango previo → no cuenta como "subió".
    expect(cambios).toEqual([]);
  });
});
