import { PoolClient } from 'pg';
import { pool } from '../config/db';

/**
 * Multiplicador de XP según la racha de días consecutivos.
 *  0-2 días → x1.0 | 3-6 → x1.2 | 7-13 → x1.5 | 14+ → x2.0
 */
export function multiplicadorRacha(rachaDias: number): number {
  if (rachaDias >= 14) return 2.0;
  if (rachaDias >= 7) return 1.5;
  if (rachaDias >= 3) return 1.2;
  return 1.0;
}

/**
 * Actualiza la racha del usuario en base a su última actividad.
 * - Mismo día: sin cambios.
 * - Día consecutivo: +1.
 * - Hueco de >1 día: se resetea a 1.
 * Devuelve la racha resultante.
 */
async function actualizarRacha(client: PoolClient, usuarioId: number): Promise<number> {
  const { rows } = await client.query<{ racha_dias: number; dias_desde: number | null }>(
    `SELECT racha_dias,
            (CURRENT_DATE - ultima_actividad) AS dias_desde
       FROM ranking WHERE usuario_id = $1 FOR UPDATE`,
    [usuarioId],
  );

  // Garantiza fila de ranking.
  if (rows.length === 0) {
    await client.query(
      `INSERT INTO ranking (usuario_id, xp_total, racha_dias, ultima_actividad)
       VALUES ($1, 0, 1, CURRENT_DATE)`,
      [usuarioId],
    );
    return 1;
  }

  const { racha_dias, dias_desde } = rows[0];
  let nueva = racha_dias;
  if (dias_desde === null) nueva = 1;          // primera actividad
  else if (dias_desde === 0) nueva = racha_dias; // ya jugó hoy
  else if (dias_desde === 1) nueva = racha_dias + 1; // día consecutivo
  else nueva = 1;                               // se rompió la racha

  await client.query(
    `UPDATE ranking SET racha_dias = $2, ultima_actividad = CURRENT_DATE WHERE usuario_id = $1`,
    [usuarioId, nueva],
  );
  return nueva;
}

export interface ResultadoXP {
  xpBase: number;
  multiplicador: number;
  xpOtorgado: number;
  rachaDias: number;
  xpTotal: number;
}

/**
 * Otorga XP por un acierto, aplicando el multiplicador de racha.
 * Pensado para ejecutarse dentro de una transacción existente.
 */
export async function otorgarXP(
  client: PoolClient,
  usuarioId: number,
  xpBase: number,
): Promise<ResultadoXP> {
  const rachaDias = await actualizarRacha(client, usuarioId);
  const multiplicador = multiplicadorRacha(rachaDias);
  const xpOtorgado = Math.round(xpBase * multiplicador);

  const { rows } = await client.query<{ xp_total: number }>(
    `UPDATE ranking SET xp_total = xp_total + $2 WHERE usuario_id = $1 RETURNING xp_total`,
    [usuarioId, xpOtorgado],
  );

  return {
    xpBase,
    multiplicador,
    xpOtorgado,
    rachaDias,
    xpTotal: rows[0]?.xp_total ?? xpOtorgado,
  };
}

/** Recalcula la columna posicion del ranking según xp_total. */
export async function recalcularPosiciones(client?: PoolClient): Promise<void> {
  const exec = client ?? pool;
  await exec.query(`
    WITH ordenado AS (
      SELECT usuario_id, ROW_NUMBER() OVER (ORDER BY xp_total DESC, usuario_id) AS pos
      FROM ranking
    )
    UPDATE ranking r SET posicion = o.pos
    FROM ordenado o WHERE o.usuario_id = r.usuario_id`);
}

/**
 * Evalúa y concede logros disparados por eventos. Idempotente
 * (ON CONFLICT DO NOTHING). Devuelve las claves de logros nuevos.
 */
export async function evaluarLogros(
  client: PoolClient,
  usuarioId: number,
  evento: { acierto: boolean; usoPistas: boolean; nivelCompletado: boolean },
): Promise<string[]> {
  const nuevos: string[] = [];

  const conceder = async (clave: string) => {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO logros_usuario (usuario_id, logro_id)
       SELECT $1, id FROM logros WHERE clave = $2
       ON CONFLICT DO NOTHING
       RETURNING logro_id AS id`,
      [usuarioId, clave],
    );
    if (rows.length) nuevos.push(clave);
  };

  if (evento.acierto) {
    // Primer acierto absoluto del usuario.
    const { rows } = await client.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM intentos WHERE usuario_id = $1 AND correcto = true`,
      [usuarioId],
    );
    if (rows[0].total === 1) await conceder('primer_acierto');

    // 5 aciertos seguidos sin pistas (aprox: 5 aciertos y sin pistas en este).
    if (!evento.usoPistas && rows[0].total >= 5) await conceder('sin_pistas');
  }

  if (evento.nivelCompletado) await conceder('nivel_completado');

  // Top 5 del ranking.
  const { rows: pos } = await client.query<{ posicion: number | null }>(
    `SELECT posicion FROM ranking WHERE usuario_id = $1`,
    [usuarioId],
  );
  if (pos[0]?.posicion != null && pos[0].posicion <= 5) await conceder('top_5');

  // Racha de 7 días.
  const { rows: r } = await client.query<{ racha_dias: number }>(
    `SELECT racha_dias FROM ranking WHERE usuario_id = $1`,
    [usuarioId],
  );
  if ((r[0]?.racha_dias ?? 0) >= 7) await conceder('racha_7');

  return nuevos;
}
