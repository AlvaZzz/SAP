'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Cabecera de progreso del pretest: "Pregunta X de N" + "% completado" y una
 * barra rellena según respondidas/total (gradiente de acento, animada).
 */
export function ProgressHeader({ index, total, answered }: { index: number; total: number; answered: number }) {
  const reduce = useReducedMotion();
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
        <span className="tabular-nums">Pregunta {index + 1} de {total}</span>
        <span className="tabular-nums">{pct}% completado</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-prexi-blue to-blue-400"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
