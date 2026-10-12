'use client';

import { TemaDocente } from '@/lib/types';
import { CheckCircle } from '@/components/icons';

export interface TemaPlano { tema: TemaDocente; esSubtema: boolean }

/** Temas y subtemas de la unidad en una sola lista, en orden. */
export function aplanar(temas: TemaDocente[]): TemaPlano[] {
  return temas.flatMap((t) => [{ tema: t, esSubtema: false }, ...t.subtemas.map((s) => ({ tema: s, esSubtema: true }))]);
}

/**
 * Lista de temas para elegir en cuál se trabaja. Cada uno muestra cuánto lleva
 * (`avance`) y un visto cuando ya cumplió la meta del paso.
 */
export function SelectorTema({ temas, seleccionado, onSeleccionar, avance }: {
  temas: TemaPlano[]; seleccionado: number | null; onSeleccionar: (id: number) => void;
  avance: (t: TemaDocente) => { texto: string; listo: boolean };
}) {
  return (
    <nav aria-label="Temas de la unidad" className="rounded-2xl border border-line bg-card p-2">
      <p className="px-2 pb-1.5 pt-1 text-xs font-bold uppercase tracking-wide text-muted">Elige un tema</p>
      <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
        {temas.map(({ tema, esSubtema }) => {
          const a = avance(tema);
          const activo = tema.id === seleccionado;
          return (
            <li key={tema.id}>
              <button onClick={() => onSeleccionar(tema.id)} aria-current={activo ? 'true' : undefined}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${esSubtema ? 'ml-3 w-[calc(100%-0.75rem)]' : ''} ${activo ? 'bg-prexi-blue/10 ring-1 ring-prexi-blue' : 'hover:bg-subtle'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{tema.numero} {tema.titulo}</span>
                  <span className={`block text-xs font-medium ${a.listo ? 'text-prexi-green' : 'text-prexi-amber'}`}>{a.texto}</span>
                </span>
                {a.listo && <CheckCircle className="h-4 w-4 shrink-0 text-prexi-green" />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
