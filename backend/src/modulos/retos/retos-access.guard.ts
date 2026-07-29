import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { RetosAccessService } from './retos-access.service';

/**
 * Guard de acceso al módulo de retos y a su editor de código. Se apoya en
 * RetosAccessService (nivel IRT + habilitación del docente). Debe ir DESPUÉS de
 * JwtAuthGuard (necesita request.user.sub). Lanza 403 con el motivo legible.
 */
@Injectable()
export class RetosAccessGuard implements CanActivate {
  constructor(private readonly retosAccess: RetosAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { sub?: number } }>();
    const usuarioId = req.user?.sub;
    if (!usuarioId) throw new ForbiddenException('No autenticado');

    const estado = await this.retosAccess.estado(usuarioId);
    if (!estado.acceso) {
      throw new ForbiddenException(estado.motivo ?? 'No tienes acceso a los retos.');
    }
    return true;
  }
}
