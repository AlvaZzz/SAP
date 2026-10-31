import { RetosService, estadoTarjeta } from './retos.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

/** Reto mínimo con los campos que consume el servicio. */
function reto(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1, codigo: null, titulo: 'Reto', categoria: 'Cat', estrellas: 3, tipo: 'completar_codigo',
    enunciado: 'E', codigoInicial: null, esBugHunt: false, autoCalificable: false,
    nivelDificultad: 'basico', ejemploEntrada: null, ejemploSalida: null, xp: 10,
    fechaLimite: null, creadoEn: new Date(), temaId: 10, origenEjercicioId: null,
    autor: { nombre: 'Docente' }, resueltos: [], origenEjercicio: null,
    tema: {
      id: 10, numero: '2.3', titulo: 'Condicionales', orden: 3,
      unidad: { id: 2, numero: 2, titulo: 'U2' }, padre: null,
    },
    ...over,
  };
}

describe('RetosService.disponibles (nivel POR TEMA)', () => {
  let prisma: PrismaMock;
  let service: RetosService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new RetosService(prisma as never);
  });

  /** El estudiante está en `nivel` en el tema 10. */
  function conNivelEnTema(nivel: string, retos: unknown[]) {
    prisma.progresoTema.findMany.mockResolvedValue([{ temaId: 10, nivelActual: nivel }]);
    prisma.reto.findMany.mockResolvedValue(retos);
  }

  it('muestra los retos de su nivel, de los anteriores y del siguiente; no dos por encima', async () => {
    const banco = [
      reto({ id: 1, nivelDificultad: 'basico' }),
      reto({ id: 2, nivelDificultad: 'intermedio' }),
      reto({ id: 3, nivelDificultad: 'avanzado' }),
    ];
    conNivelEnTema('basico', banco);
    expect((await service.disponibles(7)).retos.map((r) => r.id)).toEqual([1, 2]);

    conNivelEnTema('intermedio', banco);
    expect((await service.disponibles(7)).retos.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('BÁSICO ve los retos intermedios aunque el tema no tenga retos básicos', async () => {
    conNivelEnTema('basico', [reto({ id: 2, nivelDificultad: 'intermedio' })]);
    expect((await service.disponibles(7)).retos.map((r) => r.id)).toEqual([2]);
  });

  it('al subir de nivel no se esconden los retos que ya completó', async () => {
    conNivelEnTema('avanzado', [reto({ id: 1, nivelDificultad: 'basico', resueltos: [{ estado: 'aprobado', xpObtenido: 10 }] })]);
    expect((await service.disponibles(7)).retos.map((r) => r.id)).toEqual([1]);
  });

  it('BÁSICO ve retos (la regla anterior lo excluía por completo)', async () => {
    conNivelEnTema('basico', [reto({ id: 1, nivelDificultad: 'basico' })]);
    const { retos } = await service.disponibles(7);
    expect(retos).toHaveLength(1);
    expect(retos[0].nivel_dificultad).toBe('basico');
  });

  it('sin fila de progreso en el tema, se asume Básico', async () => {
    prisma.progresoTema.findMany.mockResolvedValue([]); // nunca tocó el tema
    prisma.reto.findMany.mockResolvedValue([
      reto({ id: 1, nivelDificultad: 'basico' }),
      reto({ id: 2, nivelDificultad: 'avanzado' }),
    ]);
    const { retos } = await service.disponibles(7);
    expect(retos.map((r) => r.id)).toEqual([1]);
  });

  it('los retos SIN tema (General) se muestran siempre', async () => {
    conNivelEnTema('avanzado', [reto({ id: 9, temaId: null, tema: null, nivelDificultad: 'basico' })]);
    const { retos } = await service.disponibles(7);
    expect(retos.map((r) => r.id)).toEqual([9]);
  });

  it('marca los aprobados como completados en vez de ocultarlos', async () => {
    conNivelEnTema('basico', [
      reto({ id: 1, nivelDificultad: 'basico', resueltos: [{ estado: 'aprobado', xpObtenido: 10, feedbackDocente: null }] }),
      reto({ id: 2, nivelDificultad: 'basico' }),
    ]);
    const { retos } = await service.disponibles(7);
    expect(retos).toHaveLength(2);
    expect(retos.find((r) => r.id === 1)!.completado).toBe(true);
    expect(retos.find((r) => r.id === 2)!.completado).toBe(false);
  });

  it('calcula el progreso por tema con los retos visibles', async () => {
    conNivelEnTema('basico', [
      reto({ id: 1, nivelDificultad: 'basico', resueltos: [{ estado: 'aprobado', xpObtenido: 10 }] }),
      reto({ id: 2, nivelDificultad: 'basico' }),
      reto({ id: 3, nivelDificultad: 'avanzado' }), // no visible: no cuenta
    ]);
    const { progreso_por_tema } = await service.disponibles(7);
    expect(progreso_por_tema).toEqual([{ tema_id: 10, completados: 1, total: 2 }]);
  });

  it('expone la trazabilidad al ejercicio de origen', async () => {
    conNivelEnTema('intermedio', [
      reto({
        id: 5, nivelDificultad: 'intermedio', origenEjercicioId: 99,
        origenEjercicio: { id: 99, fuenteDoc: { codigo: 'E1.5.I.06' } },
      }),
    ]);
    const { retos } = await service.disponibles(7);
    expect(retos[0].origen_ejercicio).toEqual({ id: 99, codigo: 'E1.5.I.06' });
  });

  it('no muestra retos de una unidad que el estudiante aún no abrió (como en Ejercicios)', async () => {
    conNivelEnTema('basico', [reto({ id: 1 }), reto({ id: 2, tema: { ...reto().tema, unidad: { id: 1, numero: 1, titulo: 'U1' } } })]);
    prisma.unidad.findMany.mockResolvedValue([{ id: 1, institucion: 'UPEA' }, { id: 2, institucion: 'UPEA' }]);
    prisma.examenUnidad.findMany.mockResolvedValue([]);
    expect((await service.disponibles(7)).retos.map((r) => r.id)).toEqual([2]);

    // Al aprobar el examen de la Unidad 1 se abren los retos de la Unidad 2.
    prisma.examenUnidad.findMany.mockResolvedValue([{ unidadId: 1 }]);
    expect((await service.disponibles(7)).retos.map((r) => r.id).sort()).toEqual([1, 2]);
  });

  it('moduloHabilitado refleja el interruptor del docente', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ retosHabilitado: true });
    expect(await service.moduloHabilitado()).toBe(true);
    prisma.configuracionSistema.findUnique.mockResolvedValue(null);
    expect(await service.moduloHabilitado()).toBe(false);
  });
});

