/**
 * Nombres claros de las acciones que registra la auditoría (LogAuditoria.accion),
 * con su color. Si aparece una acción nueva sin nombre, se muestra legible a
 * partir de su clave ("paralelo_crear" → "Paralelo crear").
 */
type Tono = 'blue' | 'green' | 'amber' | 'red' | 'slate';

export const ACCIONES: Record<string, { nombre: string; tono: Tono; grupo: string }> = {
  usuario_crear: { nombre: 'Creó una cuenta', tono: 'green', grupo: 'Usuarios' },
  usuario_editar: { nombre: 'Editó una cuenta', tono: 'blue', grupo: 'Usuarios' },
  usuario_estado: { nombre: 'Activó / desactivó', tono: 'amber', grupo: 'Usuarios' },
  rol_cambiar: { nombre: 'Cambió el rol', tono: 'amber', grupo: 'Usuarios' },
  password_reset: { nombre: 'Restableció contraseña', tono: 'red', grupo: 'Usuarios' },
  estudiantes_registrar: { nombre: 'Registró estudiantes', tono: 'green', grupo: 'Cursos' },
  paralelo_docente: { nombre: 'Asignó docente', tono: 'blue', grupo: 'Cursos' },
  paralelo_crear: { nombre: 'Creó un paralelo', tono: 'green', grupo: 'Cursos' },
  materia_crear: { nombre: 'Creó una materia', tono: 'green', grupo: 'Cursos' },
  examen_habilitar: { nombre: 'Habilitó un examen', tono: 'blue', grupo: 'Evaluación' },
  config_cambiar: { nombre: 'Cambió la configuración', tono: 'slate', grupo: 'Sistema' },
  login_fallido: { nombre: 'Intento de ingreso fallido', tono: 'slate', grupo: 'Seguridad' },
  login_bloqueo: { nombre: 'Cuenta bloqueada', tono: 'red', grupo: 'Seguridad' },
  refresh_reutilizado: { nombre: 'Sesión sospechosa cerrada', tono: 'red', grupo: 'Seguridad' },
  password_restablecida: { nombre: 'Recuperó su contraseña', tono: 'blue', grupo: 'Seguridad' },
};

export function etiquetaAccion(clave: string): string {
  if (ACCIONES[clave]) return ACCIONES[clave].nombre;
  const t = clave.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const tonoAccion = (clave: string): Tono => ACCIONES[clave]?.tono ?? 'slate';
