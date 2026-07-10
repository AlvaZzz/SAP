/**
 * Catálogo de EMBLEMAS y RANGOS de PREXI (fuente única de la verdad).
 * Lo consumen el seed, EmblemasService (otorgamiento) y RangosService.
 *
 * Los `svgKey` seleccionan un ícono SVG ORIGINAL dibujado en el frontend
 * (components/emblema-icon.tsx / rango-icon.tsx). No se usa ningún asset de
 * juegos con copyright.
 */

export interface EmblemaDef {
  clave: string;
  nombre: string;
  condicion: string; // requisito legible que ve el estudiante
  descripcion: string;
  icono: string; // emoji de respaldo
  svgKey: string;
  categoria: 'constancia' | 'precision' | 'velocidad' | 'maestria' | 'especial' | 'general';
  orden: number;
}

// ≥12 emblemas variados. La lógica de otorgamiento vive en EmblemasService.
export const EMBLEMAS: EmblemaDef[] = [
  { clave: 'primer_acierto', nombre: 'Primer Acierto', condicion: 'Responde correctamente tu primer ejercicio', descripcion: 'El comienzo de todo gran programador.', icono: '🎯', svgKey: 'diana', categoria: 'general', orden: 1 },
  { clave: 'tema_completado', nombre: 'Tema Dominado', condicion: 'Completa todos los ejercicios de un tema', descripcion: 'Cerraste un tema por completo.', icono: '📗', svgKey: 'libro', categoria: 'maestria', orden: 2 },
  { clave: 'sin_errores', nombre: 'Sin Errores', condicion: 'Completa un tema sin fallar ningún ejercicio', descripcion: 'Precisión absoluta de principio a fin.', icono: '✅', svgKey: 'escudo_check', categoria: 'precision', orden: 3 },
  { clave: 'mente_brillante', nombre: 'Mente Brillante', condicion: 'Completa un tema sin usar pistas de ALVARO', descripcion: 'Resolviste todo por tu cuenta.', icono: '💡', svgKey: 'bombilla', categoria: 'maestria', orden: 4 },
  { clave: 'estudiante_veloz', nombre: 'Estudiante Veloz', condicion: 'Completa un tema en menos de 10 minutos', descripcion: 'Rápido y certero.', icono: '⚡', svgKey: 'rayo', categoria: 'velocidad', orden: 5 },
  { clave: 'racha_fuego', nombre: 'Racha de Fuego', condicion: 'Mantén 7 días seguidos de actividad', descripcion: 'La constancia es tu superpoder.', icono: '🔥', svgKey: 'llama', categoria: 'constancia', orden: 6 },
  { clave: 'racha_titan', nombre: 'Racha Titán', condicion: 'Mantén 14 días seguidos de actividad', descripcion: 'Dos semanas imparable.', icono: '🌋', svgKey: 'llama_doble', categoria: 'constancia', orden: 7 },
  { clave: 'maestro_bucles', nombre: 'Maestro de Bucles', condicion: 'Acierta 5 ejercicios de la categoría Bucles', descripcion: 'Los ciclos ya no tienen secretos para ti.', icono: '🔁', svgKey: 'bucle', categoria: 'maestria', orden: 8 },
  { clave: 'maestro_funciones', nombre: 'Maestro de Funciones', condicion: 'Acierta 5 ejercicios de la categoría Funciones', descripcion: 'Modularizas como un profesional.', icono: '🧩', svgKey: 'engranaje', categoria: 'maestria', orden: 9 },
  { clave: 'madrugador', nombre: 'Madrugador', condicion: 'Resuelve un ejercicio antes de las 7:00 AM', descripcion: 'El código sabe mejor al amanecer.', icono: '🌅', svgKey: 'amanecer', categoria: 'especial', orden: 10 },
  { clave: 'nocturno', nombre: 'Búho Nocturno', condicion: 'Resuelve un ejercicio después de las 11:00 PM', descripcion: 'Programas cuando el mundo duerme.', icono: '🌙', svgKey: 'luna', categoria: 'especial', orden: 11 },
  { clave: 'perfeccionista', nombre: 'Perfeccionista', condicion: 'Obtén 100% en el postest', descripcion: 'Puntaje perfecto. Impecable.', icono: '💎', svgKey: 'diamante', categoria: 'precision', orden: 12 },
  { clave: 'unidad_conquistada', nombre: 'Unidad Conquistada', condicion: 'Completa todos los temas de una unidad', descripcion: 'Dominaste una unidad entera.', icono: '👑', svgKey: 'corona', categoria: 'maestria', orden: 13 },
  { clave: 'top_5', nombre: 'Top 5', condicion: 'Entra al top 5 del ranking', descripcion: 'Entre los mejores del curso.', icono: '⭐', svgKey: 'estrella', categoria: 'especial', orden: 14 },
  { clave: 'centurion', nombre: 'Centurión', condicion: 'Resuelve 25 ejercicios correctamente', descripcion: 'Volumen y consistencia.', icono: '🛡️', svgKey: 'escudo_espadas', categoria: 'constancia', orden: 15 },
];

export interface RangoDef {
  clave: string;
  nombre: string;
  orden: number; // 1..6, mayor = mejor
  umbral: number; // puntaje mínimo (0-100) del desempeño de la unidad
  svgKey: string;
  color: string; // paleta sobria
}

// Progresión de rangos con estética de programación (SVG originales por svgKey).
export const RANGOS: RangoDef[] = [
  { clave: 'aprendiz', nombre: 'Aprendiz', orden: 1, umbral: 0, svgKey: 'escudo_1', color: '#64748B' },
  { clave: 'junior', nombre: 'Junior', orden: 2, umbral: 25, svgKey: 'escudo_2', color: '#3B6291' },
  { clave: 'semi_senior', nombre: 'Semi-Senior', orden: 3, umbral: 45, svgKey: 'escudo_3', color: '#2C4A6E' },
  { clave: 'senior', nombre: 'Senior', orden: 4, umbral: 65, svgKey: 'escudo_4', color: '#2E7D5B' },
  { clave: 'arquitecto', nombre: 'Arquitecto', orden: 5, umbral: 82, svgKey: 'escudo_5', color: '#B5822E' },
  { clave: 'maestro', nombre: 'Maestro del Código', orden: 6, umbral: 95, svgKey: 'escudo_6', color: '#B04A44' },
];

/** Rango que corresponde a un puntaje 0-100 (el de mayor umbral alcanzado). */
export function rangoParaPuntaje(puntaje: number): RangoDef {
  let actual = RANGOS[0];
  for (const r of RANGOS) if (puntaje >= r.umbral) actual = r;
  return actual;
}

/** Rango inmediatamente superior (o null si ya es el máximo). */
export function rangoSiguiente(clave: string): RangoDef | null {
  const actual = RANGOS.find((r) => r.clave === clave);
  if (!actual) return null;
  return RANGOS.find((r) => r.orden === actual.orden + 1) ?? null;
}
