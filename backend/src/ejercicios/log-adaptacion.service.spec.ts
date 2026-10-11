import { LogAdaptacionService, DecisionMotor } from './log-adaptacion.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

describe('LogAdaptacionService (registro de logs del motor adaptativo)', () => {
  let prisma: PrismaMock;
  let service: LogAdaptacionService;
  const adaptatividad = { nivelDeTema: jest.fn().mockResolvedValue('basico') };

  const DECISION: DecisionMotor = {
    ejercicioId: 10, temaId: 4, dificultadB: -1, thetaAntes: 0, thetaDespues: 0.2,
    nivelAntes: 'basico', personalizado: true, correcto: true, latenciaMs: 18,
  };

  beforeEach(() => {
    prisma = crearPrismaMock();
    adaptatividad.nivelDeTema.mockClear();
    service = new LogAdaptacionService(prisma as never, adaptatividad as never);
    prisma.configuracionSistema.findUnique.mockResolvedValue({ rangoObjetivoMin: 50, rangoObjetivoMax: 85 });
  });

  it('guarda una fila con probabilidad esperada, rango objetivo, latencia y tiempo de retroalimentación', async () => {
    await service.registrar(7, DECISION, 42);
    // θ − b = 0 − (−1) = 1 → P = 0,7311 → dentro de [0,50; 0,85]
    expect(prisma.logAdaptacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        usuarioId: 7, ejercicioId: 10, temaId: 4,
        thetaAntes: 0, thetaDespues: 0.2, dificultadB: -1, probAcierto: 0.7311,
        nivelAntes: 'basico', nivelDespues: 'basico',
        enRangoObjetivo: true, personalizado: true, correcto: true,
        latenciaMs: 18, tiempoRespuestaMs: 42,
      }),
    });
  });

  it('marca FUERA de rango un ejercicio demasiado fácil para la habilidad', async () => {
    await service.registrar(7, { ...DECISION, thetaAntes: 1.5 }, 30); // P = 0,924
    expect(prisma.logAdaptacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ enRangoObjetivo: false }),
    });
  });

  it('respeta el rango objetivo configurado', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ rangoObjetivoMin: 50, rangoObjetivoMax: 95 });
    await service.registrar(7, { ...DECISION, thetaAntes: 1.5 }, 30);
    expect(prisma.logAdaptacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ enRangoObjetivo: true }),
    });
  });

  it('sin θ previa deja la asignación como NO evaluable (null)', async () => {
    await service.registrar(7, { ...DECISION, thetaAntes: null }, 30);
    expect(prisma.logAdaptacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ probAcierto: null, enRangoObjetivo: null }),
    });
  });

  it('nunca lanza: un fallo al registrar no puede romper la respuesta al estudiante', async () => {
    prisma.logAdaptacion.create.mockRejectedValue(new Error('BD caída'));
    await expect(service.registrar(7, DECISION, 30)).resolves.toBeUndefined();
  });
});
