'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useReducedMotion } from 'framer-motion';
import { CodeViewer } from '@/components/code-viewer';
import { useSound } from '@/components/use-sound';
import { CheckCircle, AlertCircle, Terminal } from '@/components/icons';
import type { ExerciseProps } from './index';
import { useAtajosOpciones } from './atajos';

/**
 * TIPO 2 — Predecir la salida. Arriba el código (entrada) con estética de editor;
 * debajo una "consola" tipo terminal. Si el ejercicio trae opciones, se muestran
 * como posibles SALIDAS; si no, un input monoespaciado. Al comprobar, la salida
 * CORRECTA se "teclea" carácter por carácter, como si la consola corriera.
 * El backend compara texto/id (case-insensitive); aquí solo avisamos diferencias.
 */
export function PredecirSalida({ ejercicio, resultado, onChange }: ExerciseProps) {
  const modoOpciones = ejercicio.opciones.length > 0;
  return (
    <div>
      {/* Muchos ítems del banco plantean el caso en el ENUNCIADO y no traen código;
          el rótulo solo aparece cuando hay algo que rotular. */}
      {ejercicio.codigoPython && (
        <>
          <p className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-muted">Entrada · código</p>
          <div className="mb-5"><CodeViewer code={ejercicio.codigoPython} /></div>
        </>
      )}
      {modoOpciones
        ? <ConsolaOpciones ejercicio={ejercicio} resultado={resultado} onChange={onChange} />
        : <ConsolaEscrita ejercicio={ejercicio} resultado={resultado} onChange={onChange} />}
    </div>
  );
}

/** Efecto de "tecleo" carácter por carácter (respeta prefers-reduced-motion). */
function useTyping(text: string, activo: boolean): { shown: string; done: boolean } {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!activo) { setN(0); return; }
    if (reduce) { setN(text.length); return; }
    setN(0);
    let i = 0;
    const t = setInterval(() => { i += 1; setN(i); if (i >= text.length) clearInterval(t); }, 28);
    return () => clearInterval(t);
  }, [text, activo, reduce]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

function BarraTerminal() {
  return (
    <div className="flex items-center gap-2 border-b border-white/10 bg-[#0A121F] px-4 py-2">
      <Terminal className="h-3.5 w-3.5 text-slate-400" />
      <span className="font-mono text-xs text-slate-400">Consola · salida</span>
    </div>
  );
}

/** La salida correcta, tecleada con un cursor parpadeante al terminar. */
function SalidaTecleada({ texto }: { texto: string }) {
  const { shown, done } = useTyping(texto, true);
  return (
    <span className="whitespace-pre-wrap break-words text-[#22C55E]">
      {shown}
      <span className={`ml-0.5 inline-block w-[7px] translate-y-[1px] ${done ? 'animate-pulse' : ''} bg-[#27C93F]`} style={{ height: '1em' }} aria-hidden />
    </span>
  );
}

