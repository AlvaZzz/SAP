import { PoolClient } from 'pg';
import { query } from '../config/db';
import { getConfig } from './configService';
import { Dificultad } from '../types';

const ORDEN: Dificultad[] = ['facil', 'media', 'dificil'];

function subir(d: Dificultad): Dificultad {
  const i = ORDEN.indexOf(d);
  return ORDEN[Math.min(i + 1, ORDEN.length - 1)];
}
function bajar(d: Dificultad): Dificultad {
  const i = ORDEN.indexOf(d);
  return ORDEN[Math.max(i - 1, 0)];
}

export interface RecomendacionAdaptativa {
  aciertosConsecutivos: number;
  fallosConsecutivos: number;
  dificultadActual: Dificultad;
  dificultadSugerida: Dificultad;
  /** Nivel de pista a activar automáticamente (0 = ninguna). */
  pistaSugerida: 0 | 1 | 2 | 3;
  mensaje: string;
}

/**
 * Motor adaptativo (regla de negocio, NO IA generativa).
 * - aciertos consecutivos >= 3 → sube la dificultad sugerida
 * - fallos consecutivos   >= 2 → baja la dificultad + activa pista nivel 2
 */
export async function recomendarSiguiente(
  usuarioId: number,
  dificultadActual: Dificultad,
): Promise<RecomendacionAdaptativa> {
  // Últimos intentos del usuario, más reciente primero.
  const intentos = await query<{ correcto: boolean }>(
    `SELECT correcto FROM intentos WHERE usuario_id = $1 ORDER BY fecha DESC LIMIT 10`,
    [usuarioId],
  );

  let aciertos = 0;
  let fallos = 0;
  for (const it of intentos) {
    if (it.correcto) { if (fallos === 0) aciertos++; else break; }
    else { if (aciertos === 0) fallos++; else break; }
  }

  let sugerida = dificultadActual;
  let pista: RecomendacionAdaptativa['pistaSugerida'] = 0;
  let mensaje = 'Mantén el ritmo, vas bien.';

  if (aciertos >= 3) {
    sugerida = subir(dificultadActual);
    mensaje = `¡${aciertos} aciertos seguidos! Subimos la dificultad a "${sugerida}".`;
  } else if (fallos >= 2) {
    sugerida = bajar(dificultadActual);
    pista = 2;
    mensaje = `Detectamos ${fallos} fallos seguidos. Bajamos la dificultad y activamos una pista.`;
  }

  return {
    aciertosConsecutivos: aciertos,
    fallosConsecutivos: fallos,
    dificultadActual,
    dificultadSugerida: sugerida,
    pistaSugerida: pista,
    mensaje,
  };
}

/**
 * Tras un acierto, incrementa el progreso del nivel y desbloquea el
 * siguiente si se alcanzó el umbral. Corre dentro de una transacción.
 * Devuelve { nivelCompletado, nivelDesbloqueado }.
 */
export async function avanzarProgresoNivel(
  client: PoolClient,
  usuarioId: number,
  nivelId: number,
): Promise<{ nivelCompletado: boolean; nivelDesbloqueadoNumero: number | null }> {
  const cfg = await getConfig();

  // Umbral específico del nivel (si existe) o el global.
  const { rows: nivRows } = await client.query<{ numero: number; umbral: number }>(
    `SELECT numero, umbral FROM niveles WHERE id = $1`,
    [nivelId],
  );
  const nivel = nivRows[0];
  const umbral = nivel?.umbral ?? cfg.umbral_nivel;

  // Cuenta ejercicios distintos del nivel resueltos correctamente.
  const { rows: cnt } = await client.query<{ completados: number }>(
    `SELECT COUNT(DISTINCT i.ejercicio_id)::int AS completados
       FROM intentos i
       JOIN ejercicios e ON e.id = i.ejercicio_id
      WHERE i.usuario_id = $1 AND e.nivel_id = $2 AND i.correcto = true`,
    [usuarioId, nivelId],
  );
  const completados = cnt[0].completados;

  await client.query(
    `INSERT INTO progreso_niveles (usuario_id, nivel_id, ejercicios_completados, desbloqueado, actualizado_en)
     VALUES ($1, $2, $3, true, now())
     ON CONFLICT (usuario_id, nivel_id) DO UPDATE SET
       ejercicios_completados = EXCLUDED.ejercicios_completados,
       desbloqueado = true,
       actualizado_en = now()`,
    [usuarioId, nivelId, completados],
  );

  const nivelCompletado = completados >= umbral;
  let desbloqueadoNumero: number | null = null;

  if (nivelCompletado && nivel) {
    const { rows: sig } = await client.query<{ id: number; numero: number }>(
      `SELECT id, numero FROM niveles WHERE numero = $1`,
      [nivel.numero + 1],
    );
    if (sig[0]) {
      await client.query(
        `INSERT INTO progreso_niveles (usuario_id, nivel_id, ejercicios_completados, desbloqueado)
         VALUES ($1, $2, 0, true)
         ON CONFLICT (usuario_id, nivel_id) DO UPDATE SET desbloqueado = true`,
        [usuarioId, sig[0].id],
      );
      desbloqueadoNumero = sig[0].numero;
    }
  }

  return { nivelCompletado, nivelDesbloqueadoNumero: desbloqueadoNumero };
}
