import { Router } from 'express';
import { z } from 'zod';
import { withTransaction, query } from '../config/db';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound, forbidden } from '../utils/httpError';
import { requireAuth } from '../middleware/auth';
import { Ejercicio } from '../types';
import { otorgarXP, recalcularPosiciones, evaluarLogros } from '../services/gamificationService';
import { avanzarProgresoNivel, recomendarSiguiente } from '../services/adaptiveService';

export const intentosRouter = Router();

const enviarSchema = z.object({
  ejercicio_id: z.number().int().positive(),
  respuesta_dada: z.string().min(1),
  tiempo_seg: z.number().int().min(0).default(0),
  uso_pistas: z.boolean().default(false),
});

// ── Registrar un intento ────────────────────────────────────
intentosRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const d = enviarSchema.parse(req.body);
    const usuarioId = req.user!.sub;

    const resultado = await withTransaction(async (client) => {
      const { rows } = await client.query<Ejercicio & { nivel_numero: number }>(
        `SELECT e.id, e.nivel_id, e.dificultad, e.respuesta_correcta, e.xp, e.explicacion_ia, n.numero AS nivel_numero
           FROM ejercicios e JOIN niveles n ON n.id = e.nivel_id WHERE e.id = $1`,
        [d.ejercicio_id],
      );
      const ej = rows[0];
      if (!ej) throw notFound('Ejercicio no encontrado');

      // Seguridad: no se puede resolver un ejercicio de un nivel bloqueado.
      if (ej.nivel_numero > 1) {
        const desbloqueado = await client.query(
          `SELECT 1 FROM progreso_niveles WHERE usuario_id = $1 AND nivel_id = $2 AND desbloqueado = true`,
          [usuarioId, ej.nivel_id],
        );
        if (desbloqueado.rows.length === 0) {
          throw forbidden('Este nivel aún está bloqueado. Completa el nivel anterior primero.');
        }
      }

      const correcto = d.respuesta_dada.trim().toUpperCase() === ej.respuesta_correcta.trim().toUpperCase();

      // Gamificación: solo se otorga XP en aciertos.
      let xp = { xpOtorgado: 0, multiplicador: 1, rachaDias: 0, xpTotal: 0, xpBase: ej.xp };
      let nivelInfo = { nivelCompletado: false, nivelDesbloqueadoNumero: null as number | null };
      let logros: string[] = [];

      if (correcto) {
        xp = await otorgarXP(client, usuarioId, ej.xp);
        nivelInfo = await avanzarProgresoNivel(client, usuarioId, ej.nivel_id);
      }

      await client.query(
        `INSERT INTO intentos (usuario_id, ejercicio_id, respuesta_dada, correcto, tiempo_seg, xp_otorgado)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [usuarioId, d.ejercicio_id, d.respuesta_dada, correcto, d.tiempo_seg, xp.xpOtorgado],
      );

      await recalcularPosiciones(client);

      logros = await evaluarLogros(client, usuarioId, {
        acierto: correcto,
        usoPistas: d.uso_pistas,
        nivelCompletado: nivelInfo.nivelCompletado,
      });

      return { ej, correcto, xp, nivelInfo, logros };
    });

    // El motor adaptativo recomienda el siguiente paso (fuera de la transacción).
    const recomendacion = await recomendarSiguiente(usuarioId, resultado.ej.dificultad);

    res.status(201).json({
      correcto: resultado.correcto,
      respuesta_correcta: resultado.ej.respuesta_correcta,
      explicacion_base: resultado.ej.explicacion_ia ?? null,
      xp: resultado.xp,
      nivel: resultado.nivelInfo,
      logros_nuevos: resultado.logros,
      recomendacion,
    });
  }),
);

// ── Historial de intentos del usuario ───────────────────────
intentosRouter.get(
  '/mios',
  requireAuth,
  asyncHandler(async (req, res) => {
    const intentos = await query(
      `SELECT i.id, i.ejercicio_id, e.titulo, i.respuesta_dada, i.correcto,
              i.tiempo_seg, i.xp_otorgado, i.fecha
         FROM intentos i JOIN ejercicios e ON e.id = i.ejercicio_id
        WHERE i.usuario_id = $1 ORDER BY i.fecha DESC LIMIT 100`,
      [req.user!.sub],
    );
    res.json({ intentos });
  }),
);
