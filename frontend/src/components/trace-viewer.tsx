'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertTriangle, Play, Pause } from '@/components/icons';

export interface PasoTraza { linea: number; locals: Record<string, string> }

/** Python describe funciones y clases con su dirección de memoria: no le dice nada a un principiante. */
function legible(valor: string): string {
  if (/^<function /.test(valor)) return 'una función';
  if (/^<class /.test(valor)) return 'una clase';
  if (/^<module /.test(valor)) return 'un módulo';
  return valor;
}

const VELOCIDADES = [{ ms: 1400, texto: 'Lento' }, { ms: 800, texto: 'Normal' }, { ms: 350, texto: 'Rápido' }];

/**
 * EJECUCIÓN PASO A PASO. Muestra el programa "en cámara lenta": qué línea se
 * ejecuta en cada paso y cuánto vale cada variable en ese momento. Las variables
 * que acaban de crearse o de cambiar se resaltan, que es justo lo que hay que
 * mirar para encontrar un error. Se puede avanzar a mano o reproducir solo.
 */
export function TraceViewer({ codigo, pasos, error }: { codigo: string; pasos: PasoTraza[]; error?: string | null }) {
  const [idx, setIdx] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(1);
  const lineaActiva = useRef<HTMLDivElement>(null);
  const lineas = useMemo(() => codigo.split('\n'), [codigo]);
  const ultimo = Math.max(0, pasos.length - 1);
  const i = Math.min(idx, ultimo);

  // Una traza nueva empieza siempre desde el primer paso.
  useEffect(() => { setIdx(0); setReproduciendo(false); }, [pasos]);

  // Reproducción automática: avanza sola y se detiene al llegar al final.
  useEffect(() => {
    if (!reproduciendo) return;
    if (i >= ultimo) { setReproduciendo(false); return; }
    const t = setTimeout(() => setIdx((n) => Math.min(ultimo, n + 1)), VELOCIDADES[velocidad].ms);
    return () => clearTimeout(t);
  }, [reproduciendo, i, ultimo, velocidad]);

  // La línea que se está ejecutando se mantiene a la vista. Se mueve SOLO el
  // recuadro del código: scrollIntoView arrastraba también la página entera.
  useEffect(() => {
    const linea = lineaActiva.current;
    const caja = linea?.parentElement;
    if (!linea || !caja) return;
    const arriba = linea.offsetTop - caja.offsetTop;
    if (arriba < caja.scrollTop || arriba + linea.offsetHeight > caja.scrollTop + caja.clientHeight) {
      caja.scrollTop = Math.max(0, arriba - caja.clientHeight / 2);
    }
  }, [i]);

  if (error) return (
    <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3.5 py-3 text-sm text-prexi-red">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">El programa se detuvo con un error</p>
        <pre className="mt-1 whitespace-pre-wrap font-mono text-xs opacity-90">{error}</pre>
      </div>
    </div>
  );
  if (!pasos.length) return <p className="rounded-xl bg-subtle px-3.5 py-3 text-sm text-muted">No hay pasos que mostrar: el programa no llegó a ejecutar ninguna línea.</p>;

  const paso = pasos[i];
  const antes = i > 0 ? pasos[i - 1].locals : {};
  const vars = Object.entries(paso.locals);
  const ir = (n: number) => { setReproduciendo(false); setIdx(Math.max(0, Math.min(ultimo, n))); };
  const alternar = () => { if (i >= ultimo) setIdx(0); setReproduciendo((r) => !r); };
  const boton = 'grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:bg-subtle hover:text-fg disabled:opacity-40';

  return (
    <div className="rounded-xl border border-line bg-card p-3 sm:p-4"
      onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); ir(i + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(i - 1); } }}>
      {/* Controles de reproducción */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => ir(0)} disabled={i === 0} className={boton} aria-label="Ir al inicio" title="Ir al inicio"><ChevronsLeft className="h-4 w-4" /></button>
          <button onClick={() => ir(i - 1)} disabled={i === 0} className={boton} aria-label="Paso anterior" title="Paso anterior (←)"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={alternar} aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-prexi-blue px-3.5 text-sm font-semibold text-accent-on transition hover:bg-prexi-blue-hover">
            {reproduciendo ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> {i >= ultimo ? 'Repetir' : 'Reproducir'}</>}
          </button>
          <button onClick={() => ir(i + 1)} disabled={i >= ultimo} className={boton} aria-label="Paso siguiente" title="Paso siguiente (→)"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => ir(ultimo)} disabled={i >= ultimo} className={boton} aria-label="Ir al final" title="Ir al final"><ChevronsRight className="h-4 w-4" /></button>
        </div>
        <span className="text-sm font-semibold text-fg" style={{ fontVariantNumeric: 'tabular-nums' }}>Paso {i + 1} <span className="font-medium text-muted">de {pasos.length}</span></span>
        <div className="ml-auto inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Velocidad">
          {VELOCIDADES.map((v, n) => (
            <button key={v.texto} role="radio" aria-checked={velocidad === n} onClick={() => setVelocidad(n)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${velocidad === n ? 'bg-subtle text-fg' : 'text-muted hover:text-fg'}`}>{v.texto}</button>
          ))}
        </div>
      </div>
      <input type="range" min={0} max={ultimo} value={i} onChange={(e) => ir(Number(e.target.value))} aria-label="Paso de la ejecución" className="mb-3 w-full accent-prexi-blue" />

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[1.35fr_1fr]">
        {/* Código, con la línea en ejecución marcada */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Se está ejecutando la línea {paso.linea}</p>
          <pre className="max-h-80 overflow-auto rounded-xl bg-[#04162E] py-2 font-mono text-[13px] leading-relaxed">
            {lineas.map((l, n) => {
              const activa = n + 1 === paso.linea;
              return (
                <div key={n} ref={activa ? lineaActiva : undefined} className={`flex px-2 ${activa ? 'bg-prexi-blue/35' : ''}`}>
                  <span className={`w-4 shrink-0 select-none font-bold ${activa ? 'text-amber-300' : 'text-transparent'}`} aria-hidden>▸</span>
                  <span className={`mr-3 w-6 shrink-0 select-none text-right ${activa ? 'text-white' : 'text-slate-500'}`}>{n + 1}</span>
                  <span className={activa ? 'font-semibold text-white' : 'text-slate-300'}>{l || ' '}</span>
                </div>
              );
            })}
          </pre>
        </div>

        {/* Variables: lo que vale cada una en este paso */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Variables en este momento</p>
          {vars.length === 0 ? <p className="rounded-xl bg-subtle px-3 py-3 text-sm text-muted">Todavía no se creó ninguna variable.</p> : (
            <ul className="space-y-1.5">
              {vars.map(([nombre, valor]) => {
                const nueva = !(nombre in antes);
                const cambio = !nueva && antes[nombre] !== valor;
                return (
                  <li key={nombre} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${nueva ? 'border-prexi-green/50 bg-prexi-green/10' : cambio ? 'border-prexi-amber/60 bg-prexi-amber/10' : 'border-line'}`}>
                    <span className="rounded-md bg-prexi-blue/10 px-2 py-0.5 font-mono text-xs font-bold text-prexi-blue-deep">{nombre}</span>
                    <span className="text-muted" aria-hidden>=</span>
                    <span className="min-w-0 flex-1 break-all font-mono text-sm text-fg">
                      {cambio && <span className="mr-1.5 text-muted line-through">{legible(antes[nombre])}</span>}
                      {legible(valor)}
                    </span>
                    {nueva && <span className="shrink-0 text-[10px] font-bold uppercase text-prexi-green">nueva</span>}
                    {cambio && <span className="shrink-0 text-[10px] font-bold uppercase text-prexi-amber">cambió</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
