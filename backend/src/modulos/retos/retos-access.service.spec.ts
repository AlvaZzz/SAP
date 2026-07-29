import { RetosAccessService } from './retos-access.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

/**
 * REGLA VIGENTE: el acceso al MÓDULO depende solo del interruptor del docente.
 * Qué retos ve cada estudiante lo decide su nivel POR TEMA (ver retos.service.spec).
 * La regla anterior (θ global + permiso por nivel + Básico excluido) quedó sin efecto.
 */
describe('RetosAccessService (interruptor general del docente)', () => {
  let prisma: PrismaMock;
  let adaptatividad: { thetaActual: jest.Mock };
  let service: RetosAccessService;

  beforeEach(() => {
    prisma = crearPrismaMock();
    adaptatividad = { thetaActual: jest.fn() };
    service = new RetosAccessService(prisma as never, adaptatividad as never);
  });

  function escenario(theta: number | null, habilitado: boolean) {
    adaptatividad.thetaActual.mockResolvedValue(theta);
    prisma.configuracionSistema.findUnique.mockResolvedValue({ retosHabilitado: habilitado });
  }

  it('con el módulo habilitado, BÁSICO también entra (cambio de regla)', async () => {
    escenario(-2, true); // θ muy bajo → básico
    const e = await service.estado(7);
    expect(e.nivel).toBe('basico');
    expect(e.acceso).toBe(true);
    expect(e.motivo).toBeNull();
  });

  it('sin el interruptor del docente nadie entra, sea cual sea su nivel', async () => {
    for (const theta of [-2, 0, 2]) {
      escenario(theta, false);
      const e = await service.estado(7);
      expect(e.acceso).toBe(false);
      expect(e.motivo).toMatch(/no habilitó/i);
    }
  });

  it('sin θ (sin práctica ni pretest) el nivel informativo es Básico', async () => {
    escenario(null, true);
    const e = await service.estado(7);
    expect(e.nivel).toBe('basico');
    expect(e.acceso).toBe(true);
  });

  it('sin fila de configuración, el módulo está cerrado por defecto', async () => {
    adaptatividad.thetaActual.mockResolvedValue(0);
    prisma.configuracionSistema.findUnique.mockResolvedValue(null);
    const e = await service.estado(7);
    expect(e.acceso).toBe(false);
  });

  it('expone el estado del módulo y la etiqueta de nivel', async () => {
    escenario(0, true);
    const e = await service.estado(7);
    expect(e.modulo_habilitado).toBe(true);
    expect(e.nivel_label).toBe('Intermedio');
  });
});
