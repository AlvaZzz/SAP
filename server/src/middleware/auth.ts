import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload, Rol } from '../types';
import { forbidden, unauthorized } from '../utils/httpError';
import { parseCookies, AUTH_COOKIE } from '../utils/cookies';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Exige un JWT válido. Acepta la cookie httpOnly `prexi_token` (preferida) o
 * el header `Authorization: Bearer <token>` (compatibilidad con clientes API).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const cookieToken = parseCookies(req.headers.cookie)[AUTH_COOKIE];
  const token = header?.startsWith('Bearer ') ? header.slice(7) : cookieToken;

  if (!token) return next(unauthorized('No autenticado'));
  try {
    req.user = jwt.verify(token, env.jwtSecret) as unknown as JwtPayload;
    next();
  } catch {
    next(unauthorized('Token inválido o expirado'));
  }
}

/** Restringe el acceso a ciertos roles. Usar después de requireAuth. */
export function requireRole(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.rol)) return next(forbidden());
    next();
  };
}
