'use client';

import { useRef, useState, KeyboardEvent, PointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CodeViewer } from '@/components/code-viewer';
import { useSound } from '@/components/use-sound';
import { CheckCircle, AlertCircle } from '@/components/icons';
import type { ExerciseProps } from './index';

/**
 * TIPO 1 — Opción múltiple con MANIPULACIÓN DIRECTA. Tarjetas grandes "elige":
 * hover elevado (escala + sombra), selección con RIPPLE que crece desde el punto
 * tocado y badge de letra que se rellena. Al comprobar: la correcta hace un pulso
 * verde; la elegida incorrecta un shake ÁMBAR (nunca rojo agresivo); las demás se
 * atenúan. El confeti del acierto lo dispara el reproductor.
 * Accesible: role="radiogroup"/"radio", A–D y flechas, foco visible.
 */
type Onda = { id: number; x: number; y: number };

export function MultipleChoice({ ejercicio, resultado, onChange }: ExerciseProps) {
  const [sel, setSel] = useState<string | null>(null);
  const [ondas, setOndas] = useState<Record<string, Onda[]>>({});
  const { playClick } = useSound();
  const reduce = useReducedMotion();
  const enviado = !!resultado;
  const correcta = (resultado?.respuesta_correcta ?? '').trim().toUpperCase();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const ripple = (id: string, e: PointerEvent<HTMLButtonElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const onda = { id: Date.now(), x: e.clientX - r.left, y: e.clientY - r.top };
    setOndas((o) => ({ ...o, [id]: [...(o[id] ?? []), onda] }));
    setTimeout(() => setOndas((o) => ({ ...o, [id]: (o[id] ?? []).filter((w) => w.id !== onda.id) })), 620);
  };

  const elegir = (id: string) => {
    if (enviado) return;
    setSel(id); onChange(id); playClick();
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (enviado) return;
    const ids = ejercicio.opciones.map((o) => o.id);
    const i = sel ? ids.indexOf(sel) : -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault(); const n = ids[(i + 1 + ids.length) % ids.length]; elegir(n); refs.current[ids.indexOf(n)]?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault(); const n = ids[(i - 1 + ids.length) % ids.length]; elegir(n); refs.current[ids.indexOf(n)]?.focus();
    } else {
      const idx = ids.findIndex((x) => x.toUpperCase() === e.key.toUpperCase());
      if (idx >= 0) { e.preventDefault(); elegir(ids[idx]); refs.current[idx]?.focus(); }
    }
  };

  return (
    <div>
      {ejercicio.codigoPython && <div className="mb-5"><CodeViewer code={ejercicio.codigoPython} /></div>}

      {/* data-sonido-off: estas opciones ya reproducen su propio click. */}
      <div role="radiogroup" aria-label="Opciones de respuesta" data-sonido-off onKeyDown={onKey} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {ejercicio.opciones.map((o, i) => {
          const idU = o.id.trim().toUpperCase();
          const elegido = sel === o.id;
          const esCorrecta = enviado && idU === correcta;
          const malaElegida = enviado && elegido && idU !== correcta;
          const atenuada = enviado && !esCorrecta && !malaElegida;

          const estilo = esCorrecta
            ? 'border-[#22C55E] bg-[#22C55E]/10'
            : malaElegida
              ? 'border-amber-400/80 bg-amber-500/10'
              : elegido
                ? 'border-prexi-blue bg-prexi-blue/10 ring-2 ring-prexi-blue/25'
                : 'border-line';

          // Micro-animaciones al comprobar: pulso verde / shake ámbar.
          const animar = reduce ? undefined
            : esCorrecta ? { boxShadow: ['0 0 0 0px rgba(34,197,94,0)', '0 0 0 6px rgba(34,197,94,0.28)', '0 0 0 0px rgba(34,197,94,0)'] }
            : malaElegida ? { x: [0, -6, 6, -4, 4, -2, 0] }
            : undefined;

          return (
            <motion.button
              key={o.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={elegido}
              tabIndex={enviado ? -1 : elegido || (!sel && i === 0) ? 0 : -1}
              disabled={enviado}
              onPointerDown={(e) => ripple(o.id, e)}
              onClick={() => elegir(o.id)}
              whileHover={reduce || enviado ? undefined : { scale: 1.02, boxShadow: '0 10px 30px -12px rgb(var(--accent)/0.45)' }}
              whileTap={reduce || enviado ? undefined : { scale: 0.98 }}
              animate={animar}
              transition={{ duration: 0.5 }}
              className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 p-4 text-left transition-colors ${estilo} ${atenuada ? 'opacity-50' : ''} ${!enviado && !elegido ? 'hover:border-prexi-blue/50 hover:bg-subtle' : ''}`}
            >
              {/* Ripple(s) desde el punto tocado */}
              {(ondas[o.id] ?? []).map((w) => (
                <motion.span key={w.id} initial={{ scale: 0, opacity: 0.45 }} animate={{ scale: 5, opacity: 0 }} transition={{ duration: 0.6 }}
                  className="pointer-events-none absolute h-24 w-24 rounded-full bg-prexi-blue/30" style={{ left: w.x - 48, top: w.y - 48 }} />
              ))}

              <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors ${
                esCorrecta ? 'bg-[#22C55E] text-white'
                : malaElegida ? 'bg-amber-500 text-white'
                : elegido ? 'bg-prexi-blue text-white'
                : 'bg-subtle text-muted'}`}>
                {o.id}
              </span>
              <span className="relative flex-1 whitespace-pre-line font-medium text-fg">{o.texto}</span>
              {esCorrecta && <CheckCircle className="relative h-5 w-5 shrink-0 text-[#22C55E]" />}
              {malaElegida && <AlertCircle className="relative h-5 w-5 shrink-0 text-amber-500" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
