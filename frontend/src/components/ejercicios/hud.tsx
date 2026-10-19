'use client';

import { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Flame, Target, X } from '@/components/icons';
import { ProgresoNivel } from '@/lib/types';

/**
 * CABECERA DEL EJERCICIO (HUD). Tres cosas que el estudiante quiere saber sin
 * buscarlas:
 *   1. Dónde va: un segmento por ejercicio del tema; verde lo resuelto, azul el
 *      actual (late suave), gris lo que falta. Ver cómo se pinta de verde es
 *      el «gancho» de seguir.
 *   2. Su combo 🔥: aciertos seguidos en este tema (racha de sesión).
 *   3. Su meta: cuántos le faltan en su nivel para la evaluación de subida.
 */
export function HudEjercicio({ ids, actualId, resueltos, combo, meta, onSalir, derecha }: {
  ids: number[];
  actualId: number;
  /** Ids resueltos (incluye el actual si acaba de acertarse). */
  resueltos: Set<number>;
  combo: number;
  meta: (ProgresoNivel & { resueltosAhora: number }) | null;
  onSalir: () => void;
  derecha?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const idx = Math.max(0, ids.indexOf(actualId));
  const total = Math.max(1, ids.length);
  const hechos = ids.filter((x) => resueltos.has(x)).length;
  const faltanMeta = meta ? Math.max(0, meta.minimo - meta.resueltosAhora) : null;
  const pctMeta = meta ? Math.min(100, Math.round((meta.resueltosAhora / Math.max(1, meta.minimo)) * 100)) : 0;

  return (
    <div className="mb-5 rounded-2xl border border-line bg-card px-4 py-3.5 shadow-soft sm:px-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <button onClick={onSalir} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-subtle hover:text-fg" title="Salir" aria-label="Salir de la práctica">
          <X className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-bold text-fg">Ejercicio {idx + 1} de {total}</span>
            <span className="text-xs font-medium text-muted">{hechos} resuelto{hechos === 1 ? '' : 's'} en este tema</span>
          </div>
          {total <= 30 ? (
            <div className="flex gap-1" role="progressbar" aria-valuenow={hechos} aria-valuemin={0} aria-valuemax={total} aria-label="Ejercicios resueltos del tema">
              {ids.map((x, i) => {
                const hecho = resueltos.has(x);
                const actual = i === idx;
                return (
                  <div key={x} className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-subtle">
                    <motion.div
                      className={`h-full rounded-full ${hecho ? 'bg-gradient-to-r from-prexi-green to-emerald-400' : 'bg-gradient-to-r from-prexi-blue to-blue-400'}`}
                      initial={false}
                      animate={{ width: hecho || actual ? '100%' : '0%', opacity: actual && !hecho ? [0.55, 1, 0.55] : 1 }}
                      transition={actual && !hecho && !reduce ? { width: { duration: 0.4 }, opacity: { duration: 1.6, repeat: Infinity } } : { duration: 0.45, ease: 'easeOut' }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-subtle">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-prexi-green to-emerald-400" initial={false} animate={{ width: `${Math.round((hechos / total) * 100)}%` }} />
            </div>
          )}
        </div>

        {/* Combo: aparece desde 2 seguidas y «salta» cada vez que crece. */}
        <AnimatePresence>
          {combo >= 2 && (
            <motion.div key="combo" initial={reduce ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
              className="flex shrink-0 items-center gap-1 rounded-xl bg-orange-500/10 px-2.5 py-1.5 text-orange-600 dark:text-orange-300" title={`${combo} aciertos seguidos en este tema`}>
              <motion.span key={combo} initial={reduce ? false : { scale: 1.8, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
                <Flame className="h-5 w-5" />
              </motion.span>
              <span className="font-display text-lg font-extrabold">{combo}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {derecha && <div className="hidden shrink-0 sm:block">{derecha}</div>}
      </div>

      {/* Meta del nivel: lo que abre la evaluación para subir de nivel. */}
      {meta && (
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <Target className={`h-4 w-4 shrink-0 ${faltanMeta === 0 ? 'text-prexi-green' : 'text-prexi-blue-deep'}`} />
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
            <motion.div className={`h-full rounded-full ${faltanMeta === 0 ? 'bg-prexi-green' : 'bg-prexi-blue'}`} initial={false} animate={{ width: `${pctMeta}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
          </div>
          <span className="shrink-0 text-xs font-semibold text-fg">
            Meta {meta.nivel_label}: {Math.min(meta.resueltosAhora, meta.minimo)}/{meta.minimo}
            <span className="hidden font-medium text-muted sm:inline">
              {faltanMeta === 0 ? ' · ¡ya puedes subir de nivel!' : ` · faltan ${faltanMeta}`}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
