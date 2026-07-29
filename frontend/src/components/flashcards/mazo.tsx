'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo,
} from 'framer-motion';
import confetti from 'canvas-confetti';
import { FlashcardCard } from './flashcard-card';
import { useSound } from '@/components/use-sound';
import { claveMazo, type Flashcard } from '@/lib/flashcards';
import { NIVEL_COLOR, NIVEL_LABEL, type NivelDificultad } from '@/lib/types';
import { CheckCircle, RotateCcw, ChevronLeft, ChevronRight, ArrowLeft, Sparkles, X } from '@/components/icons';

/**
 * MAZO de flashcards: pila apilada, swipe (Framer `drag`) + flechas/teclado,
 * contador de progreso, marca Dominadas / Para repasar y pantalla resumen.
 * Persiste el progreso del mazo COMPLETO en localStorage (retomar donde quedó).
 * Repaso libre: no puntúa, no cronometra, no toca IRT (ver lib/flashcards).
 */
type Marca = 'dominada' | 'repasar';

export function Mazo({ cards, color, titulo, scope, onSalir, nivelSesion }: {
  cards: Flashcard[]; color: string; titulo: string; scope: string; onSalir: () => void;
  /** Nivel de la sesión actual (junto al progreso): "Básico" | "Tu nivel" | … */
  nivelSesion?: { label: string; color: string };
}) {
  const reduce = useReducedMotion();
  const { playFlip, playCorrect, playNeutral, playFinish } = useSound();
  const key = claveMazo(scope);

  // Sub-mazo activo (por defecto el completo; "repasar marcadas" lo filtra).
  const [deck, setDeck] = useState<Flashcard[]>(cards);
  const [esSub, setEsSub] = useState(false);
  const [idx, setIdx] = useState(0);
  const [dominadas, setDominadas] = useState<Set<string>>(new Set());
  const [repasar, setRepasar] = useState<Set<string>>(new Set());
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState(0);

  // Retoma el progreso persistido del mazo completo (solo en cliente).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const s = JSON.parse(raw) as { idx: number; dominadas: string[]; repasar: string[] };
      if (Array.isArray(s.dominadas)) setDominadas(new Set(s.dominadas));
      if (Array.isArray(s.repasar)) setRepasar(new Set(s.repasar));
      if (typeof s.idx === 'number') setIdx(Math.min(Math.max(0, s.idx), cards.length));
    } catch { /* progreso corrupto → empezar de cero */ }
  }, [key, cards.length]);

  // Persiste el progreso del mazo COMPLETO (no el sub-mazo transitorio).
  useEffect(() => {
    if (typeof window === 'undefined' || esSub) return;
    try { localStorage.setItem(key, JSON.stringify({ idx, dominadas: [...dominadas], repasar: [...repasar] })); } catch { /* sin espacio */ }
  }, [key, idx, dominadas, repasar, esSub]);

  const total = deck.length;
  const actual = deck[idx];
  const terminado = idx >= total;

  // Logro corto + confeti sutil (opcional) al terminar el mazo.
  useEffect(() => {
    if (!terminado || total === 0) return;
    playFinish();
    if (!reduce) confetti({ particleCount: 60, spread: 60, startVelocity: 28, scalar: 0.8, origin: { y: 0.4 }, colors: ['#22C55E', '#3B82F6', '#F59E0B'] });
  }, [terminado, total, reduce, playFinish]);

  const marcar = (tipo: Marca) => {
    if (!actual) return;
    setDir(tipo === 'dominada' ? 1 : -1);
    setDominadas((p) => { const n = new Set(p); tipo === 'dominada' ? n.add(actual.id) : n.delete(actual.id); return n; });
    setRepasar((p) => { const n = new Set(p); tipo === 'repasar' ? n.add(actual.id) : n.delete(actual.id); return n; });
    setFlipped(false);
    setIdx((i) => i + 1);
    // Matices: "Ya la sé" suena positivo; "Repasar" suena neutro (nunca de error).
    if (tipo === 'dominada') playCorrect(); else playNeutral();
  };

  const empezarSub = (subset: Flashcard[]) => { setDeck(subset); setEsSub(true); setIdx(0); setDominadas(new Set()); setRepasar(new Set()); setFlipped(false); };
  const reiniciar = () => { setDeck(cards); setEsSub(false); setIdx(0); setDominadas(new Set()); setRepasar(new Set()); setFlipped(false); if (typeof window !== 'undefined') try { localStorage.removeItem(key); } catch { /* */ } };

  // Teclado global del mazo: ←/→ para marcar, Espacio/Enter para voltear.
  useEffect(() => {
    if (terminado) return;
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); marcar('dominada'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); marcar('repasar'); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); playFlip(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (total === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card px-4 py-16 text-center">
        <Sparkles className="mb-3 h-10 w-10 text-muted" />
        <h2 className="font-display text-lg font-bold text-fg">Aún no hay flashcards de tu nivel aquí</h2>
        <p className="mt-1 max-w-sm text-sm text-muted">El mazo solo muestra tarjetas de TU nivel actual en el tema (sin mezclar niveles). Cuando haya contenido de tu nivel, aparecerá aquí.</p>
        <button onClick={onSalir} className="btn-primary mt-5"><ArrowLeft className="h-4 w-4" /> Volver</button>
      </div>
    );
  }

  if (terminado) {
    return <Resumen color={color} deck={deck} dominadas={dominadas} repasar={repasar}
      onRepasarMarcadas={repasar.size > 0 ? () => empezarSub(deck.filter((c) => repasar.has(c.id))) : undefined}
      onReiniciar={reiniciar} onSalir={onSalir} />;
  }

  return (
    // data-sonido-off: voltear/marcar tienen sus PROPIOS sonidos (flip/positivo/neutro).
    <div className="mx-auto max-w-md" data-sonido-off>
      {/* Cabecera + progreso + nivel de la sesión */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-fg">{titulo}</p>
        <span className="flex shrink-0 items-center gap-1.5">
          {nivelSesion && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: nivelSesion.color, backgroundColor: `${nivelSesion.color}22` }}>
              {nivelSesion.label}
            </span>
          )}
          <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-bold text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.min(idx + 1, total)} / {total}</span>
        </span>
      </div>
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={false} animate={{ width: `${(idx / total) * 100}%` }} transition={{ duration: 0.3 }} />
      </div>

      {/* Pila de tarjetas */}
      <div className="relative mx-auto h-[22rem]">
        {deck.slice(idx + 1, idx + 3).map((c, i) => (
          <div key={c.id} aria-hidden className="absolute inset-x-0 top-0 h-full rounded-2xl border border-line bg-card opacity-60 shadow-soft"
            style={{ transform: `scale(${1 - (i + 1) * 0.045}) translateY(${(i + 1) * 12}px)`, borderTop: `4px solid ${color}`, zIndex: -i - 1 }} />
        ))}
        <AnimatePresence custom={dir} initial={false}>
          {actual && (
            <Arrastrable key={actual.id} dir={dir} reduce={!!reduce} onMarcar={marcar}>
              <FlashcardCard card={actual} color={color} flipped={flipped} onFlip={() => { setFlipped((f) => !f); playFlip(); }} />
            </Arrastrable>
          )}
        </AnimatePresence>
      </div>

      {/* Controles accesibles (equivalentes al swipe) */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button onClick={() => marcar('repasar')} className="inline-flex items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/20 dark:text-amber-300">
          <ChevronLeft className="h-4 w-4" /> Repasar
        </button>
        <button onClick={() => { setFlipped((f) => !f); playFlip(); }} aria-label="Voltear tarjeta" className="grid h-11 w-11 place-items-center rounded-full border border-line bg-card text-muted shadow-soft transition hover:bg-subtle hover:text-fg">
          <RotateCcw className="h-5 w-5" />
        </button>
        <button onClick={() => marcar('dominada')} className="inline-flex items-center gap-2 rounded-xl border border-[#22C55E]/60 bg-[#22C55E]/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-[#22C55E]/20 dark:text-emerald-300">
          Ya la sé <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted">Arrastra la tarjeta (o usa ←/→); Espacio para voltear. Este repaso no puntúa.</p>
    </div>
  );
}

