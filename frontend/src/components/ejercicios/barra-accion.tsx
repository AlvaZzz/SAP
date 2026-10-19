'use client';

import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp } from '@/components/count-up';
import { ArrowRight, CheckCircle, Lightbulb, Zap, Flame } from '@/components/icons';

/**
 * BARRA DE ACCIÓN DEL EJERCICIO — fija abajo, como en las apps de práctica.
 *
 * Por qué: antes el resultado aparecía DENTRO de la tarjeta y el botón
 * «Siguiente» quedaba al final, así que en un ejercicio largo (o en el celular)
 * había que bajar a buscarlo. Aquí el botón principal está siempre en el mismo
 * sitio y la respuesta del sistema se ve sin moverse:
 *   · antes de responder: «Comprobar» (Enter);
 *   · al acertar: verde, frase que sube de tono con el combo, +XP que cuenta y
 *     cuánto falta para la meta del nivel;
 *   · al fallar: ámbar (nunca rojo agresivo), la explicación y la ayuda de PREXI.
 *
 * Es SOLO presentación: el XP, la corrección y la racha de días los calcula el
 * servidor; el combo es la racha de sesión que ya existía (no da XP extra).
 */

export type EstadoBarra = 'pendiente' | 'correcto' | 'incorrecto';

/** Frase de acierto según el combo (aciertos seguidos en este tema). Varía por ejercicio para no repetirse. */
export function fraseAcierto(combo: number, semilla: number): string {
  if (combo >= 10) return '¡Leyenda! 10 seguidas';
  if (combo >= 5) return `¡Imparable! ${combo} seguidas`;
  if (combo >= 3) return `¡En racha! ${combo} seguidas`;
  if (combo === 2) return '¡Dos seguidas!';
  const base = ['¡Correcto!', '¡Bien hecho!', '¡Exacto!', '¡Eso es!', '¡Muy bien!'];
  return base[Math.abs(semilla) % base.length];
}

/** Frase al fallar: amable, que invite a mirar la explicación. */
export function fraseFallo(semilla: number): string {
  const base = ['Casi. Mira por qué', 'No esta vez. Así se piensa', 'Buen intento. Revisa esto', 'Equivocarse también enseña'];
  return base[Math.abs(semilla) % base.length];
}

export function BarraAccion({
  estado, puedeComprobar, enviando, onComprobar, onContinuar, textoContinuar,
  xp, combo, titulo, meta, detalle, ayudaTeclado = true,
}: {
  estado: EstadoBarra;
  puedeComprobar: boolean;
  enviando: boolean;
  onComprobar: () => void;
  onContinuar: () => void;
  textoContinuar: string;
  /** XP ganado (solo al acertar). */
  xp?: number;
  /** Aciertos seguidos en este tema (racha de sesión). */
  combo?: number;
  titulo?: string;
  /** Línea de progreso hacia la meta del nivel. */
  meta?: ReactNode;
  /** Explicación (al fallar) u otro contenido bajo el título. */
  detalle?: ReactNode;
  ayudaTeclado?: boolean;
}) {
  const reduce = useReducedMotion();
  const tono = estado === 'correcto'
    ? 'border-prexi-green/50 bg-emerald-50 dark:bg-emerald-950/60'
    : estado === 'incorrecto'
      ? 'border-prexi-amber/50 bg-amber-50 dark:bg-amber-950/50'
      : 'border-line bg-card/95';

  return (
    <div className="sticky bottom-3 z-20 mt-5">
      <motion.div
        layout={!reduce}
        className={`overflow-hidden rounded-2xl border-2 shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.25)] backdrop-blur ${tono}`}
        role={estado === 'pendiente' ? undefined : 'status'}
        aria-live="polite"
      >
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-center ${estado === 'pendiente' ? 'p-2.5 sm:p-4' : 'p-4'}`}>
          <div className="min-w-0 flex-1">
              {estado === 'pendiente' ? (
                <motion.p key="pendiente" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                  className="hidden text-sm text-muted sm:block">
                  {puedeComprobar ? '¿Lista tu respuesta? Compruébala.' : 'Elige o escribe tu respuesta para comprobarla.'}
                  {ayudaTeclado && <span className="ml-2 hidden text-xs lg:inline">Atajo: <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-2xs">Enter</kbd></span>}
                </motion.p>
              ) : (
                <motion.div key={estado} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}>
                  <div className="flex items-start gap-3">
                    <motion.span
                      initial={reduce ? false : { scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white ${estado === 'correcto' ? 'bg-prexi-green' : 'bg-prexi-amber'}`}>
                      {estado === 'correcto' ? <CheckCircle className="h-6 w-6" /> : <Lightbulb className="h-6 w-6" />}
                    </motion.span>
                    <div className="min-w-0 flex-1">
                      <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-lg font-extrabold ${estado === 'correcto' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                        <span>{titulo}</span>
                        {estado === 'correcto' && xp != null && xp > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-prexi-amber/15 px-2.5 py-0.5 text-sm text-amber-700 dark:text-amber-300">
                            <Zap className="h-4 w-4" /> +<CountUp value={xp} duration={700} /> XP
                          </span>
                        )}
                        {estado === 'correcto' && combo != null && combo >= 2 && (
                          <motion.span key={combo} initial={reduce ? false : { scale: 1.6 }} animate={{ scale: 1 }}
                            className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-sm text-orange-600 dark:text-orange-300">
                            <Flame className="h-4 w-4" /> x{combo}
                          </motion.span>
                        )}
                      </p>
                      {detalle && <div className="mt-1 text-sm text-fg">{detalle}</div>}
                      {meta && <div className="mt-1.5 text-xs font-semibold text-muted">{meta}</div>}
                    </div>
                  </div>
                </motion.div>
              )}
          </div>

          {estado === 'pendiente' ? (
            <button onClick={onComprobar} disabled={!puedeComprobar || enviando}
              className="btn-primary w-full justify-center !py-3 text-base disabled:opacity-50 sm:w-auto sm:min-w-[170px]">
              {enviando ? 'Comprobando…' : 'Comprobar'}
            </button>
          ) : (
            <motion.button
              initial={reduce ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.12 }}
              onClick={onContinuar} autoFocus
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-bold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 sm:w-auto sm:min-w-[170px] ${
                estado === 'correcto' ? 'bg-prexi-green focus-visible:ring-prexi-green/40' : 'bg-prexi-amber focus-visible:ring-prexi-amber/40'}`}>
              {textoContinuar} <ArrowRight className="h-5 w-5" />
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
