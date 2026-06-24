import { query } from '../config/db';

export interface FilaReporteEstudiante {
  usuario_id: number;
  nombre: string;
  email: string;
  xp_total: number;
  racha_dias: number;
  posicion: number | null;
  ejercicios_completados: number;
  intentos_totales: number;
  precision_pct: number | null;
}

/** Reporte agregado por estudiante (uso docente/admin). */
export async function reporteEstudiantes(): Promise<FilaReporteEstudiante[]> {
  return query<FilaReporteEstudiante>(`
    SELECT
      u.id AS usuario_id, u.nombre, u.email,
      COALESCE(r.xp_total, 0)   AS xp_total,
      COALESCE(r.racha_dias, 0) AS racha_dias,
      r.posicion,
      COUNT(DISTINCT i.ejercicio_id) FILTER (WHERE i.correcto)::int AS ejercicios_completados,
      COUNT(i.id)::int AS intentos_totales,
      ROUND(100.0 * COUNT(i.id) FILTER (WHERE i.correcto) / NULLIF(COUNT(i.id), 0))::int AS precision_pct
    FROM usuarios u
    LEFT JOIN ranking r  ON r.usuario_id = u.id
    LEFT JOIN intentos i ON i.usuario_id = u.id
    WHERE u.rol = 'estudiante'
    GROUP BY u.id, r.xp_total, r.racha_dias, r.posicion
    ORDER BY xp_total DESC`);
}

export interface FilaReporteCategoria {
  categoria: string;
  intentos: number;
  aciertos: number;
  precision_pct: number | null;
}

/** Desempeño agregado por categoría en toda la plataforma. */
export async function reporteCategorias(): Promise<FilaReporteCategoria[]> {
  return query<FilaReporteCategoria>(`
    SELECT
      e.categoria,
      COUNT(i.id)::int AS intentos,
      COUNT(i.id) FILTER (WHERE i.correcto)::int AS aciertos,
      ROUND(100.0 * COUNT(i.id) FILTER (WHERE i.correcto) / NULLIF(COUNT(i.id), 0))::int AS precision_pct
    FROM ejercicios e
    LEFT JOIN intentos i ON i.ejercicio_id = e.id
    GROUP BY e.categoria
    ORDER BY e.categoria`);
}

/** Ganancia pre/post promedio por categoría (efectividad del curso). */
export async function reporteGanancia() {
  return query(`
    SELECT categoria,
           ROUND(AVG(puntaje) FILTER (WHERE tipo = 'pre'))::int  AS pretest,
           ROUND(AVG(puntaje) FILTER (WHERE tipo = 'post'))::int AS postest,
           ROUND(AVG(puntaje) FILTER (WHERE tipo = 'post') - AVG(puntaje) FILTER (WHERE tipo = 'pre'))::int AS ganancia
      FROM pretest_postest
     GROUP BY categoria
     ORDER BY categoria`);
}
