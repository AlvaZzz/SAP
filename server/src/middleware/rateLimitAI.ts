import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { query, queryOne } from '../config/db';
import { tooMany, unauthorized } from '../utils/httpError';

/**
 * Limita las llamadas a la IA por estudiante: máx. N por hora (configurable
 * vía AI_RATE_LIMIT_PER_HOUR). Registra cada uso en la tabla ia_uso, que
 * además sirve de auditoría de costos. Los roles docente/admin no se limitan.
 */
export function rateLimitAI(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());

  // Solo limitamos a estudiantes.
  if (req.user.rol !== 'estudiante') return next();

  const usuarioId = req.user.sub;
  const limite = env.aiRateLimitPerHour;

  queryOne<{ usados: number }>(
    `SELECT COUNT(*)::int AS usados FROM ia_uso
      WHERE usuario_id = $1 AND fecha > now() - interval '1 hour'`,
    [usuarioId],
  )
    .then(async (row) => {
      const usados = row?.usados ?? 0;
      if (usados >= limite) {
        return next(
          tooMany(`Límite de ${limite} consultas IA por hora alcanzado. Intenta más tarde.`),
        );
      }
      // Registra el uso ANTES de llamar a Gemini (cuenta también intentos fallidos).
      await query(
        `INSERT INTO ia_uso (usuario_id, endpoint) VALUES ($1, $2)`,
        [usuarioId, req.path],
      );
      next();
    })
    .catch(next);
}
