import { createHash } from 'crypto';
import { RecuperacionService } from './recuperacion.service';
import { crearPrismaMock, PrismaMock } from '../../test-utils/prisma.mock';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

describe('Recuperar la contraseña sin correo', () => {
  let prisma: PrismaMock;
  let service: RecuperacionService;
  const auth = { buscarCuenta: jest.fn() };
  const estudiante = { id: 7, nombre: 'Veizaga Acarapi Álvaro', nombres: 'Álvaro', cedula: '12929098', email: null, activo: true };

  beforeEach(() => {
    prisma = crearPrismaMock();
    auth.buscarCuenta.mockReset();
    service = new RecuperacionService(prisma as never, auth as never);
    prisma.solicitudRecuperacion.create.mockResolvedValue({ id: 50 });
  });

  it('un estudiante la pide y se avisa a SU docente', async () => {
    auth.buscarCuenta.mockResolvedValue(estudiante);
    prisma.usuario.findUnique.mockResolvedValue({ rol: 'estudiante', paraleloRef: { docente: { id: 3, nombre: 'Zara Yujra', activo: true } } });
    const r = await service.solicitar('Alvaro_12929098');
    expect(r).toMatchObject({ id: 50, aprueba: 'tu docente, Zara Yujra' });
    expect(r.secreto).toHaveLength(64);
    // En la base solo se guarda el hash del secreto.
    expect(prisma.solicitudRecuperacion.create).toHaveBeenCalledWith({ data: { usuarioId: 7, secretoHash: hash(r.secreto) } });
    expect(prisma.notificacion.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ usuarioId: 3, tipo: 'recuperacion_contrasena', refId: 50, enlace: '/docente/estudiantes/registro?ver=solicitudes' }),
    ]);
    // La nueva solicitud reemplaza a las anteriores de la misma persona.
    expect(prisma.solicitudRecuperacion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { usuarioId: 7, estado: { in: ['pendiente', 'aprobada'] } } }));
  });

  it('un docente (o un estudiante sin docente) la pide y se avisa a los administradores', async () => {
    auth.buscarCuenta.mockResolvedValue({ ...estudiante, id: 3 });
    prisma.usuario.findUnique.mockResolvedValue({ rol: 'docente', paraleloRef: null });
    prisma.usuario.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const r = await service.solicitar('Zara_7777777');
    expect(r.aprueba).toBe('el administrador del sistema');
    expect(prisma.notificacion.createMany.mock.calls[0][0].data.map((n: { usuarioId: number }) => n.usuarioId)).toEqual([1, 2]);
  });

  it('si el usuario no existe lo dice, sin crear nada', async () => {
    auth.buscarCuenta.mockResolvedValue(null);
    await expect(service.solicitar('Nadie_123456')).rejects.toThrow(/No encontramos ese usuario/);
    expect(prisma.solicitudRecuperacion.create).not.toHaveBeenCalled();
  });

  const solicitud = (estado: string, extra: Record<string, unknown> = {}) => ({
    id: 50, usuarioId: 7, estado, secretoHash: hash('s'.repeat(64)), resueltoEn: new Date(), usuario: estudiante, aprobador: { nombre: 'Zara Yujra' }, ...extra,
  });

  it('sin el secreto correcto no se ve ni se completa', async () => {
    prisma.solicitudRecuperacion.findUnique.mockResolvedValue(solicitud('aprobada'));
    await expect(service.estado(50, 'x'.repeat(64))).rejects.toThrow(/No encontramos tu solicitud/);
    await expect(service.completar(50, 'x'.repeat(64), 'Nueva1234')).rejects.toThrow(/No encontramos tu solicitud/);
  });

  it('mientras no la acepten no se puede poner la contraseña', async () => {
    prisma.solicitudRecuperacion.findUnique.mockResolvedValue(solicitud('pendiente'));
    await expect(service.completar(50, 's'.repeat(64), 'Nueva1234')).rejects.toThrow(/todavía no fue aceptada/);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it('aceptada: pone la contraseña, desbloquea, cierra sesiones y marca la solicitud como usada', async () => {
    prisma.solicitudRecuperacion.findUnique.mockResolvedValue(solicitud('aprobada'));
    const r = await service.completar(50, 's'.repeat(64), 'Nueva1234');
    expect(r).toEqual({ ok: true, usuario: 'Alvaro_12929098' });
    expect(prisma.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7 }, data: expect.objectContaining({ mustChangePassword: false, failedLoginCount: 0, lockedUntil: null }) }));
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(prisma.solicitudRecuperacion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'usada' }) }));
  });

  it('pasadas 24 horas de aceptada, vence', async () => {
    prisma.solicitudRecuperacion.findUnique.mockResolvedValue(solicitud('aprobada', { resueltoEn: new Date(Date.now() - 25 * 3_600_000) }));
    expect((await service.estado(50, 's'.repeat(64))).estado).toBe('vencida');
    await expect(service.completar(50, 's'.repeat(64), 'Nueva1234')).rejects.toThrow(/Pide una nueva/);
  });

  it('el docente solo resuelve las de los estudiantes de sus paralelos', async () => {
    prisma.solicitudRecuperacion.findFirst.mockResolvedValue({ id: 50, usuarioId: 7, estado: 'pendiente', usuario: { nombre: 'Álvaro' } });
    await service.resolver(3, 'docente', 50, true);
    expect(prisma.solicitudRecuperacion.findFirst.mock.calls[0][0].where).toEqual({ id: 50, usuario: { rol: 'estudiante', paraleloRef: { docenteId: 3 } } });
    expect(prisma.solicitudRecuperacion.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'aprobada', aprobadorId: 3 }) }));
  });
});
