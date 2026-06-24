import { Router } from 'express';
import { z } from 'zod';
import { queryOne } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, notFound } from '../utils/httpError';
import { requireAuth } from '../middleware/auth';
import { rateLimitAI } from '../middleware/rateLimitAI';
import { getConfig } from '../services/configService';
import * as tutor from '../services/aiTutorService';

export const aiRouter = Router();

// Todas las rutas IA: autenticadas + limitadas por hora.
aiRouter.use(requireAuth, rateLimitAI);

// ── 1) POST /api/ai/asistente ───────────────────────────────
const asistenteSchema = z.object({
  pregunta: z.string().min(2).max(1000),
  contexto_tema: z.string().max(200).optional(),
});

aiRouter.post(
  '/asistente',
  asyncHandler(async (req, res) => {
    const d = asistenteSchema.parse(req.body);
    const respuesta = await tutor.asistente(d.pregunta, d.contexto_tema);
    res.json({ respuesta });
  }),
);

// ── 2) POST /api/ai/retroalimentacion ───────────────────────
const retroSchema = z.object({
  ejercicio_id: z.number().int().positive(),
  respuesta_estudiante: z.string().min(1),
  respuesta_correcta: z.string().min(1),
  codigo_pseudocodigo: z.string().optional(),
});

aiRouter.post(
  '/retroalimentacion',
  asyncHandler(async (req, res) => {
    const d = retroSchema.parse(req.body);
    const out = await tutor.retroalimentacion({
      ejercicioId: d.ejercicio_id,
      respuestaEstudiante: d.respuesta_estudiante,
      respuestaCorrecta: d.respuesta_correcta,
      codigoPseudocodigo: d.codigo_pseudocodigo,
    });
    res.json(out);
  }),
);

// ── 3) POST /api/ai/pista ───────────────────────────────────
const pistaSchema = z.object({
  ejercicio_id: z.number().int().positive(),
  intentos_fallidos: z.number().int().min(0).default(0),
  nivel_pista: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

aiRouter.post(
  '/pista',
  asyncHandler(async (req, res) => {
    const d = pistaSchema.parse(req.body);

    // El nivel de pista no puede exceder el máximo configurado por el admin
    // ni el máximo propio del ejercicio.
    const ej = await queryOne<{ enunciado: string; pseudocodigo: string | null; max_pistas: number }>(
      `SELECT enunciado, pseudocodigo, max_pistas FROM ejercicios WHERE id = $1`,
      [d.ejercicio_id],
    );
    if (!ej) throw notFound('Ejercicio no encontrado');

    const cfg = await getConfig();
    const maxPermitido = Math.min(cfg.max_pistas_ia, ej.max_pistas);
    if (d.nivel_pista > maxPermitido) {
      throw badRequest(
        `Este ejercicio permite como máximo pistas de nivel ${maxPermitido}.`,
      );
    }

    const pista = await tutor.pista({
      ejercicioId: d.ejercicio_id,
      intentosFallidos: d.intentos_fallidos,
      nivelPista: d.nivel_pista,
      enunciado: ej.enunciado,
      pseudocodigo: ej.pseudocodigo ?? undefined,
    });
    res.json({ pista });
  }),
);
