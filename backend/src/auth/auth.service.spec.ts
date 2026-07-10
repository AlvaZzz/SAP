import { BadRequestException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { AdminGruposService } from '../admin/admin-grupos/admin-grupos.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

describe('AuthService (registro, login y bloqueo de cuenta)', () => {
  let prisma: PrismaMock;
  let service: AuthService;
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
  const mail = { enviarRecuperacion: jest.fn().mockResolvedValue(undefined) };
  const config = { get: (k: string) => (k === 'APP_URL' ? 'http://localhost:3000' : undefined) };

  beforeEach(() => {
    prisma = crearPrismaMock();
    mail.enviarRecuperacion.mockClear();
    service = new AuthService(prisma as never, jwt, mail as never, config as never);
  });

  describe('register', () => {
    const dto = { nombre: 'Ana Pérez', email: 'ana@gmail.com', password: 'secreta123', cedula: '1234567', carrera: 'Sistemas', paralelo: 'A' };

    it('crea al estudiante con contraseña hasheada (bcrypt) y grupo por defecto', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.create.mockImplementation(async (args: { data: { passwordHash: string } }) => {
        // La contraseña NUNCA se guarda en texto plano.
        expect(args.data.passwordHash).not.toBe(dto.password);
        expect(await bcrypt.compare(dto.password, args.data.passwordHash)).toBe(true);
        return { id: 1, nombre: dto.nombre, email: dto.email, rol: 'estudiante' };
      });

      const r = await service.register(dto as never);
      expect(r.token).toBeTruthy();
      expect(jwt.verify(r.token)).toMatchObject({ sub: 1, rol: 'estudiante' });
    });

    it('rechaza correo duplicado con mensaje claro', async () => {
      prisma.usuario.findUnique.mockResolvedValueOnce({ id: 9 });
      await expect(service.register(dto as never)).rejects.toThrow('Ya existe un usuario con ese correo');
    });

    it('rechaza cédula duplicada', async () => {
      prisma.usuario.findUnique
        .mockResolvedValueOnce(null) // email libre
        .mockResolvedValueOnce({ id: 9 }); // cédula tomada
      await expect(service.register(dto as never)).rejects.toThrow('Ya existe un usuario con esa cédula');
    });
  });

  describe('login', () => {
    const hash = bcrypt.hashSync('correcta', 10);
    const usuario = {
      id: 7, nombre: 'Ana', email: 'ana@gmail.com', rol: 'estudiante', passwordHash: hash,
      activo: true, failedLoginCount: 0, lockedUntil: null,
    };

    it('con credenciales válidas devuelve usuario + token y resetea fallos', async () => {
      prisma.usuario.findUnique
        .mockResolvedValueOnce(usuario)
        .mockResolvedValueOnce({ id: 7, nombre: 'Ana', rol: 'estudiante' });
      const r = await service.login({ email: usuario.email, password: 'correcta' });
      expect(r.token).toBeTruthy();
      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { failedLoginCount: 0, lockedUntil: null } }),
      );
    });

    it('correo inexistente y contraseña incorrecta dan el MISMO mensaje (sin filtrar cuáles existen)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'no@x.com', password: 'x' }))
        .rejects.toThrow('Correo o contraseña incorrectos');

      prisma.usuario.findUnique.mockResolvedValue(usuario);
      await expect(service.login({ email: usuario.email, password: 'incorrecta' }))
        .rejects.toThrow('Correo o contraseña incorrectos');
    });

    it('al 5.º intento fallido bloquea la cuenta 15 minutos (código 423)', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ ...usuario, failedLoginCount: 4 });
      try {
        await service.login({ email: usuario.email, password: 'incorrecta' });
        fail('debió lanzar');
      } catch (e) {
        expect((e as HttpException).getStatus()).toBe(423);
      }
      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: expect.any(Date) }),
        }),
      );
    });

    it('cuenta bloqueada no puede entrar aunque la contraseña sea correcta', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ ...usuario, lockedUntil: new Date(Date.now() + 60_000) });
      await expect(service.login({ email: usuario.email, password: 'correcta' })).rejects.toThrow(/bloqueada/);
    });

    it('cuenta desactivada por el admin (soft-disable) no puede entrar', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ ...usuario, activo: false });
      await expect(service.login({ email: usuario.email, password: 'correcta' })).rejects.toThrow(/desactivada/);
    });
  });

  describe('cambiarPassword', () => {
    it('exige la contraseña actual correcta', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ passwordHash: bcrypt.hashSync('real', 10) });
      await expect(service.cambiarPassword(7, { actual: 'equivocada', nueva: 'nueva123' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('recuperación de contraseña', () => {
    it('solicitud con correo INEXISTENTE: respuesta genérica y NO envía correo (no filtra existencia)', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      const r = await service.solicitarRecuperacion('nadie@x.com');
      expect(r.mensaje).toMatch(/Si el correo existe/);
      expect(mail.enviarRecuperacion).not.toHaveBeenCalled();
      expect(prisma.tokenRecuperacion.create).not.toHaveBeenCalled();
    });

    it('solicitud con correo EXISTENTE: guarda solo el HASH del token y envía el enlace', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id: 7, nombre: 'Ana', email: 'ana@gmail.com', activo: true });
      const r = await service.solicitarRecuperacion('Ana@Gmail.com'); // normaliza a minúsculas
      // Misma respuesta genérica (no revela que sí existe).
      expect(r.mensaje).toMatch(/Si el correo existe/);
      // Invalida tokens previos y crea uno nuevo con hash (nunca el token en claro).
      expect(prisma.tokenRecuperacion.updateMany).toHaveBeenCalled();
      const dataCreada = prisma.tokenRecuperacion.create.mock.calls[0][0].data;
      expect(dataCreada.tokenHash).toHaveLength(64); // sha256 hex
      expect(dataCreada.expiraEn.getTime()).toBeGreaterThan(Date.now());
      // Envía el enlace con el TOKEN EN CLARO (no el hash) en la URL del frontend.
      const enlace = mail.enviarRecuperacion.mock.calls[0][2] as string;
      expect(enlace).toContain('/restablecer-contrasena?token=');
      expect(enlace).not.toContain(dataCreada.tokenHash);
    });

    it('cuenta desactivada: no envía correo aunque el correo exista', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ id: 7, nombre: 'Ana', email: 'ana@gmail.com', activo: false });
      await service.solicitarRecuperacion('ana@gmail.com');
      expect(mail.enviarRecuperacion).not.toHaveBeenCalled();
    });

    it('validar token: falso si no existe / expiró / ya se usó', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValueOnce(null);
      expect((await service.validarTokenRecuperacion('x')).valido).toBe(false);

      prisma.tokenRecuperacion.findUnique.mockResolvedValueOnce({ usuarioId: 7, usadoEn: null, expiraEn: new Date(Date.now() - 1000) });
      expect((await service.validarTokenRecuperacion('x')).valido).toBe(false);

      prisma.tokenRecuperacion.findUnique.mockResolvedValueOnce({ usuarioId: 7, usadoEn: new Date(), expiraEn: new Date(Date.now() + 60_000) });
      expect((await service.validarTokenRecuperacion('x')).valido).toBe(false);
    });

    it('restablecer: con token válido hashea la nueva contraseña y consume el token', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue({ id: 1, usuarioId: 7, usadoEn: null, expiraEn: new Date(Date.now() + 60_000) });
      prisma.usuario.update.mockResolvedValue({});
      prisma.tokenRecuperacion.updateMany.mockResolvedValue({ count: 1 });

      const r = await service.restablecerPassword('token-en-claro', 'nuevaClave123');
      expect(r.ok).toBe(true);
      // La nueva contraseña se guarda hasheada (bcrypt), nunca en texto plano.
      const upd = prisma.usuario.update.mock.calls[0][0];
      expect(upd.data.passwordHash).not.toBe('nuevaClave123');
      expect(await bcrypt.compare('nuevaClave123', upd.data.passwordHash)).toBe(true);
      // Limpia el bloqueo para que el usuario pueda entrar.
      expect(upd.data.failedLoginCount).toBe(0);
      expect(upd.data.lockedUntil).toBeNull();
      // Marca el token como usado (un solo uso).
      expect(prisma.tokenRecuperacion.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ usadoEn: expect.any(Date) }) }),
      );
    });

    it('restablecer: token inválido/expirado es rechazado', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue(null);
      await expect(service.restablecerPassword('malo', 'nuevaClave123')).rejects.toThrow(BadRequestException);
    });
  });
});

