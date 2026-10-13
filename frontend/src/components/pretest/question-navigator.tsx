'use client';

import { Check } from '@/components/icons';

/**
 * Navegador de preguntas: cuadrícula 1..N con tres estados (actual / respondida /
 * sin responder), leyenda y contador "X / N respondidas". Cada celda salta a esa
 * pregunta. No revela dificultad ni nivel (instrumento de medición uniforme).
 */
export function QuestionNavigator({ total, current, answered, onJump }: {
  total: number;
  current: number;
  /** Set de índices (0-based) ya respondidos. */
  answered: Set<number>;
  onJump: (index: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted">
        <b className="tabular-nums text-fg">{answered.size} / {total}</b> respondidas
      </p>
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-6">
        {Array.from({ length: total }, (_, i) => {
          const esActual = i === current;
          const ok = answered.has(i);
          const clase = esActual
            ? 'bg-prexi-blue text-accent-on border-prexi-blue'
            : ok
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'border-line bg-app/60 text-muted hover:border-prexi-blue/50 hover:text-fg';
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              aria-label={`Ir a la pregunta ${i + 1}${ok ? ' (respondida)' : ''}${esActual ? ' (actual)' : ''}`}
              aria-current={esActual ? 'true' : undefined}
              className={`relative grid aspect-square place-items-center rounded-md border text-2xs font-bold tabular-nums transition ${clase}`}
            >
              {ok && !esActual ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </button>
          );
        })}
      </div>
      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-2xs font-medium text-muted">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-prexi-blue" /> Actual</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Respondida</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border border-line bg-app" /> Sin responder</span>
      </div>
    </div>
  );
}
