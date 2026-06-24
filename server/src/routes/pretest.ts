import { Router } from 'express';
import { z } from 'zod';
import { query } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const pretestRouter = Router();

const registrarSchema = z.object({
  tipo: z.enum(['pre', 'post']),
  resultados: z
    .array(z.object({ categoria: z.string().min(1), puntaje: z.number().int().min(0).max(100) }))
    .min(1),
});

// ── Registrar puntajes de pre/postest ───────────────────────
pretestRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const d = registrarSchema.parse(req.body);
    const usuarioId = req.user!.sub;

    for (const r of d.resultados) {
      await query(
        `INSERT INTO pretest_postest (usuario_id, tipo, categoria, puntaje)
         VALUES ($1, $2, $3, $4)`,
        [usuarioId, d.tipo, r.categoria, r.puntaje],
      );
    }
    res.status(201).json({ ok: true, registrados: d.resultados.length });
  }),
);

// ── Comparativa pre vs post + ganancia ──────────────────────
pretestRouter.get(
  '/comparativa',
  requireAuth,
  asyncHandler(async (req, res) => {
    const usuarioId = req.user!.sub;

    // Promedio por categoría y tipo (último registro pesa igual: usamos AVG).
    const filas = await query<{ categoria: string; tipo: 'pre' | 'post'; puntaje: number }>(
      `SELECT categoria, tipo, ROUND(AVG(puntaje))::int AS puntaje
         FROM pretest_postest WHERE usuario_id = $1
        GROUP BY categoria, tipo`,
      [usuarioId],
    );

    const mapa = new Map<string, { pre: number | null; post: number | null }>();
    for (const f of filas) {
      const e = mapa.get(f.categoria) ?? { pre: null, post: null };
      e[f.tipo] = f.puntaje;
      mapa.set(f.categoria, e);
    }

    const comparativa = [...mapa.entries()].map(([categoria, v]) => ({
      categoria,
      pretest: v.pre,
      postest: v.post,
      mejora: v.pre != null && v.post != null ? v.post - v.pre : null,
    }));

    // Ganancia global = promedio post - promedio pre.
    const preGlobal = comparativa.filter((c) => c.pretest != null);
    const postGlobal = comparativa.filter((c) => c.postest != null);
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
    const pretestTotal = avg(preGlobal.map((c) => c.pretest!));
    const postestTotal = avg(postGlobal.map((c) => c.postest!));

    res.json({
      comparativa,
      pretest_total: pretestTotal,
      postest_total: postestTotal,
      ganancia: pretestTotal != null && postestTotal != null ? postestTotal - pretestTotal : null,
    });
  }),
);
