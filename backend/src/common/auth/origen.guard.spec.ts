/**
 * OrigenGuard — defensa CSRF de segunda capa.
 *
 * Estas pruebas fijan el contrato de seguridad. Lo importante que verifican:
 * que la apertura a la red local exista SOLO fuera de producción, y que en
 * producción siga rechazándose todo lo que no sea APP_URL.
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrigenGuard } from './origen.guard';

function ctx(req: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

/** ConfigService mínimo con los valores que el guard consulta. */
function config(valores: Record<string, string | undefined>): ConfigService {
  return { get: (k: string) => valores[k] } as unknown as ConfigService;
}

const post = (origin?: string) => ctx({ method: 'POST', headers: origin ? { origin } : {} });

describe('OrigenGuard en DESARROLLO', () => {
  const guard = new OrigenGuard(config({ APP_URL: 'http://localhost:3000', NODE_ENV: 'development' }));

  it('acepta el origen declarado en APP_URL', () => {
    expect(guard.canActivate(post('http://localhost:3000'))).toBe(true);
  });

  it('acepta la IP de la red local (el celular en el aula)', () => {
    // Este es el caso que fallaba: entrar por la IP de la LAN devolvía
    // "Origen no permitido" y no se podía ni iniciar sesión desde el teléfono.
    expect(guard.canActivate(post('http://192.168.100.39:3000'))).toBe(true);
    expect(guard.canActivate(post('http://10.0.0.5:3000'))).toBe(true);
    expect(guard.canActivate(post('http://172.16.4.9:3000'))).toBe(true);
    expect(guard.canActivate(post('http://127.0.0.1:3000'))).toBe(true);
  });

  it('RECHAZA igualmente un origen público, aunque sea desarrollo', () => {
    expect(() => guard.canActivate(post('https://sitio-malicioso.com'))).toThrow(ForbiddenException);
    // 172.32 queda FUERA del rango privado 172.16–172.31: no debe colarse.
    expect(() => guard.canActivate(post('http://172.32.0.1:3000'))).toThrow(ForbiddenException);
  });
});

describe('OrigenGuard en PRODUCCIÓN', () => {
  const guard = new OrigenGuard(config({ APP_URL: 'https://prexi.vercel.app', NODE_ENV: 'production' }));

  it('acepta únicamente el dominio declarado', () => {
    expect(guard.canActivate(post('https://prexi.vercel.app'))).toBe(true);
  });

  it('NO abre la mano con la red local: la excepción es solo de desarrollo', () => {
    expect(() => guard.canActivate(post('http://192.168.100.39:3000'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(post('http://localhost:3000'))).toThrow(ForbiddenException);
  });

  it('rechaza un dominio parecido pero distinto', () => {
    expect(() => guard.canActivate(post('https://prexi.vercel.app.malicioso.com'))).toThrow(ForbiddenException);
  });
});

describe('OrigenGuard — reglas generales', () => {
  const guard = new OrigenGuard(config({ APP_URL: 'http://localhost:3000', NODE_ENV: 'production' }));

  it('no interviene en peticiones de LECTURA (no hay CSRF que prevenir)', () => {
    expect(guard.canActivate(ctx({ method: 'GET', headers: { origin: 'https://cualquiera.com' } }))).toBe(true);
  });

  it('permite peticiones SIN cabecera de procedencia (curl, e2e, apps nativas)', () => {
    // No son navegadores: no hay cookie que un tercero pueda aprovechar.
    expect(guard.canActivate(post(undefined))).toBe(true);
  });

  it('acepta orígenes adicionales declarados en ORIGENES_PERMITIDOS', () => {
    const g = new OrigenGuard(config({
      APP_URL: 'https://prexi.vercel.app',
      ORIGENES_PERMITIDOS: 'https://staging.prexi.bo, https://otro.bo',
      NODE_ENV: 'production',
    }));
    expect(g.canActivate(post('https://staging.prexi.bo'))).toBe(true);
    expect(g.canActivate(post('https://otro.bo'))).toBe(true);
  });

  it('tolera la barra final en la configuración y en la cabecera', () => {
    const g = new OrigenGuard(config({ APP_URL: 'https://prexi.vercel.app/', NODE_ENV: 'production' }));
    expect(g.canActivate(post('https://prexi.vercel.app'))).toBe(true);
  });
});
