import { query, queryOne, withTransaction } from '../config/db';
import { badRequest } from '../utils/httpError';

/**
 * Flujo del PRETEST (diagnóstico inicial), banco exclusivo `banco='pretest'`.
 *
 * - Las preguntas seleccionadas se "fijan" insertando filas en pretest_respuestas
 *   (placeholder), de modo que el set es estable entre recargas y el autosave
 *   actualiza cada fila.
 * - El puntaje, nivel y nivel inicial se calculan SIEMPRE en el backend.
 */

export const TOTAL_PRETEST = 20;
const UMBRAL_BAJO = 40;   // < 40 → Bajo
const UMBRAL_ALTO = 70;   // > 70 → Alto

export interface PreguntaPretest {
  id: number;
  categoria: string;
  estrellas: number;
  tipo: string;
  enunciado: string;
  codigo_python: string | null;
  opciones: { id: string; texto: string }[];
  opcion_guardada: string | null;
}

export interface ResultadoPretest {
  puntaje: number;
  nivel: 'Bajo' | 'Medio' | 'Alto';
  nivel_inicial: number;
  aciertos: number;
  total: number;
  por_categoria: { categoria: string; aciertos: number; total: number; porcentaje: number }[];
  fortalezas: string[];
  debilidades: string[];
}

function clasificar(puntaje: number): ResultadoPretest['nivel'] {
  if (puntaje < UMBRAL_BAJO) return 'Bajo';
  if (puntaje <= UMBRAL_ALTO) return 'Medio';
  return 'Alto';
}

export async function estado(
  usuarioId: number,
): Promise<{ completado: boolean; resultado: ResultadoPretest | null }> {
  const u = await queryOne<{ pretest_completado: boolean }>(
    `SELECT pretest_completado FROM usuarios WHERE id = $1`,
    [usuarioId],
  );
  if (!u?.pretest_completado) return { completado: false, resultado: null };
  return { completado: true, resultado: await calcularResultado(usuarioId) };
}

/** Devuelve (y fija) las 20 preguntas del pretest del usuario. */
export async function preguntas(usuarioId: number): Promise<PreguntaPretest[]> {
  // Si no tiene set asignado, selecciona 20 al azar y fija placeholders.
  const existentes = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM pretest_respuestas WHERE usuario_id = $1`,
    [usuarioId],
  );
  if (existentes[0].n === 0) {
    await withTransaction(async (c) => {
      const { rows } = await c.query<{ id: number; categoria: string }>(
        `SELECT id, categoria FROM ejercicios WHERE banco = 'pretest' ORDER BY random() LIMIT $1`,
        [TOTAL_PRETEST],
      );
      for (const e of rows) {
        await c.query(
          `INSERT INTO pretest_respuestas (usuario_id, ejercicio_id, opcion_dada, correcto, categoria)
           VALUES ($1, $2, '', false, $3)
           ON CONFLICT (usuario_id, ejercicio_id) DO NOTHING`,
          [usuarioId, e.id, e.categoria],
        );
      }
    });
  }

  return query<PreguntaPretest>(
    `SELECT e.id, e.categoria, e.estrellas, e.tipo, e.enunciado, e.codigo_python, e.opciones,
            NULLIF(pr.opcion_dada, '') AS opcion_guardada
       FROM pretest_respuestas pr
       JOIN ejercicios e ON e.id = pr.ejercicio_id
      WHERE pr.usuario_id = $1
      ORDER BY pr.ejercicio_id`,
    [usuarioId],
  );
}

/** Autosave de una respuesta. La corrección se evalúa en el backend. */
export async function responder(usuarioId: number, ejercicioId: number, opcion: string): Promise<void> {
  const ej = await queryOne<{ respuesta_correcta: string; categoria: string }>(
    `SELECT e.respuesta_correcta, e.categoria
       FROM pretest_respuestas pr JOIN ejercicios e ON e.id = pr.ejercicio_id
      WHERE pr.usuario_id = $1 AND pr.ejercicio_id = $2`,
    [usuarioId, ejercicioId],
  );
  if (!ej) throw badRequest('La pregunta no pertenece a tu pretest');

  const correcto = opcion.trim().toUpperCase() === ej.respuesta_correcta.trim().toUpperCase();
  await query(
    `UPDATE pretest_respuestas SET opcion_dada = $3, correcto = $4, fecha = now()
      WHERE usuario_id = $1 AND ejercicio_id = $2`,
    [usuarioId, ejercicioId, opcion, correcto],
  );
}

async function agregadoPorCategoria(usuarioId: number) {
  const filas = await query<{ categoria: string; aciertos: number; total: number }>(
    `SELECT categoria, COUNT(*) FILTER (WHERE correcto)::int AS aciertos, COUNT(*)::int AS total
       FROM pretest_respuestas WHERE usuario_id = $1 GROUP BY categoria ORDER BY categoria`,
    [usuarioId],
  );
  return filas.map((f) => ({ ...f, porcentaje: f.total ? Math.round((f.aciertos / f.total) * 100) : 0 }));
}

async function calcularResultado(usuarioId: number): Promise<ResultadoPretest> {
  const por_categoria = await agregadoPorCategoria(usuarioId);
  const total = por_categoria.reduce((a, c) => a + c.total, 0) || TOTAL_PRETEST;
  const aciertos = por_categoria.reduce((a, c) => a + c.aciertos, 0);
  const puntaje = Math.round((aciertos / total) * 100);
  const nivel = clasificar(puntaje);
  return {
    puntaje, nivel,
    nivel_inicial: nivel === 'Alto' ? 2 : 1,
    aciertos, total,
    por_categoria,
    fortalezas: por_categoria.filter((c) => c.porcentaje >= 60).map((c) => c.categoria),
    debilidades: por_categoria.filter((c) => c.porcentaje < 60).map((c) => c.categoria),
  };
}

/** Cierra el pretest: calcula, persiste y configura el nivel inicial. */
export async function finalizar(usuarioId: number): Promise<ResultadoPretest> {
  const r = await calcularResultado(usuarioId);

  await withTransaction(async (c) => {
    // Guarda el desglose por categoría como puntajes 'pre'.
    await c.query(`DELETE FROM pretest_postest WHERE usuario_id = $1 AND tipo = 'pre'`, [usuarioId]);
    for (const cat of r.por_categoria) {
      await c.query(
        `INSERT INTO pretest_postest (usuario_id, tipo, categoria, puntaje) VALUES ($1, 'pre', $2, $3)`,
        [usuarioId, cat.categoria, cat.porcentaje],
      );
    }

    await c.query(
      `UPDATE usuarios SET pretest_completado = true, diagnostico_completado = true, nivel_inicial = $2 WHERE id = $1`,
      [usuarioId, r.nivel_inicial],
    );

    // Desbloquea niveles hasta el inicial asignado por reglas de negocio.
    const { rows: niveles } = await c.query<{ id: number; numero: number }>(`SELECT id, numero FROM niveles`);
    for (const n of niveles) {
      if (n.numero <= r.nivel_inicial) {
        await c.query(
          `INSERT INTO progreso_niveles (usuario_id, nivel_id, ejercicios_completados, desbloqueado)
           VALUES ($1, $2, 0, true)
           ON CONFLICT (usuario_id, nivel_id) DO UPDATE SET desbloqueado = true`,
          [usuarioId, n.id],
        );
      }
    }
  });

  return r;
}
