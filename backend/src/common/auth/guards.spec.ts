import { ForbiddenException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard, JwtPayload, AUTH_COOKIE } from './jwt.guard';
import { RolesGuard } from './roles.guard';

function ctxConRequest(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard (autenticación)', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const guard = new JwtAuthGuard(jwt);
  const payload: JwtPayload = { sub: 7, rol: 'estudiante', nombre: 'Ana' };

  it('rechaza peticiones sin token (sesión expirada / no autenticado)', () => {
    expect(() => guard.canActivate(ctxConRequest({ headers: {}, cookies: {} }))).toThrow(UnauthorizedException);
  });

  it('rechaza tokens inválidos o manipulados', () => {
    const req = { headers: {}, cookies: { [AUTH_COOKIE]: 'token-falso' } };
    expect(() => guard.canActivate(ctxConRequest(req))).toThrow('Token inválido o expirado');
  });

  it('rechaza tokens expirados', () => {
    const expirado = jwt.sign(payload, { expiresIn: '0s' });
    const req = { headers: {}, cookies: { [AUTH_COOKIE]: expirado } };
    expect(() => guard.canActivate(ctxConRequest(req))).toThrow('Token inválido o expirado');
  });

  it('acepta el JWT desde la cookie httpOnly y adjunta el usuario', () => {
    const req: Record<string, unknown> = { headers: {}, cookies: { [AUTH_COOKIE]: jwt.sign(payload) } };
    expect(guard.canActivate(ctxConRequest(req))).toBe(true);
    expect((req.user as JwtPayload).sub).toBe(7);
    expect((req.user as JwtPayload).rol).toBe('estudiante');
  });

  it('acepta el JWT por header Authorization: Bearer', () => {
    const req: Record<string, unknown> = { headers: { authorization: `Bearer ${jwt.sign(payload)}` }, cookies: {} };
    expect(guard.canActivate(ctxConRequest(req))).toBe(true);
  });
});

describe('RolesGuard (separación de los 4 roles)', () => {
  function guardConRoles(rolesRequeridos: string[] | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(rolesRequeridos) } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  const casos: Array<[string, string[]]> = [
    ['estudiante', ['docente']],
    ['estudiante', ['admin']],
    ['estudiante', ['investigador']],
    ['docente', ['admin']],
    ['investigador', ['docente', 'admin']],
  ];

  it.each(casos)('un %s NO accede a rutas de %s', (rol, requeridos) => {
    const guard = guardConRoles(requeridos);
    const req = { user: { sub: 1, rol, nombre: 'X' } };
    expect(() => guard.canActivate(ctxConRequest(req))).toThrow(ForbiddenException);
  });

  it('cada rol SÍ accede a sus propias rutas', () => {
    for (const rol of ['estudiante', 'docente', 'admin', 'investigador']) {
      const guard = guardConRoles([rol]);
      expect(guard.canActivate(ctxConRequest({ user: { sub: 1, rol, nombre: 'X' } }))).toBe(true);
    }
  });

  it('sin usuario en la request → Forbidden aunque el token pasara', () => {
    const guard = guardConRoles(['admin']);
    expect(() => guard.canActivate(ctxConRequest({}))).toThrow(ForbiddenException);
  });

  it('rutas sin @Roles quedan abiertas a cualquier usuario autenticado', () => {
    const guard = guardConRoles(undefined);
    expect(guard.canActivate(ctxConRequest({ user: { sub: 1, rol: 'estudiante', nombre: 'X' } }))).toBe(true);
  });
});
