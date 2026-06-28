'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { CodeEditor } from '@/components/code-editor';
import { Bot, Play, RotateCcw, ArrowRight } from '@/components/icons';

const STARTER = '# Escribe tu código Python aquí\nnotas = [85, 90, 78]\nprint(sum(notas) / len(notas))\n';

interface Mensaje { de: 'alex' | 'tu'; texto: string }

export default function PracticaPage() {
  return (
    <Suspense fallback={<div className="text-slate-400">Cargando…</div>}>
      <PracticaInner />
    </Suspense>
  );
}

function PracticaInner() {
  const search = useSearchParams();
  const retoId = search.get('reto');

  const [codigo, setCodigo] = useState(STARTER);
  const [enunciado, setEnunciado] = useState<string | null>(null);
  const [salida, setSalida] = useState<{ texto: string; ok: boolean } | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { de: 'alex', texto: '¡Hola! Soy ALEX. Escribe tu código y pregúntame lo que quieras: reviso lo que escribiste y te oriento, pero no resuelvo por ti. 💪' },
  ]);
  const [pregunta, setPregunta] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!retoId) return;
    api.get<{ reto: { enunciado: string; codigoInicial: string | null } }>(`/retos/${retoId}`)
      .then((r) => { setEnunciado(r.reto.enunciado); if (r.reto.codigoInicial) setCodigo(r.reto.codigoInicial); })
      .catch(() => undefined);
  }, [retoId]);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [mensajes, escribiendo]);

  const contexto = retoId ? 'reto' : 'libre';
  const refId = retoId ? Number(retoId) : undefined;

  async function ejecutar() {
    setEjecutando(true); setSalida(null);
    try {
      const r = await api.post<{ ok: boolean; stdout: string; stderr: string }>('/practica/ejecutar', { codigo, contexto, refId });
      setSalida({ texto: (r.ok ? r.stdout : r.stderr || r.stdout) || '(sin salida)', ok: r.ok });
    } catch (err) {
      setSalida({ texto: err instanceof ApiError ? err.message : 'Error al ejecutar', ok: false });
    } finally { setEjecutando(false); }
  }

  async function preguntar() {
    const q = pregunta.trim();
    if (!q) return;
    setMensajes((m) => [...m, { de: 'tu', texto: q }]);
    setPregunta(''); setEscribiendo(true);
    try {
      const r = await api.post<{ respuesta: string }>('/practica/asistir', { codigo, enunciado: enunciado ?? undefined, pregunta: q });
      setMensajes((m) => [...m, { de: 'alex', texto: r.respuesta }]);
    } catch (err) {
      setMensajes((m) => [...m, { de: 'alex', texto: err instanceof ApiError ? err.message : 'No pude responder ahora.' }]);
    } finally { setEscribiendo(false); }
  }

  return (
    <div className="mx-auto max-w-7xl animate-fade-up">
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-prexi-navy">Zona de Práctica</h1>
        {enunciado ? <p className="mt-1 rounded-xl bg-blue-50 px-4 py-2 text-sm text-slate-700"><b className="text-prexi-blue">Reto:</b> {enunciado}</p>
          : <p className="text-slate-500">Escribe, ejecuta y mejora tu código Python con ALEX a tu lado.</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Editor + consola */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0f172a] shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-2 font-mono text-xs text-slate-400">main.py</span>
            </div>
          </div>
          <CodeEditor value={codigo} onChange={setCodigo} height="340px" />
          <div className="flex items-center gap-2 border-t border-slate-700 px-4 py-3">
            <button onClick={ejecutar} disabled={ejecutando} className="inline-flex items-center gap-2 rounded-xl bg-prexi-green px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.98] disabled:opacity-60">
              <Play className="h-4 w-4" /> {ejecutando ? 'Ejecutando…' : 'Ejecutar'}
            </button>
            <button onClick={() => setCodigo(STARTER)} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
              <RotateCcw className="h-4 w-4" /> Reiniciar
            </button>
          </div>
          <div className="border-t border-slate-700 px-4 py-3">
            <p className="mb-1.5 font-mono text-xs text-slate-400">▸ Consola</p>
            <pre className={`max-h-40 overflow-auto whitespace-pre-wrap font-mono text-sm ${salida ? (salida.ok ? 'text-green-300' : 'text-red-300') : 'text-slate-500'}`}>
              {salida ? salida.texto : 'Esperando ejecución…'}
            </pre>
          </div>
        </div>

        {/* Chat ALEX */}
        <div className="flex h-[560px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-prexi-blue text-white"><Bot className="h-5 w-5" /></div>
            <div><p className="font-bold leading-tight text-prexi-navy">ALEX — Tutor IA</p><p className="flex items-center gap-1 text-xs text-prexi-green"><span className="h-2 w-2 rounded-full bg-prexi-green" /> En línea · revisando tu código</p></div>
          </div>
          <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {mensajes.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.de === 'alex' ? 'bg-blue-50 text-slate-700' : 'ml-auto bg-prexi-navy text-white'}`}>{m.texto}</div>
            ))}
            {escribiendo && <div className="max-w-[60%] rounded-2xl bg-blue-50 px-3.5 py-3 text-sm text-slate-400"><span className="inline-flex gap-1"><Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" /></span> ALEX está escribiendo…</div>}
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <input value={pregunta} onChange={(e) => setPregunta(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && preguntar()} placeholder="Pregúntale a ALEX sobre tu código…" className="input !py-2 text-sm" />
              <button onClick={preguntar} disabled={escribiendo} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-prexi-blue text-white transition hover:bg-blue-600 disabled:opacity-50"><ArrowRight className="h-4 w-4" /></button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">ALEX te guía, no resuelve por ti</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay = '0s' }: { delay?: string }) {
  return <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: delay }} />;
}
