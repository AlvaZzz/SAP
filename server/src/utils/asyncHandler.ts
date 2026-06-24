import { Request, Response, NextFunction, RequestHandler } from 'express';

/** Envuelve un handler async para que los rechazos lleguen al middleware de error. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
