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

  /**
   * ¿Es un origen de la RED LOCAL? Solo se consulta fuera de producción.
   *
   * Por qué existe: en desarrollo el sistema se prueba desde el celular y desde
   * otras máquinas del aula, que entran por la IP de la LAN
   * (http://192.168.x.x:3000). Como esa cadena no coincide con APP_URL
   * (http://localhost:3000), el guard rechazaba TODAS las mutaciones con
   * "Origen no permitido" y era imposible siquiera iniciar sesión desde el
   * teléfono.
   *
   * Se aceptan únicamente direcciones de rango PRIVADO (RFC 1918) y el propio
   * equipo. Un atacante en internet no puede tener un origen así, y en
   * producción esta rama ni se evalúa: allí solo vale APP_URL.
   */
  private esRedLocal(origen: string): boolean {
    if (this.config.get<string>('NODE_ENV') === 'production') return false;
    try {
      const host = new URL(origen).hostname;
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
      // 10.0.0.0/8 · 172.16.0.0/12 · 192.168.0.0/16
      return /^10\./.test(host)
        || /^192\.168\./.test(host)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    } catch {
      return false;
    }
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
    // Fuera de producción se admite además la red local (celular, otra máquina
    // del aula). Ver `esRedLocal`.
    if (this.esRedLocal(limpio)) return true;

    throw new ForbiddenException('Origen no permitido');
  }
}
