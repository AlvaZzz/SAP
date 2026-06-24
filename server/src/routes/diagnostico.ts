import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { rateLimitAI } from '../middleware/rateLimitAI';
import * as diag from '../services/diagnosticoService';

export const diagnosticoRouter = Router();

diagnosticoRouter.use(requireAuth);

// ── Estado (sin IA): ¿ya hizo el diagnóstico? ───────────────
diagnosticoRouter.get(
  '/estado',
  asyncHandler(async (req, res) => {
    res.json(await diag.getEstado(req.user!.sub));
  }),
);

// ── Generar preguntas (usa IA, cuenta para el rate limit) ───
diagnosticoRouter.get(
  '/preguntas',
  rateLimitAI,
  asyncHandler(async (req, res) => {
    const preguntas = await diag.generarPreguntas(req.user!.sub);
    res.json({ preguntas, total: preguntas.length });
  }),
);

// ── Evaluar respuestas (usa IA, cuenta para el rate limit) ──
const evaluarSchema = z.object({
  respuestas: z
    .array(z.object({ pregunta_id: z.number().int().positive(), opcion: z.string().min(1) }))
    .min(1),
});

diagnosticoRouter.post(
  '/evaluar',
  rateLimitAI,
  asyncHandler(async (req, res) => {
    const { respuestas } = evaluarSchema.parse(req.body);
    const resultado = await diag.evaluar(req.user!.sub, respuestas);
    res.status(201).json({ resultado });
  }),
);
