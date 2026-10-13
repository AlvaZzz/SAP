import { TemaEstudiante, UnidadEstudiante } from '@/lib/types';

/** Temas y subtemas de la unidad en el orden en que se estudian. */
export function temasEnOrden(u: UnidadEstudiante): TemaEstudiante[] {
  return u.temas.flatMap((t) => [t, ...(t.subtemas ?? [])]);
}

/** Resumen de una unidad para pintar su avance y saber qué toca hacer. */
export function resumenUnidad(u: UnidadEstudiante) {
  const temas = temasEnOrden(u);
  let total = 0;
  let hechos = 0;
  for (const t of temas) {
    total += t.total_ejercicios;
    hechos += Math.min(t.ejercicios_completados, t.total_ejercicios || t.ejercicios_completados);
  }
  const completos = temas.filter((t) => t.estado === 'completado').length;
  // El examen pide TODOS los temas completos y en nivel Intermedio o más.
  const enNivel = temas.filter((t) => t.estado === 'completado' && t.nivel_actual !== 'basico').length;
  return {
    temas: temas.length, completos, enNivel, total, hechos,
    pct: total ? Math.round((hechos / total) * 100) : 0,
    /** Primer tema abierto que aún no se termina: por donde seguir. */
    siguiente: temas.find((t) => t.desbloqueado && t.estado !== 'completado' && t.total_ejercicios > 0) ?? null,
    listoParaExamen: temas.length > 0 && enNivel === temas.length,
  };
}

export type EstadoExamen = 'aprobado' | 'listo' | 'falta' | 'sin_examen';

/** En qué está el examen de la unidad, visto por el estudiante. */
export function estadoExamen(u: UnidadEstudiante): EstadoExamen {
  if (u.examen_aprobado) return 'aprobado';
  if (!u.examen_disponible) return 'sin_examen';
  return resumenUnidad(u).listoParaExamen ? 'listo' : 'falta';
}
