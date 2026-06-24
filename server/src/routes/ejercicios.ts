import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';
import { Ejercicio } from '../types';

export const ejerciciosRouter = Router();

const SELECT_FULL = `
  id, titulo, categoria, nivel_id, dificultad, enunciado, pseudocodigo,
  opciones, respuesta_correcta, xp, explicacion_ia, max_pistas`;

/** Quita la respuesta correcta para entregar al estudiante. */
function sanitizar(e: Ejercicio) {
  const { respuesta_correcta, ...publico } = e;
  return publico;
}

const upsertSchema = z.object({
  titulo: z.string().min(2),
  categoria: z.string().min(2),
  nivel_id: z.number().int().positive(),
  dificultad: z.enum(['facil', 'media', 'dificil']).default('media'),
  enunciado: z.string().min(2),
  pseudocodigo: z.string().optional(),
  opciones: z.array(z.object({ id: z.string(), texto: z.string() })).min(2),
  respuesta_correcta: z.string().min(1),
  xp: z.number().int().min(0).default(50),
  explicacion_ia: z.string().optional(),
  max_pistas: z.number().int().min(0).max(3).default(3),
});

// ── Listado (estudiante: sin respuesta) ─────────────────────
ejerciciosRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { nivel, categoria, dificultad } = req.query;
    const filtros: string[] = [];
    const params: unknown[] = [];

    if (nivel) { params.push(Number(nivel)); filtros.push(`nivel_id = $${params.length}`); }
    if (categoria) { params.push(String(categoria)); filtros.push(`categoria = $${params.length}`); }
    if (dificultad) { params.push(String(dificultad)); filtros.push(`dificultad = $${params.length}`); }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const rows = await query<Ejercicio>(
      `SELECT ${SELECT_FULL} FROM ejercicios ${where} ORDER BY nivel_id, id`,
      params,
    );

    const esDocente = req.user!.rol !== 'estudiante';
    res.json({ ejercicios: esDocente ? rows : rows.map(sanitizar) });
  }),
);

// ── Detalle ─────────────────────────────────────────────────
ejerciciosRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const e = await queryOne<Ejercicio>(
      `SELECT ${SELECT_FULL} FROM ejercicios WHERE id = $1`,
      [Number(req.params.id)],
    );
    if (!e) throw notFound('Ejercicio no encontrado');
    const esDocente = req.user!.rol !== 'estudiante';
    res.json({ ejercicio: esDocente ? e : sanitizar(e) });
  }),
);

// ── Crear (docente/admin) ───────────────────────────────────
ejerciciosRouter.post(
  '/',
  requireAuth,
  requireRole('docente', 'admin'),
  asyncHandler(async (req, res) => {
    const d = upsertSchema.parse(req.body);
    const rows = await query<Ejercicio>(
      `INSERT INTO ejercicios
        (titulo, categoria, nivel_id, dificultad, enunciado, pseudocodigo, opciones, respuesta_correcta, xp, explicacion_ia, max_pistas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING ${SELECT_FULL}`,
      [d.titulo, d.categoria, d.nivel_id, d.dificultad, d.enunciado, d.pseudocodigo ?? null,
       JSON.stringify(d.opciones), d.respuesta_correcta, d.xp, d.explicacion_ia ?? null, d.max_pistas],
    );
    res.status(201).json({ ejercicio: rows[0] });
  }),
);

// ── Actualizar (docente/admin) ──────────────────────────────
ejerciciosRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente', 'admin'),
  asyncHandler(async (req, res) => {
    const d = upsertSchema.parse(req.body);
    const rows = await query<Ejercicio>(
      `UPDATE ejercicios SET
         titulo=$1, categoria=$2, nivel_id=$3, dificultad=$4, enunciado=$5,
         pseudocodigo=$6, opciones=$7, respuesta_correcta=$8, xp=$9,
         explicacion_ia=$10, max_pistas=$11
       WHERE id=$12 RETURNING ${SELECT_FULL}`,
      [d.titulo, d.categoria, d.nivel_id, d.dificultad, d.enunciado, d.pseudocodigo ?? null,
       JSON.stringify(d.opciones), d.respuesta_correcta, d.xp, d.explicacion_ia ?? null, d.max_pistas,
       Number(req.params.id)],
    );
    if (!rows[0]) throw notFound('Ejercicio no encontrado');
    res.json({ ejercicio: rows[0] });
  }),
);

// ── Eliminar (docente/admin) ────────────────────────────────
ejerciciosRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente', 'admin'),
  asyncHandler(async (req, res) => {
    const rows = await query(`DELETE FROM ejercicios WHERE id = $1 RETURNING id`, [Number(req.params.id)]);
    if (!rows[0]) throw notFound('Ejercicio no encontrado');
    res.status(204).end();
  }),
);
