import { CanActivate, ExecutionContext, Injectable, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from '@prisma/client';
import { JwtPayload } from './jwt.guard';

export const ROLES_KEY = 'roles';
/** Decorador para restringir un endpoint a ciertos roles. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (!req.user || !roles.includes(req.user.rol)) {
      throw new ForbiddenException('Sin permisos suficientes');
    }
    return true;
  }
}
