import { Router } from 'express';
import { query, queryOne } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const rankingRouter = Router();

// ── Tabla de ranking ────────────────────────────────────────
rankingRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limite = Math.min(Number(req.query.limite) || 20, 100);
    const filas = await query(
      `SELECT r.posicion, u.id AS usuario_id, u.nombre, r.xp_total, r.racha_dias
         FROM ranking r JOIN usuarios u ON u.id = r.usuario_id
        WHERE u.rol = 'estudiante'
        ORDER BY r.xp_total DESC, u.id
        LIMIT $1`,
      [limite],
    );

    const yo = await queryOne(
      `SELECT r.posicion, u.nombre, r.xp_total, r.racha_dias
         FROM ranking r JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.usuario_id = $1`,
      [req.user!.sub],
    );

    res.json({ ranking: filas, yo });
  }),
);
