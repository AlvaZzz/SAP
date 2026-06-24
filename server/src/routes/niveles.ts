import { Router } from 'express';
import { query } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const nivelesRouter = Router();

interface NivelConProgreso {
  id: number;
  numero: number;
  titulo: string;
  descripcion: string | null;
  umbral: number;
  total_ejercicios: number;
  ejercicios_completados: number;
  desbloqueado: boolean;
}

// ── Niveles con el progreso del usuario autenticado ─────────
nivelesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    const niveles = await query<NivelConProgreso>(
      `SELECT
         n.id, n.numero, n.titulo, n.descripcion, n.umbral,
         COUNT(DISTINCT e.id)::int AS total_ejercicios,
         COALESCE(pn.ejercicios_completados, 0) AS ejercicios_completados,
         -- El nivel 1 siempre está desbloqueado; el resto según progreso.
         COALESCE(pn.desbloqueado, n.numero = 1) AS desbloqueado
       FROM niveles n
       LEFT JOIN ejercicios e        ON e.nivel_id = n.id
       LEFT JOIN progreso_niveles pn ON pn.nivel_id = n.id AND pn.usuario_id = $1
       GROUP BY n.id, pn.ejercicios_completados, pn.desbloqueado
       ORDER BY n.numero`,
      [userId],
    );
    res.json({ niveles });
  }),
);
