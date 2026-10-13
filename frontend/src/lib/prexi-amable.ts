import { ApiError } from './api';

/**
 * Convierte un fallo del tutor en algo que un estudiante entiende y sabe qué
 * hacer después. Nunca muestra el mensaje técnico del servidor ("La IA no está
 * configurada", códigos HTTP…): eso no le sirve y lo asusta.
 */
export function avisoPrexi(err: unknown): { titulo: string; texto: string } {
  const estado = err instanceof ApiError ? err.status : 0;
  if (estado === 429) {
    return { titulo: 'Vamos un poco más despacio', texto: 'Hiciste varias preguntas seguidas. Espera un momento y vuelve a intentarlo; mientras, relee el enunciado con calma.' };
  }
  if (estado === 401 || estado === 403) {
    return { titulo: 'Tu sesión se cerró', texto: 'Vuelve a iniciar sesión para seguir conversando con PREXI.' };
  }
  if (estado === 503 || estado === 502 || estado === 500) {
    return { titulo: 'PREXI está descansando', texto: 'Ahora mismo no puede responder. Puedes seguir resolviendo por tu cuenta y avisarle a tu docente si sigue así.' };
  }
  if (estado === 400 || estado === 422) {
    return { titulo: 'No entendí bien la pregunta', texto: 'Prueba a escribirla de otra forma, con tus propias palabras.' };
  }
  return { titulo: 'No pude conectarme', texto: 'Revisa tu internet y vuelve a intentarlo en un momento.' };
}

/** Primer nombre para saludar ("Quispe Mamani Ana" no: los registros del docente van apellido primero). */
export function nombreDePila(u: { nombres?: string | null; nombre: string } | null | undefined): string {
  if (!u) return '';
  const base = (u.nombres?.trim() || u.nombre.trim()).split(/\s+/)[0] ?? '';
  return base ? base.charAt(0).toUpperCase() + base.slice(1).toLowerCase() : '';
}
