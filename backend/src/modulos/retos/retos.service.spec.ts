import { RetosService } from './retos.service';
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

  it('muestra SOLO los retos del nivel que el estudiante tiene en ese tema', async () => {
    conNivelEnTema('intermedio', [
      reto({ id: 1, nivelDificultad: 'basico' }),
      reto({ id: 2, nivelDificultad: 'intermedio' }),
      reto({ id: 3, nivelDificultad: 'avanzado' }),
    ]);
    const { retos } = await service.disponibles(7);
    expect(retos.map((r) => r.id)).toEqual([2]);
  });

  it('al subir de nivel en el tema, cambian los retos visibles', async () => {
    const banco = [
      reto({ id: 1, nivelDificultad: 'basico' }),
      reto({ id: 2, nivelDificultad: 'intermedio' }),
    ];
    conNivelEnTema('basico', banco);
    expect((await service.disponibles(7)).retos.map((r) => r.id)).toEqual([1]);

    conNivelEnTema('intermedio', banco);
    expect((await service.disponibles(7)).retos.map((r) => r.id)).toEqual([2]);
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
