/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  USUARIO DE ACCESO DEL ESTUDIANTE — "PrimerNombre_CI"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  El estudiante entra con su primer nombre, un guion bajo y su CI:
 *  «Álvaro Daniel», CI 12929098 → usuario `Alvaro_12929098`, contraseña inicial
 *  `12929098`. Ya no hace falta el RU (matrícula) para registrarlo.
 *
 *  No se guarda una columna aparte: el CI es único, así que identifica la
 *  cuenta, y el nombre solo se comprueba para que el usuario tenga la forma
 *  acordada. Al compararlo no importan mayúsculas ni tildes (Álvaro = alvaro).
 *  Los que ya entraban con su RU o su correo pueden seguir haciéndolo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Sin tildes ni diéresis, conservando la ñ: "Álvaro" → "Alvaro", "Ñusta" → "Ñusta". */
function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/(?!̃)[̀-ͯ]/g, '').normalize('NFC');
}

/** Clave de comparación: minúsculas, sin tildes y con la ñ como n. */
function clave(texto: string): string {
  return sinTildes(texto).toLowerCase().replace(/ñ/g, 'n');
}

/** Primer nombre: la primera palabra de `nombres` (o, si falta, del nombre completo). */
export function primerNombre(nombres: string | null | undefined, nombreCompleto?: string | null): string {
  const fuente = (nombres?.trim() || nombreCompleto?.trim() || '').split(/\s+/)[0] ?? '';
  const limpio = sinTildes(fuente).replace(/[^A-Za-zÑñ]/g, '');
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase() : '';
}

/** Usuario de acceso: "Alvaro_12929098". Vacío si falta el nombre o el CI. */
export function usuarioDeAcceso(u: { nombres?: string | null; nombre?: string | null; cedula?: string | null }): string {
  const nombre = primerNombre(u.nombres, u.nombre);
  const ci = (u.cedula ?? '').trim().toUpperCase();
  return nombre && ci ? `${nombre}_${ci}` : '';
}

/** Lee "Nombre_CI" de lo que se escribió al iniciar sesión; null si no tiene esa forma. */
export function leerUsuarioDeAcceso(identificador: string): { nombre: string; ci: string } | null {
  const m = identificador.trim().match(/^([^\s_@]+)_([0-9A-Za-z-]{4,20})$/);
  return m ? { nombre: m[1], ci: m[2].toUpperCase() } : null;
}

/**
 * ¿El nombre escrito corresponde a la cuenta? Vale el primer nombre; si la
 * cuenta no tiene `nombres` separados (cuentas antiguas), cualquier palabra
 * del nombre completo.
 */
export function nombreCoincide(escrito: string, u: { nombres?: string | null; nombre?: string | null }): boolean {
  const e = clave(escrito);
  if (!e) return false;
  if (u.nombres?.trim()) return clave(u.nombres.trim().split(/\s+/)[0]) === e;
  return (u.nombre ?? '').split(/\s+/).some((p) => clave(p) === e);
}
