import type { EstadoReto } from '@/lib/types';
import { AlertCircle, CheckCircle, Circle, Clock, Inbox } from '@/components/icons';

/**
 * Sello del estado de un reto para el estudiante. Se ve igual en la lista y
 * dentro del reto, para que de un vistazo sepa cuáles terminó, cuáles dejó a
 * medias, cuáles intentó sin lograrlo y en cuáles ni entró.
 */
export const SELLO: Record<EstadoReto, { nombre: string; plural: string; accion: string; color: string; ayuda: string; Icono: typeof Circle }> = {
  nuevo: { nombre: 'Sin empezar', plural: 'Sin empezar', accion: 'Empezar', color: '#64748B', ayuda: 'Todavía no entraste a este reto.', Icono: Circle },
  en_curso: { nombre: 'Pendiente', plural: 'Pendientes', accion: 'Continuar', color: '#D97706', ayuda: 'Entraste, pero lo dejaste a medias.', Icono: Clock },
  incompleto: { nombre: 'Incompleto', plural: 'Incompletos', accion: 'Reintentar', color: '#DC2626', ayuda: 'Lo intentaste y todavía no te salió.', Icono: AlertCircle },
  revision: { nombre: 'En revisión', plural: 'En revisión', accion: 'Ver entrega', color: '#2563EB', ayuda: 'Lo entregaste y tu docente lo está revisando.', Icono: Inbox },
  aprobado: { nombre: 'Completado', plural: 'Completados', accion: 'Ver', color: '#059669', ayuda: 'Lo resolviste correctamente.', Icono: CheckCircle },
};

export const ORDEN_SELLOS: EstadoReto[] = ['nuevo', 'en_curso', 'incompleto', 'revision', 'aprobado'];

/** El sello en sí: borde y texto del color del estado, como un timbre. */
export function SelloReto({ estado, grande = false }: { estado: EstadoReto; grande?: boolean }) {
  const s = SELLO[estado];
  return (
    <span title={s.ayuda}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 font-extrabold uppercase tracking-wide ${grande ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-[11px]'}`}
      style={{ color: s.color, borderColor: s.color, backgroundColor: `${s.color}14` }}>
      <s.Icono className={grande ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden /> {s.nombre}
    </span>
  );
}
