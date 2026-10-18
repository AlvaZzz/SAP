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

/** Letras (con tildes, ñ y ü), espacios, guion, apóstrofo y punto: «María José», «D'Alessandro», «Mamani-Quispe». */
const NOMBRE_PERSONA = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;

/**
 * ¿Es un nombre o apellido de persona válido? Devuelve el mensaje de error, o
 * null si está bien. Sin esta regla, «123» o «<b>» se guardaban como nombres y,
 * peor, el usuario de acceso (PrimerNombre_CI) quedaba vacío: la cuenta no
 * podía iniciar sesión nunca.
 */
export function errorNombrePersona(texto: string | null | undefined, que: string): string | null {
  const t = (texto ?? '').trim();
  if (!t) return `Escribe ${que}.`;
  if (t.length > 80) return `En ${que} caben como máximo 80 caracteres.`;
  if (!NOMBRE_PERSONA.test(t)) return `En ${que} solo van letras, sin números ni símbolos.`;
  if ((t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) ?? []).length < 2) return `En ${que} escribe al menos 2 letras.`;
  return null;
}

/** Primer error de un nombre completo (paterno y nombres obligatorios, materno opcional), o null. */
export function errorNombreCompleto(p: { apellidoPaterno?: string | null; apellidoMaterno?: string | null; nombres?: string | null }): string | null {
  return errorNombrePersona(p.apellidoPaterno, 'el apellido paterno')
    ?? (p.apellidoMaterno?.trim() ? errorNombrePersona(p.apellidoMaterno, 'el apellido materno') : null)
    ?? errorNombrePersona(p.nombres, 'los nombres');
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
