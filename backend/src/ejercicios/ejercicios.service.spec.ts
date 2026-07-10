import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EjerciciosService } from './ejercicios.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

describe('EjerciciosService (XP, racha, desbloqueo de nivel y ranking)', () => {
  let prisma: PrismaMock;
  let service: EjerciciosService;

  const EJERCICIO = {
    id: 10, nivelId: 1, temaId: null, xp: 50, respuestaCorrecta: 'B', categoria: 'Variables',
    nivelDificultad: 'basico', explicacionIa: 'exp', nivel: { id: 1, numero: 1, umbral: 10 },
  };

  // Stubs de gamificación: no otorgan nada, para aislar la lógica de XP/nivel.
  const emblemas = { evaluarIntento: jest.fn().mockResolvedValue([]) };
  const rangos = { recalcular: jest.fn().mockResolvedValue([]) };

  beforeEach(() => {
    prisma = crearPrismaMock();
    emblemas.evaluarIntento.mockClear();
    rangos.recalcular.mockClear();
    service = new EjerciciosService(prisma as never, emblemas as never, rangos as never);
    prisma.ejercicio.findUnique.mockResolvedValue(EJERCICIO);
    prisma.configuracionSistema.findUnique.mockResolvedValue({ penalizacionPista: 5, umbralPorcentaje: 80 });
    prisma.intento.findFirst.mockResolvedValue(null);
    prisma.consultaIa.count.mockResolvedValue(0);
    prisma.ranking.findUnique.mockResolvedValue(null);
    prisma.intento.count.mockResolvedValue(0);
    prisma.logro.findMany.mockResolvedValue([]);
    prisma.logroUsuario.findMany.mockResolvedValue([]);
    prisma.ranking.findMany.mockResolvedValue([{ usuarioId: 7 }]);
  });

  it('respuesta correcta otorga el XP base del ejercicio (sin pistas, sin racha)', async () => {
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'b', tiempoSeg: 30 });
    expect(r.correcto).toBe(true);
    expect(r.xp.xpOtorgado).toBe(50);
    expect(r.xp.multiplicador).toBe(1);
    expect(prisma.ranking.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ xpTotal: 50 }) }),
    );
  });

  it('un ejercicio de nivel AVANZADO otorga más XP (factor 150% por defecto)', async () => {
    prisma.ejercicio.findUnique.mockResolvedValue({ ...EJERCICIO, nivelDificultad: 'avanzado' });
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(r.xp.xpOtorgado).toBe(75); // 50 × 1.5
  });

  it('un ejercicio de nivel INTERMEDIO aplica el factor 125% por defecto', async () => {
    prisma.ejercicio.findUnique.mockResolvedValue({ ...EJERCICIO, nivelDificultad: 'intermedio' });
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(r.xp.xpOtorgado).toBe(63); // round(50 × 1.25) = 63 (62.5 → 63)
  });

  it('respuesta incorrecta: 0 XP, registra el intento y no toca ranking', async () => {
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'A' });
    expect(r.correcto).toBe(false);
    expect(r.xp.xpOtorgado).toBe(0);
    expect(prisma.ranking.upsert).not.toHaveBeenCalled();
    expect(prisma.intento.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ correcto: false, xpOtorgado: 0 }) }),
    );
  });

  it('penaliza XP por pistas de ALVARO usadas (contadas en el backend)', async () => {
    prisma.consultaIa.count.mockResolvedValue(3); // 3 pistas × 5 = −15
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(r.xp.xpOtorgado).toBe(35); // 50 − 15
  });

  it('el XP penalizado nunca baja de 5 (piso)', async () => {
    prisma.consultaIa.count.mockResolvedValue(20); // penalización 100 > xp 50
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(r.xp.xpOtorgado).toBe(5);
  });

  it('racha de 7+ días aplica multiplicador 1.5', async () => {
    const ayer = new Date(Date.now() - 86_400_000);
    prisma.ranking.findUnique.mockResolvedValue({ usuarioId: 7, xpTotal: 100, rachaDias: 6, ultimaActividad: ayer, posicion: 3 });
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(r.xp.rachaDias).toBe(7);
    expect(r.xp.multiplicador).toBe(1.5);
    expect(r.xp.xpOtorgado).toBe(75); // 50 × 1.5
  });

  it('la racha se corta a 1 si pasaron 2+ días sin actividad', async () => {
    const hace3dias = new Date(Date.now() - 3 * 86_400_000);
    prisma.ranking.findUnique.mockResolvedValue({ usuarioId: 7, xpTotal: 100, rachaDias: 10, ultimaActividad: hace3dias, posicion: 3 });
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(r.xp.rachaDias).toBe(1);
    expect(r.xp.multiplicador).toBe(1);
  });

  it('desbloquea el siguiente nivel al alcanzar el umbral (80% de 10 = 8)', async () => {
    prisma.intento.count.mockResolvedValue(7); // + este intento = 8
    prisma.nivel.findUnique.mockResolvedValue({ id: 2, numero: 2 });
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(r.nivel.nivelCompletado).toBe(true);
    expect(r.nivel.nivelDesbloqueadoNumero).toBe(2);
  });

  it('NO desbloquea el siguiente nivel por debajo del umbral', async () => {
    prisma.intento.count.mockResolvedValue(3); // + este = 4 < 8
    const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(r.nivel.nivelCompletado).toBe(false);
    expect(r.nivel.nivelDesbloqueadoNumero).toBeNull();
  });

  it('rechaza resolver un ejercicio de un nivel bloqueado', async () => {
    prisma.ejercicio.findUnique.mockResolvedValue({ ...EJERCICIO, nivelId: 3, nivel: { id: 3, numero: 3, umbral: 10 } });
    prisma.progresoNivel.findUnique.mockResolvedValue(null);
    await expect(service.responder(7, { ejercicioId: 10, respuestaDada: 'B' })).rejects.toThrow(ForbiddenException);
  });

  it('ejercicio inexistente → NotFound', async () => {
    prisma.ejercicio.findUnique.mockResolvedValue(null);
    await expect(service.responder(7, { ejercicioId: 999, respuestaDada: 'A' })).rejects.toThrow(NotFoundException);
  });

  it('recalcula posiciones del ranking por XP descendente', async () => {
    prisma.ranking.findMany.mockResolvedValue([{ usuarioId: 2 }, { usuarioId: 7 }, { usuarioId: 5 }]);
    await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(prisma.ranking.update).toHaveBeenNthCalledWith(1, { where: { usuarioId: 2 }, data: { posicion: 1 } });
    expect(prisma.ranking.update).toHaveBeenNthCalledWith(2, { where: { usuarioId: 7 }, data: { posicion: 2 } });
    expect(prisma.ranking.update).toHaveBeenNthCalledWith(3, { where: { usuarioId: 5 }, data: { posicion: 3 } });
  });
});
