import { BadRequestException } from '@nestjs/common';
import { PostestService } from './postest.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

describe('PostestService (ganancia y candados anti-resultado-vacío)', () => {
  let prisma: PrismaMock;
  let service: PostestService;

  const emblemas = { evaluarPostest: jest.fn().mockResolvedValue([]) };
  const rangos = { recalcular: jest.fn().mockResolvedValue([]) };

  beforeEach(() => {
    prisma = crearPrismaMock();
    emblemas.evaluarPostest.mockClear();
    rangos.recalcular.mockClear();
    service = new PostestService(prisma as never, emblemas as never, rangos as never);
  });

  /** Config + niveles + control docente HABILITADO + repaso revisado → postest disponible. */
  function habilitarPostest() {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ postestDesdeNivel: 3, umbralPorcentaje: 80 });
    prisma.usuario.findUnique.mockResolvedValue({ paralelo: 'A', repasoPostestCompletado: true });
    prisma.postestControl.findUnique.mockResolvedValue({ paralelo: 'A', habilitado: true });
    prisma.nivel.findMany.mockResolvedValue([
      { id: 1, numero: 1, umbral: 10, progreso: [{ ejerciciosCompletados: 10 }] },
      { id: 2, numero: 2, umbral: 10, progreso: [{ ejerciciosCompletados: 9 }] },
      { id: 3, numero: 3, umbral: 10, progreso: [{ ejerciciosCompletados: 8 }] },
      { id: 4, numero: 4, umbral: 10, progreso: [] },
      { id: 5, numero: 5, umbral: 10, progreso: [] },
    ]);
  }

  function simularRespuestasPost(cats: { categoria: string; aciertos: number; total: number }[]) {
    prisma.pretestRespuesta.groupBy.mockResolvedValue(
      cats.map((c) => ({ categoria: c.categoria, _count: { _all: c.total } })),
    );
    prisma.pretestRespuesta.count.mockImplementation((args: { where: { categoria?: string; correcto?: boolean } }) => {
      if (args.where.correcto) {
        const c = cats.find((x) => x.categoria === args.where.categoria);
        return Promise.resolve(c?.aciertos ?? 0);
      }
      if (args.where.categoria) {
        const c = cats.find((x) => x.categoria === args.where.categoria);
        return Promise.resolve(c?.total ?? 0);
      }
      return Promise.resolve(cats.reduce((a, c) => a + c.total, 0));
    });
  }

  it('disponibilidad: disponible SOLO si el docente habilitó el postest del paralelo', async () => {
    habilitarPostest();
    const d = await service.disponibilidad(7);
    expect(d.habilitadoPorDocente).toBe(true);
    expect(d.disponible).toBe(true);
    // Cuenta de niveles se mantiene como dato informativo.
    expect(d.nivelesCompletados).toBe(3);
  });

  it('disponibilidad: NO disponible si el docente no lo habilitó (aunque haya avanzado)', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ postestDesdeNivel: 3, umbralPorcentaje: 80 });
    prisma.usuario.findUnique.mockResolvedValue({ paralelo: 'A' });
    prisma.postestControl.findUnique.mockResolvedValue(null); // sin habilitar
    prisma.nivel.findMany.mockResolvedValue([
      { id: 1, numero: 1, umbral: 10, progreso: [{ ejerciciosCompletados: 10 }] },
      { id: 2, numero: 2, umbral: 10, progreso: [{ ejerciciosCompletados: 10 }] },
      { id: 3, numero: 3, umbral: 10, progreso: [{ ejerciciosCompletados: 10 }] },
    ]);
    const d = await service.disponibilidad(7);
    expect(d.disponible).toBe(false);
  });

  it('disponibilidad: NO disponible si el estudiante no revisó el repaso (aunque el docente habilitó)', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ postestDesdeNivel: 3, umbralPorcentaje: 80 });
    prisma.usuario.findUnique.mockResolvedValue({ paralelo: 'A', repasoPostestCompletado: false });
    prisma.postestControl.findUnique.mockResolvedValue({ paralelo: 'A', habilitado: true });
    prisma.nivel.findMany.mockResolvedValue([]);
    const d = await service.disponibilidad(7);
    expect(d.habilitadoPorDocente).toBe(true);
    expect(d.repasoCompletado).toBe(false);
    expect(d.disponible).toBe(false);
  });

  it('preguntas: rechaza si no se revisó el repaso de cierre', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ postestDesdeNivel: 3, umbralPorcentaje: 80 });
    prisma.usuario.findUnique.mockResolvedValue({ paralelo: 'A', repasoPostestCompletado: false });
    prisma.postestControl.findUnique.mockResolvedValue({ paralelo: 'A', habilitado: true });
    prisma.nivel.findMany.mockResolvedValue([]);
    await expect(service.preguntas(7)).rejects.toThrow('Revisa el repaso');
  });

  it('completarRepaso marca el repaso del postest como revisado', async () => {
    prisma.usuario.update.mockResolvedValue({});
    const r = await service.completarRepaso(7);
    expect(r).toEqual({ completado: true });
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { repasoPostestCompletado: true } }),
    );
  });

  it('finalizar calcula la GANANCIA real: postest − pretest', async () => {
    habilitarPostest();
    simularRespuestasPost([{ categoria: 'Variables', aciertos: 17, total: 20 }]);
    prisma.evaluacion.findUnique.mockImplementation((args: { where: { usuarioId_tipo: { tipo: string } } }) => {
      if (args.where.usuarioId_tipo.tipo === 'pre') return Promise.resolve({ puntajeTotal: 45 });
      return Promise.resolve(null);
    });

    const r = await service.finalizar(7, 900);

    expect(r.puntaje).toBe(85);
    expect(r.ganancia).toBe(40); // 85 − 45
    expect(prisma.evaluacion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ tipo: 'post', puntajeTotal: 85 }),
      }),
    );
  });

  it('IRT: estima θ_final y calcula la ganancia de habilidad Δθ = θ_final − θ_inicial', async () => {
    habilitarPostest();
    simularRespuestasPost([{ categoria: 'Variables', aciertos: 18, total: 20 }]);
    prisma.evaluacion.findUnique.mockImplementation((args: { where: { usuarioId_tipo: { tipo: string } } }) =>
      Promise.resolve(args.where.usuarioId_tipo.tipo === 'pre' ? { puntajeTotal: 40 } : null),
    );
    // θ_inicial guardado del pretest.
    prisma.usuario.findUnique.mockImplementation((args: { select?: { thetaInicial?: boolean } }) =>
      Promise.resolve(args.select?.thetaInicial ? { thetaInicial: -1 } : { paralelo: 'A', repasoPostestCompletado: true }),
    );
    prisma.pretestRespuesta.findMany.mockResolvedValue([
      { correcto: true, ejercicio: { dificultadB: 1 } },
      { correcto: true, ejercicio: { dificultadB: 0 } },
      { correcto: false, ejercicio: { dificultadB: -1 } },
    ]);

    const r = await service.finalizar(7, 600);

    expect(r.theta).not.toBeNull();
    expect(r.theta_pre).toBe(-1);
    expect(r.ganancia_theta).toBeCloseTo(r.theta! - -1, 5);
    // Persiste θ_final y añade el punto postest a la evolución de θ.
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ thetaFinal: r.theta }) }),
    );
    expect(prisma.historialTheta.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ origen: 'postest' }) }),
    );
  });

  it('BUG conocido: finalizar en BLANCO es rechazado (no persiste un 0)', async () => {
    habilitarPostest();
    prisma.pretestRespuesta.count.mockResolvedValue(0); // ninguna pregunta respondida
    await expect(service.finalizar(7)).rejects.toThrow('Responde al menos una pregunta');
    expect(prisma.evaluacion.upsert).not.toHaveBeenCalled();
  });

  it('finalizar es rechazado si el docente no habilitó el postest', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ postestDesdeNivel: 3, umbralPorcentaje: 80 });
    prisma.usuario.findUnique.mockResolvedValue({ paralelo: 'A' });
    prisma.postestControl.findUnique.mockResolvedValue(null); // no habilitado
    prisma.nivel.findMany.mockResolvedValue([]);
    await expect(service.finalizar(7)).rejects.toThrow(BadRequestException);
  });

  it('preguntas: rechaza si ya completó el postest (no se repite)', async () => {
    habilitarPostest();
    prisma.evaluacion.findUnique.mockResolvedValue({ id: 1 }); // ya existe eval post
    await expect(service.preguntas(7)).rejects.toThrow('Ya completaste el postest');
  });

  it('estado de un postest completado se lee de la Evaluacion persistida', async () => {
    habilitarPostest();
    prisma.evaluacion.findUnique.mockImplementation((args: { where: { usuarioId_tipo: { tipo: string } } }) => {
      if (args.where.usuarioId_tipo.tipo === 'post')
        return Promise.resolve({ puntajeTotal: 90, porCategoria: [{ categoria: 'Bucles', aciertos: 18, total: 20, porcentaje: 90 }] });
      return Promise.resolve({ puntajeTotal: 50, porCategoria: [] });
    });

    const e = await service.estado(7);

    expect(e.completado).toBe(true);
    expect(e.resultado?.puntaje).toBe(90);
    expect(e.resultado?.ganancia).toBe(40);
  });

  it('ganancia es null si no existe pretest previo', async () => {
    habilitarPostest();
    simularRespuestasPost([{ categoria: 'Variables', aciertos: 10, total: 20 }]);
    prisma.evaluacion.findUnique.mockResolvedValue(null);
    const r = await service.finalizar(7);
    expect(r.ganancia).toBeNull();
  });
});
