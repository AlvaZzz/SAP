import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/** Métodos que MUTAN estado; son los únicos que un CSRF buscaría disparar. */
const METODOS_MUTACION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * DEFENSA CSRF (capa 2). La capa 1 es la cookie `sameSite: 'strict'`: el
 * navegador simplemente no la adjunta en peticiones originadas por otro sitio,
 * que es como se monta un CSRF. Este guard añade la comprobación de procedencia:
 * toda mutación debe declarar un `Origin` (o `Referer`) de la propia aplicación.
 *
 * Por qué esto y no un token double-submit: con `sameSite=strict` el token
 * aportaría poco frente al coste de propagarlo por las ~40 rutas de mutación y
 * cada llamada del cliente, multiplicando los puntos de rotura. Si algún día hace
 * falta relajar la cookie a `lax`, este guard es el punto donde añadir el token.
 *
 * Las peticiones SIN Origin ni Referer (curl, tests de e2e, apps nativas) se
 * permiten: no son navegadores y por tanto no hay cookie que un tercero pueda
 * aprovechar desde otro sitio.
 */
@Injectable()
export class OrigenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  private permitidos(): string[] {
    const app = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const extra = this.config.get<string>('ORIGENES_PERMITIDOS') ?? '';
    return [app, ...extra.split(',')]
      .map((o) => o.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!METODOS_MUTACION.has(req.method)) return true;

    const origen = req.headers.origin
      ?? (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
    // Sin cabecera de procedencia no es un navegador: no hay riesgo de CSRF.
    if (!origen) return true;

    const limpio = origen.replace(/\/+$/, '');
    if (this.permitidos().includes(limpio)) return true;

    throw new ForbiddenException('Origen no permitido');
  }
}
