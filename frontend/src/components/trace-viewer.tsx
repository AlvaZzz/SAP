'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle } from '@/components/icons';

export interface PasoTraza { linea: number; locals: Record<string, string> }

/**
 * Visualizador de traza paso a paso: resalta la LÍNEA actual del código y muestra
 * las variables como "cajas etiquetadas" (materializa la analogía variable=caja).
 */
export function TraceViewer({ codigo, pasos, error }: { codigo: string; pasos: PasoTraza[]; error?: string | null }) {
  const [idx, setIdx] = useState(0);
  const lineas = codigo.split('\n');

  if (error) return (
    <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3.5 py-3 text-sm text-prexi-red">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div><p className="font-semibold">No se pudo trazar</p><pre className="mt-1 whitespace-pre-wrap font-mono text-xs opacity-90">{error}</pre></div>
    </div>
  );
  if (!pasos.length) return <p className="rounded-xl bg-subtle px-3.5 py-3 text-sm text-muted">No hay pasos que mostrar (el código no ejecutó ninguna línea).</p>;

  const paso = pasos[Math.min(idx, pasos.length - 1)];
  const vars = Object.entries(paso.locals);

  return (
    <div className="rounded-xl border border-line bg-card p-3">
      {/* Controles */}
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:bg-subtle disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold text-fg">Paso {idx + 1} <span className="text-muted">de {pasos.length}</span> · línea {paso.linea}</span>
        <button onClick={() => setIdx((i) => Math.min(pasos.length - 1, i + 1))} disabled={idx >= pasos.length - 1} className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted transition hover:bg-subtle disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        <input type="range" min={0} max={pasos.length - 1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="ml-1 flex-1 accent-prexi-blue" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr]">
        {/* Código con la línea actual resaltada */}
        <pre className="overflow-x-auto rounded-xl bg-[#04162E] p-3 font-mono text-[12px] leading-relaxed">
          {lineas.map((l, i) => {
            const activa = i + 1 === paso.linea;
            return (
              <div key={i} className={`flex ${activa ? 'rounded bg-prexi-blue/30' : ''}`}>
                <span className="mr-3 w-6 shrink-0 select-none text-right text-slate-500">{i + 1}</span>
                <span className={activa ? 'text-white' : 'text-slate-300'}>{l || ' '}</span>
              </div>
            );
          })}
        </pre>

        {/* Variables como cajas etiquetadas */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Variables en este paso</p>
          {vars.length === 0 ? <p className="text-sm text-muted">Aún no hay variables.</p> : (
            <div className="flex flex-wrap gap-2">
              {vars.map(([k, v]) => (
                <div key={k} className="overflow-hidden rounded-lg border border-prexi-blue/30 bg-prexi-blue/5">
                  <div className="bg-prexi-blue/10 px-2 py-0.5 text-center text-[11px] font-bold text-prexi-blue-deep">{k}</div>
                  <div className="px-2.5 py-1.5 text-center font-mono text-sm text-fg">{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
