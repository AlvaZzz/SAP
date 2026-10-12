'use client';

/**
 * Piezas compartidas por las pantallas del docente que muestran estudiantes
 * (dashboard, seguimiento, ficha y evaluación final): tipos, insignias y la
 * lista nominal. Regla del rol: ningún número queda suelto; todo conteo se
 * puede abrir para ver QUÉ estudiantes son.
 */

import Link from 'next/link';
import { Badge } from '@/components/ui';
import { NivelDificultad, NIVEL_COLOR, NIVEL_LABEL } from '@/lib/types';

export type EstadoCurso = 'sin_ingresar' | 'en_riesgo' | 'inactivo' | 'en_progreso';
export type Situacion = 'aprobado' | 'cerca' | 'bajo' | 'sin_evaluaciones';
export interface Motivo { clave: string; detalle: string; gravedad: 'alta' | 'media' }

export interface FilaCurso {
  id: number; nombre: string;
  apellido_paterno: string | null; apellido_materno: string | null; nombres: string | null;
  ci: string | null; ru: string | null; email: string | null;
  activo: boolean; ya_ingreso: boolean;
  paralelo: { id: number | null; nombre: string; materia: string | null; gestion: string | null };
  docente: string | null;
  nivel: NivelDificultad; nivel_label: string;
  promedio: number | null; situacion: Situacion;
  tasa_acierto: number | null; intentos: number; ejercicios_resueltos: number; xp: number;
  ultima_sesion: string | null; tiene_diagnostico: boolean; evaluacion_final: number | null;
  estado: EstadoCurso; motivos_riesgo: Motivo[];
}

/** Estudiante en una lista nominal (lo mínimo para identificarlo). */
export interface Nominal {
  id: number; nombre: string; ci: string | null; ru: string | null; paralelo: string;
  promedio: number | null; estado: EstadoCurso; ultima_sesion: string | null;
}

export const fechaCorta = (f: string | null) =>
  (f ? new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Nunca');

const ESTADOS: Record<EstadoCurso, { tone: 'green' | 'blue' | 'slate' | 'red' | 'amber'; label: string }> = {
  en_progreso: { tone: 'green', label: 'Al día' },
  inactivo: { tone: 'amber', label: 'Inactivo' },
  en_riesgo: { tone: 'red', label: 'Necesita atención' },
  sin_ingresar: { tone: 'slate', label: 'Aún no ingresó' },
};
export const ETIQUETA_ESTADO = (e: EstadoCurso) => ESTADOS[e].label;

export function EstadoChip({ estado }: { estado: EstadoCurso }) {
  const { tone, label } = ESTADOS[estado] ?? ESTADOS.en_progreso;
  return <Badge tone={tone}>{label}</Badge>;
}

export function NivelChip({ nivel }: { nivel: NivelDificultad }) {
  const color = NIVEL_COLOR[nivel];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ color, backgroundColor: `${color}26` }}>
      {NIVEL_LABEL[nivel]}
    </span>
  );
}

/** Promedio sobre 100, coloreado según su distancia al umbral de 80. */
export function PromedioChip({ promedio, grande = false }: { promedio: number | null; grande?: boolean }) {
  if (promedio === null) return <span className={`text-muted ${grande ? 'text-sm' : 'text-xs'}`}>Sin evaluaciones</span>;
  const clase = promedio >= 80 ? 'text-prexi-green' : promedio >= 70 ? 'text-prexi-amber' : 'text-prexi-red';
  return (
    <span className={`font-display font-bold ${clase} ${grande ? 'text-2xl' : 'text-sm'}`}>
      {promedio}<span className={`font-normal text-muted ${grande ? 'text-sm' : 'text-xs'}`}>/100</span>
    </span>
  );
}

/** Lista nominal: cada estudiante con su CI, RU y paralelo; al hacer clic se abre su ficha. */
export function ListaNominal({ estudiantes, vacio = 'Ningún estudiante en este grupo.' }: { estudiantes: Nominal[]; vacio?: string }) {
  if (estudiantes.length === 0) return <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-muted">{vacio}</p>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {estudiantes.map((e) => (
        <li key={e.id}>
          <Link href={`/docente/estudiantes/${e.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 transition hover:bg-subtle">
            <span className="min-w-0 flex-1 truncate font-medium text-fg">{e.nombre}</span>
            <span className="text-xs text-muted">CI {e.ci ?? '—'} · RU {e.ru ?? '—'} · Par. {e.paralelo}</span>
            <PromedioChip promedio={e.promedio} />
            <EstadoChip estado={e.estado} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
