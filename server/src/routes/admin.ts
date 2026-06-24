import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { getConfig, updateConfig } from '../services/configService';
import { query } from '../config/db';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('admin'));

// ── Leer configuración del sistema ──────────────────────────
adminRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json({ config: await getConfig() });
  }),
);

// ── Actualizar configuración (tab IA + gamificación) ────────
const configSchema = z.object({
  xp_por_ejercicio: z.number().int().min(0).optional(),
  umbral_nivel: z.number().int().min(1).optional(),
  max_pistas_ia: z.number().int().min(0).max(3).optional(),
  modelo_ia: z.string().min(3).optional(),
});

adminRouter.put(
  '/config',
  asyncHandler(async (req, res) => {
    const patch = configSchema.parse(req.body);
    res.json({ config: await updateConfig(patch) });
  }),
);

// ── Auditoría de uso de IA (control de costos) ──────────────
adminRouter.get(
  '/ia/uso',
  asyncHandler(async (_req, res) => {
    const porUsuario = await query(
      `SELECT u.nombre, u.email,
              COUNT(*)::int AS llamadas_total,
              COUNT(*) FILTER (WHERE iu.fecha > now() - interval '1 hour')::int AS ultima_hora,
              COUNT(*) FILTER (WHERE iu.fecha > now() - interval '24 hours')::int AS ultimo_dia
         FROM consultas_ia iu JOIN usuarios u ON u.id = iu.usuario_id
        GROUP BY u.id ORDER BY llamadas_total DESC`,
    );
    res.json({ uso: porUsuario });
  }),
);