/* ── Opciones de salida presentadas como líneas de consola ── */
function ConsolaOpciones({ ejercicio, resultado, onChange }: ExerciseProps) {
  const [sel, setSel] = useState<string | null>(null);
  const { playClick } = useSound();
  const enviado = !!resultado;
  const correcta = (resultado?.respuesta_correcta ?? '').trim().toUpperCase();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const opCorrecta = ejercicio.opciones.find((o) => o.id.trim().toUpperCase() === correcta);

  const elegir = (id: string) => { if (enviado) return; setSel(id); onChange(id); playClick(); };
  useAtajosOpciones(ejercicio.opciones.map((o) => o.id), !enviado, elegir, refs);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (enviado) return;
    const ids = ejercicio.opciones.map((o) => o.id);
    const i = sel ? ids.indexOf(sel) : -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); const n = ids[(i + 1 + ids.length) % ids.length]; elegir(n); refs.current[ids.indexOf(n)]?.focus(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); const n = ids[(i - 1 + ids.length) % ids.length]; elegir(n); refs.current[ids.indexOf(n)]?.focus(); }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#0E3F7E] bg-[#04162E] shadow-lift">
      <BarraTerminal />
      {/* data-sonido-off: estas opciones ya reproducen su propio click. */}
      <div role="radiogroup" aria-label="Posibles salidas" data-sonido-off onKeyDown={onKey} className="space-y-2 p-3">
        {ejercicio.opciones.map((o, i) => {
          const idU = o.id.trim().toUpperCase();
          const elegido = sel === o.id;
          const esCorrecta = enviado && idU === correcta;
          const malaElegida = enviado && elegido && idU !== correcta;
          const atenuada = enviado && !esCorrecta && !malaElegida;
          const estilo = esCorrecta ? 'border-[#22C55E]/70 bg-[#22C55E]/12'
            : malaElegida ? 'border-amber-400/60 bg-amber-500/12'
            : elegido ? 'border-prexi-blue bg-prexi-blue/15'
            : 'border-white/10 hover:border-prexi-blue/50 hover:bg-white/[0.04]';
          return (
            <button key={o.id} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={elegido} disabled={enviado}
              tabIndex={enviado ? -1 : elegido || (!sel && i === 0) ? 0 : -1} onClick={() => elegir(o.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left font-mono text-sm transition-colors ${estilo} ${atenuada ? 'opacity-50' : ''}`}>
              <span aria-hidden className="shrink-0 select-none font-bold text-[#27C93F]">&gt;&gt;&gt;</span>
              <span className="flex-1 whitespace-pre-wrap break-words text-slate-100">{o.texto}</span>
              {esCorrecta && <CheckCircle className="h-4 w-4 shrink-0 text-[#22C55E]" />}
              {malaElegida && <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />}
            </button>
          );
        })}

        {/* Al comprobar: la consola "ejecuta" y teclea la salida correcta. */}
        {enviado && opCorrecta && (
          <div className="mt-1 flex items-start gap-3 border-t border-white/10 px-1 pt-3 font-mono text-sm">
            <span aria-hidden className="shrink-0 select-none font-bold text-[#27C93F]">&gt;&gt;&gt;</span>
            <SalidaTecleada texto={opCorrecta.texto} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Entrada escrita dentro de la consola (fallback si no hay opciones) ── */
function ConsolaEscrita({ resultado, onChange }: ExerciseProps) {
  const [texto, setTexto] = useState('');
  const enviado = !!resultado;
  const esperado = resultado?.respuesta_correcta ?? '';
  const norm = (s: string) => s.replace(/\s+$/g, '');
  const distintoSoloCase = enviado && norm(texto).toLowerCase() === norm(esperado).toLowerCase() && norm(texto) !== norm(esperado);
  const distintoComillas = enviado && norm(texto).replace(/"/g, "'") === norm(esperado).replace(/"/g, "'") && norm(texto) !== norm(esperado);

  return (
    <div className="overflow-hidden rounded-xl border border-[#0E3F7E] bg-[#04162E] shadow-lift">
      <BarraTerminal />
      <div className="p-4 font-mono text-sm">
        <div className="flex items-center gap-2">
          <span aria-hidden className="select-none font-bold text-[#27C93F]">&gt;&gt;&gt;</span>
          <input
            value={texto}
            onChange={(e) => { setTexto(e.target.value); onChange(e.target.value.replace(/\s+$/g, '') || null); }}
            disabled={enviado} spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off"
            aria-label="Escribe la salida esperada" placeholder="Escribe lo que imprime el programa…"
            className="flex-1 bg-transparent text-slate-100 caret-[#27C93F] outline-none placeholder:text-slate-500"
          />
        </div>
        {enviado && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="text-2xs uppercase tracking-wide text-slate-500">Salida correcta</p>
            <p className="mt-1 flex items-start gap-2">
              <span aria-hidden className="select-none font-bold text-[#27C93F]">&gt;&gt;&gt;</span>
              <SalidaTecleada texto={esperado} />
            </p>
            {(distintoSoloCase || distintoComillas) && (
              <p className="mt-2 text-2xs text-amber-300">
                {distintoSoloCase && 'Ojo: coincide salvo por MAYÚSCULAS/minúsculas. '}
                {distintoComillas && 'Ojo: coincide salvo por el tipo de comillas.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
