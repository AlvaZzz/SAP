/**
 * Usuario de acceso del estudiante: su primer nombre, un guion bajo y su CI
 * («Álvaro Daniel», CI 12929098 → `Alvaro_12929098`). La contraseña inicial es
 * el CI. Es la MISMA regla que usa el backend al iniciar sesión
 * (backend/src/common/usuario/usuario-acceso.ts): si se cambia una, cambiar la otra.
 */

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/(?!̃)[̀-ͯ]/g, '').normalize('NFC');
}

export function primerNombre(nombres?: string | null, nombreCompleto?: string | null): string {
  const fuente = (nombres?.trim() || nombreCompleto?.trim() || '').split(/\s+/)[0] ?? '';
  const limpio = sinTildes(fuente).replace(/[^A-Za-zÑñ]/g, '');
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase() : '';
}

/** "Alvaro_12929098", o vacío si falta el nombre o el CI. */
export function usuarioDeAcceso(u: { nombres?: string | null; nombre?: string | null; cedula?: string | null; ci?: string | null }): string {
  const nombre = primerNombre(u.nombres, u.nombre);
  const ci = (u.cedula ?? u.ci ?? '').trim().toUpperCase();
  return nombre && ci ? `${nombre}_${ci}` : '';
}

/** ¿Lo escrito tiene la forma Nombre_CI? */
export const esUsuarioDeAcceso = (v: string) => /^[^\s_@]+_[0-9A-Za-z-]{4,20}$/.test(v.trim());

/** Letras (con tildes, ñ y ü), espacios, guion, apóstrofo y punto. Misma regla que el servidor. */
const NOMBRE_PERSONA = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/;

/** Mensaje de error de un nombre o apellido, o '' si está bien. `que` va en minúscula: «tu apellido paterno». */
export function errorNombrePersona(texto: string, que: string): string {
  const t = texto.trim();
  if (!t) return `Escribe ${que}.`;
  if (!NOMBRE_PERSONA.test(t)) return `En ${que} solo van letras, sin números ni símbolos.`;
  if ((t.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) ?? []).length < 2) return `En ${que} escribe al menos 2 letras.`;
  return '';
}
