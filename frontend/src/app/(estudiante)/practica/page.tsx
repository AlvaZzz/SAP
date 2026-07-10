'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { CodeEditor } from '@/components/code-editor';
import { Bot, Play, RotateCcw, Send, Upload, CheckCircle, Clock, AlertTriangle } from '@/components/icons';

const STARTER = '# Escribe tu código Python aquí\nnotas = [85, 90, 78]\nprint(sum(notas) / len(notas))\n';

interface Mensaje { de: 'alex' | 'tu'; texto: string }
type EstadoEntrega = 'sin_entregar' | 'pendiente_revision' | 'aprobado' | 'necesita_mejorar';
interface Entrega { estado: EstadoEntrega; xp_obtenido: number; feedback: string | null; codigo?: string | null }

export default function PracticaPage() {
  return (
    <Suspense fallback={<div className="text-muted">Cargando…</div>}>
      <PracticaInner />
    </Suspense>
  );
}

function PracticaInner() {
  const search = useSearchParams();
  const retoId = search.get('reto');

  const [codigo, setCodigo] = useState(STARTER);
  const [enunciado, setEnunciado] = useState<string | null>(null);
  const [retoInfo, setRetoInfo] = useState<{ ejemploEntrada: string | null; ejemploSalida: string | null; fechaLimite: string | null } | null>(null);
  const [salida, setSalida] = useState<{ texto: string; ok: boolean } | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { de: 'alex', texto: '¡Hola! Soy ALVARO. Escribe tu código y pregúntame lo que quieras: reviso lo que escribiste y te oriento, pero no resuelvo por ti. 💪' },
  ]);
  const [pregunta, setPregunta] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [entregando, setEntregando] = useState(false);
  const [avisoEntrega, setAvisoEntrega] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!retoId) return;
    api.get<{ reto: { enunciado: string; codigoInicial: string | null; ejemploEntrada: string | null; ejemploSalida: string | null; fechaLimite: string | null } | null; entrega: Entrega | null }>(`/retos/${retoId}`)
      .then((r) => {
        if (r.reto) {
          setEnunciado(r.reto.enunciado);
          setRetoInfo({ ejemploEntrada: r.reto.ejemploEntrada, ejemploSalida: r.reto.ejemploSalida, fechaLimite: r.reto.fechaLimite });
          if (r.reto.codigoInicial && !r.entrega?.codigo) setCodigo(r.reto.codigoInicial);
        }
        setEntrega(r.entrega);
      })
      .catch(() => undefined);
  }, [retoId]);

  async function entregarReto() {
    if (!retoId) return;
    setEntregando(true); setAvisoEntrega('');
    try {
      const r = await api.post<{ estado: EstadoEntrega }>(`/retos/${retoId}/entregar`, { codigo });
      setEntrega({ estado: r.estado, xp_obtenido: 0, feedback: null });
    } catch (err) {
      setAvisoEntrega(err instanceof ApiError ? err.message : 'No se pudo entregar el reto');
    } finally { setEntregando(false); }
  }

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
      const r = await api.post<{ respuesta: string }>('/tutor-ia/practica', { codigo_actual: codigo, enunciado_reto: enunciado ?? undefined, pregunta: q });
      setMensajes((m) => [...m, { de: 'alex', texto: r.respuesta }]);
    } catch (err) {
      setMensajes((m) => [...m, { de: 'alex', texto: err instanceof ApiError ? err.message : 'ALVARO no está disponible ahora, intenta de nuevo.' }]);
    } finally { setEscribiendo(false); }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Zona de Práctica</h1>
        {enunciado ? <p className="mt-2 rounded-xl bg-prexi-blue/10 px-4 py-2.5 text-sm text-fg"><b className="text-prexi-blue-deep">Reto:</b> {enunciado}</p>
          : <p className="mt-1 text-[15px] text-muted">Escribe, ejecuta y mejora tu código Python con ALVARO a tu lado.</p>}

        {retoInfo && (retoInfo.ejemploEntrada || retoInfo.ejemploSalida || retoInfo.fechaLimite) && (
          <div className="mt-2 flex flex-wrap items-stretch gap-2 text-sm">
            {retoInfo.ejemploEntrada && (
              <div className="rounded-xl border border-line bg-card px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Entrada</p>
                <pre className="whitespace-pre-wrap font-mono text-xs text-fg">{retoInfo.ejemploEntrada}</pre>
              </div>
            )}
            {retoInfo.ejemploSalida && (
              <div className="rounded-xl border border-line bg-card px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Salida esperada</p>
                <pre className="whitespace-pre-wrap font-mono text-xs text-fg">{retoInfo.ejemploSalida}</pre>
              </div>
            )}
            {retoInfo.fechaLimite && (
              <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Clock className="h-3.5 w-3.5" /> Límite: {new Date(retoInfo.fechaLimite).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        )}

        {retoId && entrega && entrega.estado !== 'sin_entregar' && (
          <div className={`mt-3 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
            entrega.estado === 'aprobado' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : entrega.estado === 'necesita_mejorar' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'bg-prexi-blue/10 text-prexi-blue-deep'}`}>
            {entrega.estado === 'aprobado' ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              : entrega.estado === 'necesita_mejorar' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              : <Clock className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <p className="font-semibold">
                {entrega.estado === 'aprobado' ? `¡Aprobado! +${entrega.xp_obtenido} XP`
                  : entrega.estado === 'necesita_mejorar' ? 'El docente pide mejoras — corrige y vuelve a entregar.'
                  : 'Entregado — esperando la revisión del docente.'}
              </p>
              {entrega.feedback && <p className="mt-0.5 opacity-90"><b>Feedback:</b> {entrega.feedback}</p>}
            </div>
          </div>
        )}
        {avisoEntrega && <p className="mt-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-prexi-red">{avisoEntrega}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        {/* Editor + consola */}
        <div className="flex min-h-[72vh] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0F1B2D] shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-2 font-mono text-xs text-slate-400">main.py</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeEditor value={codigo} onChange={setCodigo} height="100%" className="h-full" />
          </div>
          <div className="flex items-center gap-2 border-t border-slate-700/80 px-4 py-3">
            <button onClick={ejecutar} disabled={ejecutando} className="inline-flex items-center gap-2 rounded-xl bg-prexi-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.98] disabled:opacity-60">
              <Play className="h-4 w-4" /> {ejecutando ? 'Ejecutando…' : 'Ejecutar'}
            </button>
            <button onClick={() => setCodigo(STARTER)} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
              <RotateCcw className="h-4 w-4" /> Reiniciar
            </button>
            {retoId && (() => {
              const est = entrega?.estado;
              const bloqueado = est === 'pendiente_revision' || est === 'aprobado';
              return (
                <button onClick={entregarReto} disabled={entregando || bloqueado}
                  title={bloqueado ? 'Ya entregaste este reto' : 'Enviar tu solución al docente'}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-prexi-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                  <Upload className="h-4 w-4" /> {entregando ? 'Entregando…' : est === 'necesita_mejorar' ? 'Reenviar reto' : est === 'aprobado' ? 'Aprobado' : est === 'pendiente_revision' ? 'En revisión' : 'Entregar reto'}
                </button>
              );
            })()}
          </div>
          <div className="border-t border-slate-700/80 px-4 py-3">
            <p className="mb-1.5 font-mono text-xs text-slate-400">▸ Consola</p>
            <pre className={`max-h-44 overflow-auto whitespace-pre-wrap font-mono text-sm ${salida ? (salida.ok ? 'text-green-300' : 'text-red-300') : 'text-slate-500'}`}>
              {salida ? salida.texto : 'Esperando ejecución…'}
            </pre>
          </div>
        </div>

        {/* Chat ALVARO */}
        <div className="flex min-h-[72vh] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
          <div className="flex items-center gap-3 border-b border-line px-4 py-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-prexi-blue text-white"><Bot className="h-6 w-6" /></div>
            <div><p className="font-bold leading-tight text-fg">ALVARO — Tutor IA</p><p className="flex items-center gap-1.5 text-xs text-prexi-green"><span className="h-2 w-2 rounded-full bg-prexi-green" /> En línea · revisando tu código</p></div>
          </div>
          <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {mensajes.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.de === 'alex' ? 'bg-prexi-blue/10 text-fg' : 'ml-auto bg-prexi-navy text-white'}`}>{m.texto}</div>
            ))}
            {escribiendo && <div className="max-w-[60%] rounded-2xl bg-prexi-blue/10 px-4 py-3 text-sm text-muted"><span className="inline-flex gap-1"><Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" /></span> ALVARO está escribiendo…</div>}
          </div>
          <div className="border-t border-line p-3">
            <div className="flex gap-2">
              <input value={pregunta} onChange={(e) => setPregunta(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && preguntar()} placeholder="Pregúntale a ALVARO sobre tu código…" className="input !py-2.5 text-sm" />
              <button onClick={preguntar} disabled={escribiendo} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-prexi-blue text-white transition hover:bg-blue-600 disabled:opacity-50"><Send className="h-[18px] w-[18px]" /></button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted">ALVARO te guía, no resuelve por ti</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay = '0s' }: { delay?: string }) {
  return <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: delay }} />;
}
