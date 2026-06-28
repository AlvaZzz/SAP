import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface JwtPayload {
  sub: number;
  rol: 'estudiante' | 'docente' | 'admin';
  nombre: string;
}

export const AUTH_COOKIE = 'prexi_token';

/**
 * Exige un JWT válido. Lo toma de la cookie httpOnly `prexi_token` (preferida)
 * o del header `Authorization: Bearer <token>` (clientes API).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const header = req.headers.authorization;
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;

    if (!token) throw new UnauthorizedException('No autenticado');
    try {
      req.user = this.jwt.verify<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
