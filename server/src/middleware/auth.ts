import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload, Rol } from '../types';
import { forbidden, unauthorized } from '../utils/httpError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/** Exige un JWT válido en Authorization: Bearer <token>. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(unauthorized('Falta el token Bearer'));
  }
  const token = header.slice(7);
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
