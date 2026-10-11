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
  // Gating por nivel: en estas pruebas el ejercicio SIEMPRE corresponde al nivel
  // del estudiante; el rechazo tiene su propia batería en adaptatividad.service.spec.
  const adaptatividad = { verificarAccesoEjercicio: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    prisma = crearPrismaMock();
    emblemas.evaluarIntento.mockClear();
    rangos.recalcular.mockClear();
    service = new EjerciciosService(prisma as never, emblemas as never, rangos as never, adaptatividad as never);
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

  it('penaliza XP por pistas de PREXI usadas (contadas en el backend)', async () => {
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

  it('solo escribe a quien CAMBIA de posición y lo deja en HistorialRanking', async () => {
    // El 7 adelanta al 2; el 5 conserva su tercer puesto.
    prisma.ranking.findMany.mockResolvedValue([
      { usuarioId: 7, posicion: 2 }, { usuarioId: 2, posicion: 1 }, { usuarioId: 5, posicion: 3 },
    ]);
    await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
    expect(prisma.ranking.update).toHaveBeenCalledTimes(2);
    expect(prisma.historialRanking.createMany).toHaveBeenCalledWith({
      data: [
        { usuarioId: 7, posicionAntes: 2, posicionDespues: 1 },
        { usuarioId: 2, posicionAntes: 1, posicionDespues: 2 },
      ],
    });
  });

  describe('log del motor adaptativo (instrumento de la tesis)', () => {
    const EJ_TEMA = { ...EJERCICIO, temaId: 4, banco: 'practica', dificultadB: -1, nivelDificultad: 'basico' };

    beforeEach(() => {
      // Aísla el progreso por tema: aquí solo interesa lo que se mide del motor.
      jest.spyOn(service as never, 'temaDesbloqueado' as never).mockResolvedValue(true as never);
      jest.spyOn(service as never, 'unidadDesbloqueada' as never).mockResolvedValue(true as never);
      jest.spyOn(service as never, 'avanzarProgresoTema' as never).mockResolvedValue(undefined as never);
      prisma.tema.findUnique.mockResolvedValue({ unidadId: 1 });
      prisma.ejercicio.findUnique.mockResolvedValue(EJ_TEMA);
    });

    it('devuelve la θ con la que se ASIGNÓ el ejercicio y la re-estimada tras responder', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ thetaActual: -0.8, thetaInicial: -1.2 });
      prisma.intento.findMany.mockResolvedValue([
        { correcto: true, ejercicio: { dificultadB: -1 } },
        { correcto: false, ejercicio: { dificultadB: 0 } },
      ]);
      const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
      expect(r.motor.thetaAntes).toBe(-0.8);
      expect(r.motor.thetaDespues).not.toBeNull();
      expect(r.motor.thetaDespues).not.toBe(-0.8);
      expect(r.motor).toMatchObject({
        ejercicioId: 10, temaId: 4, dificultadB: -1, nivelAntes: 'basico', personalizado: true, correcto: true,
      });
    });

    it('sin práctica previa usa la θ del diagnóstico inicial', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ thetaActual: null, thetaInicial: 0.3 });
      const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
      expect(r.motor.thetaAntes).toBe(0.3);
    });

    it('mide la latencia de reajuste en el backend, desde el instante de llegada', async () => {
      const inicio = process.hrtime.bigint() - 50_000_000n; // la respuesta "llegó" hace 50 ms
      const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' }, inicio);
      expect(r.motor.latenciaMs).toBeGreaterThanOrEqual(50);
    });

    it('un ejercicio sin tema NO cuenta como personalizado (orden fijo)', async () => {
      prisma.ejercicio.findUnique.mockResolvedValue({ ...EJERCICIO, banco: 'practica', dificultadB: 0 });
      const r = await service.responder(7, { ejercicioId: 10, respuestaDada: 'B' });
      expect(r.motor.personalizado).toBe(false);
      expect(r.motor.nivelAntes).toBeNull();
    });
  });
});
