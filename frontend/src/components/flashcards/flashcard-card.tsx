'use client';

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CodigoResaltado } from '@/components/ejercicios/highlight';
import { NIVEL_LABEL, NIVEL_COLOR } from '@/lib/types';
import { RotateCcw } from '@/components/icons';
import type { Flashcard } from '@/lib/flashcards';

/**
 * Tarjeta con VOLTEO 3D real (perspective + preserve-3d + backface-hidden),
 * envuelto en Framer Motion para el spring. Con `prefers-reduced-motion` el flip
 * se sustituye por un cross-fade. Accesible: role="button" + aria-pressed, el
 * reverso se anuncia al voltear, operable por teclado (Espacio/Enter).
 *
 * Acento por unidad (`color`). El código Python se muestra con resaltado.
 */
export function FlashcardCard({ card, color, flipped, onFlip }: {
  card: Flashcard; color: string; flipped: boolean; onFlip: () => void;
}) {
  const reduce = useReducedMotion();

  const commonBtn = {
    role: 'button' as const,
    'aria-pressed': flipped,
    'aria-label': flipped ? `Respuesta: ${card.reverso}. Pulsa para volver a la pregunta.` : `Pregunta: ${card.frente}. Pulsa para ver la respuesta.`,
    tabIndex: 0,
    onClick: onFlip,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onFlip(); } },
  };

  // Cross-fade accesible (sin 3D) cuando se reduce el movimiento.
  if (reduce) {
    return (
      <div {...commonBtn} className="relative min-h-[20rem] w-full cursor-pointer overflow-hidden rounded-2xl border border-line bg-card shadow-lift outline-none focus-visible:ring-2 focus-visible:ring-prexi-blue" style={flipped ? caraReverso() : caraFrente(color)}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={flipped ? 'r' : 'f'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="p-6">
            {flipped ? <Reverso card={card} color={color} /> : <Frente card={card} color={color} />}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div {...commonBtn} className="relative min-h-[20rem] w-full cursor-pointer outline-none [perspective:1400px] focus-visible:[&>*]:ring-2 focus-visible:[&>*]:ring-prexi-blue">
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        style={{ minHeight: '20rem' }}
      >
        {/* Frente */}
        <div aria-hidden={flipped} className="absolute inset-0 overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-lift [backface-visibility:hidden]" style={caraFrente(color)}>
          <Marca texto="?" color={color} />
          <Frente card={card} color={color} />
        </div>
        {/* Reverso (girado 180°) */}
        <div aria-hidden={!flipped} className="absolute inset-0 overflow-hidden rounded-2xl border border-line bg-card p-6 shadow-lift [backface-visibility:hidden] [transform:rotateY(180deg)]" style={caraReverso()}>
          <Marca texto="OK" color={VERDE} />
          <Reverso card={card} color={color} />
        </div>
      </motion.div>
    </div>
  );
}

const VERDE = '#10B981';

/** Frente con el color de la unidad y reverso en verde: se distingue de un vistazo qué cara es. */
const caraFrente = (color: string): React.CSSProperties => ({ borderTop: `5px solid ${color}`, backgroundImage: `linear-gradient(155deg, ${color}2E 0%, ${color}0D 38%, transparent 70%)` });
const caraReverso = (): React.CSSProperties => ({ borderTop: `5px solid ${VERDE}`, backgroundImage: `linear-gradient(155deg, ${VERDE}2E 0%, ${VERDE}0D 38%, transparent 70%)` });

/** Signo grande de fondo, puramente decorativo. */
function Marca({ texto, color }: { texto: string; color: string }) {
  return <span aria-hidden className="pointer-events-none absolute -bottom-8 -right-1 select-none font-display text-[9rem] font-black leading-none" style={{ color, opacity: 0.09 }}>{texto}</span>;
}

function NivelChip({ card, color }: { card: Flashcard; color: string }) {
  if (!card.nivel) return null;
  const c = NIVEL_COLOR[card.nivel];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide" style={{ color: c, backgroundColor: `${c}22` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} /> {NIVEL_LABEL[card.nivel]}
    </span>
  );
}

function Frente({ card, color }: { card: Flashcard; color: string }) {
  return (
    <div className="relative flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-2xs font-bold uppercase tracking-wide" style={{ color }}>Pregunta</span>
        <NivelChip card={card} color={color} />
      </div>
      <p className="font-display text-lg font-bold leading-snug text-fg sm:text-xl">{card.frente}</p>
      {card.codigo && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#0E3F7E] bg-[#04162E] p-3.5">
          <CodigoResaltado code={card.codigo} />
        </div>
      )}
      <p className="mt-auto flex items-center justify-center gap-1.5 pt-4 text-xs text-muted">
        <RotateCcw className="h-3.5 w-3.5" /> Toca para voltear
      </p>
    </div>
  );
}

function Reverso({ card, color }: { card: Flashcard; color: string }) {
  return (
    <div className="relative flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-2xs font-bold uppercase tracking-wide text-prexi-green">Respuesta</span>
        <NivelChip card={card} color={color} />
      </div>
      <p className="font-display text-lg font-extrabold leading-snug text-fg sm:text-xl">{card.reverso}</p>
      {card.codigo && (
        <div className="mt-3 overflow-hidden rounded-xl border border-[#0E3F7E] bg-[#04162E] p-3.5">
          <CodigoResaltado code={card.codigo} />
        </div>
      )}
      {card.explicacion && (
        <p className="mt-3 rounded-xl bg-subtle p-3 text-sm leading-relaxed text-muted">{card.explicacion}</p>
      )}
    </div>
  );
}
