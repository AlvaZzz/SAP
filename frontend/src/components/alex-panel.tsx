'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Bot, Lightbulb, Lock, ChevronDown, Send } from './icons';

const ETIQUETA: Record<number, string> = { 1: 'El concepto', 2: 'Dónde está el error', 3: 'Casi la solución' };

/**
 * Panel del tutor ALVARO en el detalle de ejercicio.
 * Consume los endpoints reales /tutor-ia/asistente y /tutor-ia/pista.
 * Las pistas se registran en el backend (penalizan XP del ejercicio).
 */
export function AlexPanel({ ejercicioId, contextoTema, maxPistas }: {
  ejercicioId: number; contextoTema?: string; maxPistas: number;
}) {
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [pistas, setPistas] = useState<Record<number, string>>({});
  const [abierta, setAbierta] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function preguntar() {
    if (!pregunta.trim() || cargando) return;
    const q = pregunta;
    setCargando(true); setError('');
    const cuerpo = { pregunta: q, contextoTema, ejercicio_id: ejercicioId };
    try {
      // Streaming: ALVARO va "escribiendo" en tiempo real.
      const res = await fetch('/api/tutor-ia/asistente/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok || !res.body) {
        let msg = 'ALVARO no está disponible ahora, intenta de nuevo.';
        try { const d = await res.json(); msg = (Array.isArray(d.message) ? d.message[0] : d.message) ?? msg; } catch { /* sin JSON */ }
        throw new ApiError(res.status, msg);
      }
      setRespuesta(''); setPregunta('');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setRespuesta(acc);
      }
      if (!acc.trim()) setRespuesta('ALVARO no está disponible ahora, intenta de nuevo.');
    } catch (streamErr) {
      // Fallback robusto: si el streaming falla, usa el endpoint normal.
      try {
        const r = await api.post<{ respuesta: string }>('/tutor-ia/asistente', cuerpo);
        setRespuesta(r.respuesta); setPregunta('');
      } catch (err) {
        setError(err instanceof ApiError ? err.message
          : streamErr instanceof ApiError ? streamErr.message
          : 'ALVARO no está disponible ahora, intenta de nuevo.');
      }
    } finally { setCargando(false); }
  }

  async function pedirPista(nivel: 1 | 2 | 3) {
    if (pistas[nivel]) { setAbierta(abierta === nivel ? null : nivel); return; }
    setCargando(true); setError('');
    try {
      const r = await api.post<{ pista: string }>('/tutor-ia/pista', { ejercicio_id: ejercicioId, nivel_pista: nivel });
      setPistas((p) => ({ ...p, [nivel]: r.pista })); setAbierta(nivel);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo obtener la pista.'); }
    finally { setCargando(false); }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-b from-prexi-navy to-prexi-navy-soft p-5 text-white shadow-soft">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-prexi-blue"><Bot className="h-6 w-6" /></div>
        <div><p className="font-bold leading-tight">ALVARO IA</p><p className="text-xs text-blue-200/80">Tutor Inteligente</p></div>
      </div>
      <div className="mb-4 rounded-xl bg-white/10 p-3.5 text-sm leading-relaxed text-blue-50">
        {respuesta ?? '¡Hola! Pregúntame sobre el concepto o pídeme una pista. No te daré la respuesta, pero te guiaré. 💡'}
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">{error}</p>}
      <div className="space-y-2">
        {([1, 2, 3] as const).map((nivel) => {
          const bloqueada = nivel > maxPistas; const open = abierta === nivel && !!pistas[nivel];
          return (
            <div key={nivel} className="overflow-hidden rounded-xl bg-white/5">
              <button disabled={bloqueada || cargando} onClick={() => pedirPista(nivel)} className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition hover:bg-white/5 disabled:opacity-40">
                <span className="flex items-center gap-2">
                  {bloqueada ? <Lock className="h-4 w-4 text-blue-200/70" /> : <Lightbulb className="h-4 w-4 text-prexi-amber" />}
                  <span className="font-semibold">Pista {nivel}:</span><span className="text-blue-200/80">{ETIQUETA[nivel]}</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-blue-200/70 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && <p className="px-3.5 pb-3 text-sm leading-relaxed text-blue-50">{pistas[nivel]}</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <input className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200/60 outline-none focus:bg-white/20" placeholder="Escribe tu duda…" value={pregunta} onChange={(e) => setPregunta(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && preguntar()} />
        <button onClick={preguntar} disabled={cargando} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-prexi-blue transition hover:bg-blue-600 disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
