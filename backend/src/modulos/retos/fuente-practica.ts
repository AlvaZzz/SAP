/**
 * De qué práctica y de qué ejercicio sale un reto, tal como lo citan los bancos
 * entregados por el autor (`fuenteDoc.citaBreve`): «Práctica Nro. 1 ·
 * Secuenciales, ejercicio 4». El estudiante lo ve en la tarjeta del reto para
 * ubicarlo en su práctica impresa y estudiar con ella.
 *
 * Devuelve null si el reto no viene de una práctica (los que crea el docente).
 */
export function fuentePractica(fuenteDoc: unknown): { texto: string; practica: string; ejercicio: string | null } | null {
  const cita = (fuenteDoc as { citaBreve?: unknown } | null)?.citaBreve;
  if (typeof cita !== 'string' || !/pr[aá]ctica/i.test(cita)) return null;
  const [practica, ...resto] = cita.split('·').map((s) => s.trim());
  return { texto: cita.trim(), practica, ejercicio: resto.join(' · ') || null };
}
