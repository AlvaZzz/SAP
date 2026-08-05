import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { crearPrismaMock, PrismaMock } from '../test-utils/prisma.mock';

/**
 * Seguridad de la sesión: bloqueo con 429 + retryAfterSeconds, refresh rotatorio
 * y rol tomado de la BD (no del formulario).
 */
describe('AuthService · seguridad de sesión', () => {
  let prisma: PrismaMock;
  let service: AuthService;
  const jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '15m' } });
  const mail = { enviarRecuperacion: jest.fn().mockResolvedValue(undefined) };
  const config = { get: () => undefined };

  const PASS = 'secreta123';
  let hash: string;

  beforeAll(async () => { hash = await bcrypt.hash(PASS, 10); });

  beforeEach(() => {
    prisma = crearPrismaMock();
    service = new AuthService(prisma as never, jwt, mail as never, config as never);
    prisma.refreshToken.create.mockResolvedValue({ id: 1 });
    prisma.logAuditoria.create.mockResolvedValue({ id: 1 });
  });

  /** Usuario activo con la contraseña conocida. */
  function usuario(over: Record<string, unknown> = {}) {
    return {
      id: 7, nombre: 'Ana', email: 'ana@upea.edu.bo', rol: 'estudiante',
      passwordHash: hash, activo: true, failedLoginCount: 0, lockedUntil: null, ...over,
    };
  }

  describe('bloqueo por intentos', () => {
    it('al 5º fallo bloquea y responde 429 con retryAfterSeconds', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuario({ failedLoginCount: 4 }));
      prisma.usuario.update.mockResolvedValue({});

      await expect(service.login({ email: 'ana@upea.edu.bo', password: 'mala' } as never))
        .rejects.toMatchObject({
          status: HttpStatus.TOO_MANY_REQUESTS,
          response: { retryAfterSeconds: 15 * 60 },
        });

      // Se selló el bloqueo y se auditó.
      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lockedUntil: expect.any(Date) }) }),
      );
      expect(prisma.logAuditoria.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accion: 'login_bloqueo' }) }),
      );
    });

    it('antes del 5º fallo solo incrementa el contador y audita el intento', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuario({ failedLoginCount: 1 }));
      prisma.usuario.update.mockResolvedValue({});

      await expect(service.login({ email: 'ana@upea.edu.bo', password: 'mala' } as never))
        .rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { failedLoginCount: 2 } }),
      );
      expect(prisma.logAuditoria.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accion: 'login_fallido' }) }),
      );
    });

    it('con bloqueo vigente responde 429 con los segundos que faltan', async () => {
      const faltan = 5 * 60;
      prisma.usuario.findUnique.mockResolvedValue(
        usuario({ lockedUntil: new Date(Date.now() + faltan * 1000) }),
      );
      await expect(service.login({ email: 'ana@upea.edu.bo', password: PASS } as never))
        .rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    });
  });

  describe('no revelar existencia de cuentas', () => {
    it('correo inexistente y contraseña incorrecta dan el MISMO mensaje', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      const e1 = await service.login({ email: 'nadie@upea.edu.bo', password: 'x' } as never).catch((e) => e);

      prisma.usuario.findUnique.mockResolvedValue(usuario());
      prisma.usuario.update.mockResolvedValue({});
      const e2 = await service.login({ email: 'ana@upea.edu.bo', password: 'mala' } as never).catch((e) => e);

      expect(e1.message).toBe(e2.message);
      expect(e1.getStatus()).toBe(e2.getStatus());
    });
  });

  describe('rol y sesión', () => {
    it('el rol devuelto sale de la BD, no de lo que pida el cliente', async () => {
      prisma.usuario.findUnique
        .mockResolvedValueOnce(usuario({ rol: 'docente' }))          // búsqueda por email
        .mockResolvedValueOnce({ id: 7, rol: 'docente', nombre: 'Ana' }); // SELECT_PUBLICO
      prisma.usuario.update.mockResolvedValue({});

      const r = await service.login({ email: 'ana@upea.edu.bo', password: PASS, rol: 'admin' } as never);
      expect(r.usuario).toMatchObject({ rol: 'docente' });
      expect(jwt.verify(r.token)).toMatchObject({ rol: 'docente' });
    });

    it('"Recordarme" alarga el refresh a 30 días; sin él dura 1 día', async () => {
      const largo = await service.emitirRefresh(7, true);
      const corto = await service.emitirRefresh(7, false);
      const dias = (r: { maxAgeMs: number }) => Math.round(r.maxAgeMs / 86_400_000);
      expect(dias(largo)).toBe(30);
      expect(dias(corto)).toBe(1);
      // El token en claro NUNCA se guarda: en la BD va su hash.
      const guardado = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash;
      expect(guardado).not.toBe(largo.token);
      expect(guardado).toHaveLength(64); // sha256 hex
    });
  });

  describe('refresh silencioso', () => {
    it('canjea un refresh válido, lo ROTA y emite access nuevo', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 3, usuarioId: 7, revocadoEn: null, recordado: true,
        expiraEn: new Date(Date.now() + 86_400_000),
      });
      prisma.usuario.findUnique
        .mockResolvedValueOnce(usuario())
        .mockResolvedValueOnce({ id: 7, rol: 'estudiante', nombre: 'Ana' });
      prisma.refreshToken.update.mockResolvedValue({});

      const r = await service.refrescar('token-en-claro');
      expect(r.token).toBeTruthy();
      // El token usado queda revocado (rotación).
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 3 }, data: { revocadoEn: expect.any(Date) } }),
      );
    });

    it('rechaza un refresh EXPIRADO', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 3, usuarioId: 7, revocadoEn: null, recordado: false,
        expiraEn: new Date(Date.now() - 1000),
      });
      await expect(service.refrescar('viejo')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('sin cookie de refresh falla sin consultar la BD', async () => {
      await expect(service.refrescar(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('reutilizar un refresh YA REVOCADO cierra todas las sesiones (posible robo)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 3, usuarioId: 7, revocadoEn: new Date(), recordado: true,
        expiraEn: new Date(Date.now() + 86_400_000),
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.refrescar('robado')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: 7, revocadoEn: null } }),
      );
      expect(prisma.logAuditoria.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ accion: 'refresh_reutilizado' }) }),
      );
    });

    it('no refresca si la cuenta fue desactivada', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 3, usuarioId: 7, revocadoEn: null, recordado: false,
        expiraEn: new Date(Date.now() + 86_400_000),
      });
      prisma.usuario.findUnique.mockResolvedValue(usuario({ activo: false }));
      await expect(service.refrescar('t')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('restablecer contraseña', () => {
    it('con token expirado no cambia nada', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue({
        usuarioId: 7, usadoEn: null, expiraEn: new Date(Date.now() - 1000),
      });
      await expect(service.restablecerPassword('tok', 'nueva1234')).rejects.toThrow(/no es válido o ya expiró/i);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('con token ya usado tampoco (un solo uso)', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue({
        usuarioId: 7, usadoEn: new Date(), expiraEn: new Date(Date.now() + 60_000),
      });
      await expect(service.restablecerPassword('tok', 'nueva1234')).rejects.toThrow(/no es válido o ya expiró/i);
    });

    it('con token válido cambia la contraseña y CIERRA las sesiones abiertas', async () => {
      prisma.tokenRecuperacion.findUnique.mockResolvedValue({
        usuarioId: 7, usadoEn: null, expiraEn: new Date(Date.now() + 60_000),
      });
      prisma.$transaction.mockResolvedValue([]);

      await service.restablecerPassword('tok', 'nueva1234');
      // La transacción incluye la revocación de refresh tokens del usuario.
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { usuarioId: 7, revocadoEn: null } }),
      );
    });
  });
});
