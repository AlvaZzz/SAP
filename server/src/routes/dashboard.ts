import { Router } from 'express';
import { query, queryOne } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';

export const dashboardRouter = Router();

// ── Resumen del dashboard del estudiante ────────────────────
dashboardRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;

    const ranking = await queryOne<{ xp_total: number; racha_dias: number; posicion: number | null }>(
      `SELECT xp_total, racha_dias, posicion FROM ranking WHERE usuario_id = $1`,
      [userId],
    );

    const ejercicios = await queryOne<{ completados: number; total: number }>(
      `SELECT
         (SELECT COUNT(DISTINCT ejercicio_id) FROM intentos WHERE usuario_id = $1 AND correcto)::int AS completados,
         (SELECT COUNT(*) FROM ejercicios)::int AS total`,
      [userId],
    );

    // Desempeño por categoría (porcentaje de aciertos).
    const categorias = await query<{ categoria: string; porcentaje: number }>(
      `SELECT e.categoria,
              ROUND(100.0 * COUNT(*) FILTER (WHERE i.correcto) / NULLIF(COUNT(*), 0))::int AS porcentaje
         FROM intentos i JOIN ejercicios e ON e.id = i.ejercicio_id
        WHERE i.usuario_id = $1
        GROUP BY e.categoria ORDER BY e.categoria`,
      [userId],
    );

    const logros = await query(
      `SELECT l.clave, l.nombre, l.icono, lu.fecha_obtenido
         FROM logros_usuario lu JOIN logros l ON l.id = lu.logro_id
        WHERE lu.usuario_id = $1 ORDER BY lu.fecha_obtenido DESC`,
      [userId],
    );

    res.json({
      puntos: ranking?.xp_total ?? 0,
      posicion: ranking?.posicion ?? null,
      racha_dias: ranking?.racha_dias ?? 0,
      ejercicios: ejercicios ?? { completados: 0, total: 0 },
      desempeno_categorias: categorias,
      logros,
    });
  }),
);

// ── Recomendados por la IA (3 ejercicios reales del nivel actual) ──
dashboardRouter.get(
  '/recomendados',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.sub;
    // Nivel actual: el más bajo desbloqueado que aún no está completo (umbral 80%).
    const nivel = await queryOne<{ nivel_id: number }>(
      `SELECT n.id AS nivel_id
         FROM niveles n
         JOIN progreso_niveles pn ON pn.nivel_id = n.id AND pn.usuario_id = $1
        WHERE pn.desbloqueado = true
          AND pn.ejercicios_completados < CEIL(n.umbral * 0.8)
        ORDER BY n.numero LIMIT 1`,
      [userId],
    );
    const recomendados = await query(
      `SELECT e.id, e.titulo, e.categoria, e.estrellas, e.xp, e.enunciado
         FROM ejercicios e
        WHERE e.banco = 'practica'
          AND ($2::int IS NULL OR e.nivel_id = $2)
          AND e.id NOT IN (SELECT ejercicio_id FROM intentos WHERE usuario_id = $1 AND correcto)
        ORDER BY e.estrellas, e.id LIMIT 3`,
      [userId, nivel?.nivel_id ?? null],
    );
    res.json({ recomendados });
  }),
);

// ── Actividad semanal (intentos reales por día) ─────────────
dashboardRouter.get(
  '/actividad',
  requireAuth,
  asyncHandler(async (req, res) => {
    const dias = await query<{ dia: string; intentos: number; aciertos: number }>(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS dia,
              COUNT(i.id)::int AS intentos,
              COUNT(i.id) FILTER (WHERE i.correcto)::int AS aciertos
         FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') d
         LEFT JOIN intentos i ON i.usuario_id = $1 AND i.fecha::date = d::date
        GROUP BY d ORDER BY d`,
      [req.user!.sub],
    );
    res.json({ actividad: dias });
  }),
);

// ── Logros del usuario ──────────────────────────────────────
dashboardRouter.get(
  '/logros',
  requireAuth,
  asyncHandler(async (req, res) => {
    const todos = await query(
      `SELECT l.id, l.clave, l.nombre, l.condicion, l.icono,
              (lu.usuario_id IS NOT NULL) AS obtenido, lu.fecha_obtenido
         FROM logros l
         LEFT JOIN logros_usuario lu ON lu.logro_id = l.id AND lu.usuario_id = $1
        ORDER BY l.id`,
      [req.user!.sub],
    );
    res.json({ logros: todos });
  }),
);