describe('RetosService.comprobar · «Encuentra el bug» con XP', () => {
  let prisma: PrismaMock;
  let service: RetosService;
  const bug = { id: 9, esBugHunt: true, autoCalificable: false, ejemploSalida: 'Residuo: 1', codigoInicial: 'r = a - (a / b) * b', xp: 25 };

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new RetosService(prisma as never);
    prisma.reto.findFirst.mockResolvedValue(bug);
    prisma.ranking.findMany.mockResolvedValue([{ usuarioId: 7 }]);
  });

  it('con la salida correcta lo deja Completado y suma su XP al ranking', async () => {
    prisma.retoUsuario.findUnique.mockResolvedValue(null);
    const r = await service.comprobar(7, 9, 'Residuo: 1\n', 'r = a - (a // b) * b');
    expect(r).toMatchObject({ correcto: true, xp: 25 });
    expect(prisma.retoUsuario.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ estado: 'aprobado', xpObtenido: 25 }) }));
    expect(prisma.ranking.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { xpTotal: { increment: 25 } } }));
  });

  it('no vuelve a sumar XP si el reto ya estaba completado', async () => {
    prisma.retoUsuario.findUnique.mockResolvedValue({ estado: 'aprobado' });
    const r = await service.comprobar(7, 9, 'Residuo: 1', 'r = a - (a // b) * b');
    expect(r).toMatchObject({ correcto: true, xp: 0, ya_aprobado: true });
    expect(prisma.ranking.upsert).not.toHaveBeenCalled();
  });

  it('el código sin cambios no cuenta como resuelto aunque la salida coincida', async () => {
    prisma.retoUsuario.findUnique.mockResolvedValue(null);
    const r = await service.comprobar(7, 9, 'Residuo: 1', '  r = a - (a / b) * b ');
    expect(r).toMatchObject({ correcto: false, sin_cambios: true, xp: 0 });
  });

  it('una comprobación fallida se cuenta como intento', async () => {
    prisma.retoUsuario.findUnique.mockResolvedValue({ estado: 'sin_entregar', iniciadoEn: new Date() });
    await service.comprobar(7, 9, 'Residuo: 0.0', 'r = a - (a / b) * b + 0');
    expect(prisma.retoUsuario.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ intentosFallidos: { increment: 1 } }) }));
    expect(prisma.ranking.upsert).not.toHaveBeenCalled();
  });
});

describe('estadoTarjeta · sello de cada reto', () => {
  it('distingue sin empezar, pendiente, incompleto, en revisión y completado', () => {
    expect(estadoTarjeta(undefined)).toBe('nuevo');
    expect(estadoTarjeta({ estado: 'sin_entregar' })).toBe('nuevo');
    expect(estadoTarjeta({ estado: 'sin_entregar', iniciadoEn: new Date() })).toBe('en_curso');
    expect(estadoTarjeta({ estado: 'sin_entregar', iniciadoEn: new Date(), intentosFallidos: 2 })).toBe('incompleto');
    expect(estadoTarjeta({ estado: 'necesita_mejorar' })).toBe('incompleto');
    expect(estadoTarjeta({ estado: 'pendiente_revision' })).toBe('revision');
    expect(estadoTarjeta({ estado: 'aprobado', intentosFallidos: 3 })).toBe('aprobado');
  });
});