describe('AdminGruposService (asignación de grupo control/experimental)', () => {
  // Se prueba aquí para mantener juntas las pruebas de investigación.
  let prisma: PrismaMock;
  let service: InstanceType<typeof AdminGruposService>;
  const auditoria = { registrar: jest.fn() };

  beforeEach(() => {
    prisma = crearPrismaMock();
    auditoria.registrar.mockReset();
    service = new AdminGruposService(prisma as never, auditoria as never);
  });

  it('asigna solo a usuarios con rol estudiante (ignora docentes/admins en la lista)', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ gruposBloqueados: false });
    prisma.usuario.findMany.mockResolvedValue([{ id: 1 }, { id: 3 }]); // el 2 no era estudiante
    const r = await service.asignar(99, { ids: [1, 2, 3], grupo: 'control' });
    expect(r.actualizados).toBe(2);
    expect(prisma.usuario.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [1, 3] } }, data: expect.objectContaining({ grupo: 'control' }) }),
    );
    expect(auditoria.registrar).toHaveBeenCalled(); // trazabilidad del estudio
  });

  it('con grupos bloqueados rechaza el cambio salvo que se fuerce', async () => {
    prisma.configuracionSistema.findUnique.mockResolvedValue({ gruposBloqueados: true });
    await expect(service.asignar(99, { ids: [1], grupo: 'experimental' })).rejects.toThrow(/bloqueados/);

    prisma.usuario.findMany.mockResolvedValue([{ id: 1 }]);
    const r = await service.asignar(99, { ids: [1], grupo: 'experimental', forzar: true });
    expect(r.actualizados).toBe(1);
  });
});