/** Tarjeta superior arrastrable: x propio (se reinicia por tarjeta), rotación y
 *  pistas de "Ya la sé / Repasar" según el arrastre; sale volando al marcar. */
function Arrastrable({ dir, reduce, onMarcar, children }: {
  dir: number; reduce: boolean; onMarcar: (t: Marca) => void; children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-11, 11]);
  const okOpacity = useTransform(x, [30, 140], [0, 1]);
  const repOpacity = useTransform(x, [-140, -30], [1, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110) onMarcar('dominada');
    else if (info.offset.x < -110) onMarcar('repasar');
  };

  // `exit` como función necesita el API de variants (+ `custom` para la dirección).
  const variantes = {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: (d: number) => (reduce ? { opacity: 0, transition: { duration: 0.15 } } : { x: d * 620, opacity: 0, rotate: d * 14, transition: { duration: 0.3 } }),
  };

  return (
    <motion.div
      className="absolute inset-x-0 top-0"
      style={reduce ? undefined : { x, rotate }}
      drag={reduce ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={onDragEnd}
      custom={dir}
      variants={variantes}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {!reduce && (
        <>
          <motion.span style={{ opacity: okOpacity }} className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg border-2 border-[#22C55E] px-2.5 py-1 text-xs font-extrabold uppercase text-[#22C55E]">Ya la sé</motion.span>
          <motion.span style={{ opacity: repOpacity }} className="pointer-events-none absolute right-4 top-4 z-10 rounded-lg border-2 border-amber-400 px-2.5 py-1 text-xs font-extrabold uppercase text-amber-500">Repasar</motion.span>
        </>
      )}
      {children}
    </motion.div>
  );
}

/** Pantalla resumen del mazo, con DESGLOSE POR NIVEL: el estudiante ve en qué
 *  nivel de conocimiento está más flojo. Repaso libre: no puntúa ni cambia θ. */
function Resumen({ color, deck, dominadas, repasar, onRepasarMarcadas, onReiniciar, onSalir }: {
  color: string; deck: Flashcard[]; dominadas: Set<string>; repasar: Set<string>;
  onRepasarMarcadas?: () => void; onReiniciar: () => void; onSalir: () => void;
}) {
  const total = deck.length;
  const niveles: NivelDificultad[] = ['basico', 'intermedio', 'avanzado'];
  const porNivel = niveles
    .map((n) => {
      const delNivel = deck.filter((c) => c.nivel === n);
      return {
        nivel: n,
        total: delNivel.length,
        dominadas: delNivel.filter((c) => dominadas.has(c.id)).length,
        repasar: delNivel.filter((c) => repasar.has(c.id)).length,
      };
    })
    .filter((x) => x.total > 0);

  return (
    <div className="mx-auto max-w-md animate-fade-up rounded-2xl border border-line bg-card p-6 text-center shadow-lift" style={{ borderTop: `4px solid ${color}` }}>
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full" style={{ backgroundColor: `${color}22`, color }}><CheckCircle className="h-7 w-7" /></div>
      <h2 className="font-display text-xl font-extrabold text-fg">¡Terminaste el mazo!</h2>
      <p className="mt-1 text-sm text-muted">Repasaste {total} {total === 1 ? 'tarjeta' : 'tarjetas'}. Recuerda: esto no afecta tu nota ni tu nivel.</p>

      <div className="my-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#22C55E]/10 p-4">
          <p className="font-display text-2xl font-extrabold text-emerald-700 dark:text-emerald-300" style={{ fontVariantNumeric: 'tabular-nums' }}>{dominadas.size}</p>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Dominadas</p>
        </div>
        <div className="rounded-xl bg-amber-500/10 p-4">
          <p className="font-display text-2xl font-extrabold text-amber-700 dark:text-amber-300" style={{ fontVariantNumeric: 'tabular-nums' }}>{repasar.size}</p>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Para repasar</p>
        </div>
      </div>

      {/* Desglose por nivel (solo si el mazo mezcla o tiene niveles con tarjetas) */}
      {porNivel.length > 0 && (
        <div className="mb-5 space-y-1.5 text-left">
          {porNivel.map(({ nivel, total: t, dominadas: d, repasar: rp }) => (
            <div key={nivel} className="flex items-center justify-between gap-3 rounded-lg bg-subtle px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wide" style={{ color: NIVEL_COLOR[nivel] }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NIVEL_COLOR[nivel] }} /> {NIVEL_LABEL[nivel]}
              </span>
              <span className="text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <b className="text-emerald-700 dark:text-emerald-300">{d}</b> dominadas · <b className="text-amber-700 dark:text-amber-300">{rp}</b> por repasar · {t} en total
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {onRepasarMarcadas && (
          <button onClick={onRepasarMarcadas} className="btn-primary w-full"><RotateCcw className="h-4 w-4" /> Repasar solo las marcadas ({repasar.size})</button>
        )}
        <div className="flex gap-2">
          <button onClick={onReiniciar} className="btn-ghost flex-1"><RotateCcw className="h-4 w-4" /> Reiniciar mazo</button>
          <button onClick={onSalir} className="btn-ghost flex-1"><X className="h-4 w-4" /> Volver</button>
        </div>
      </div>
    </div>
  );
}
