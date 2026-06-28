'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { api, ApiError } from '@/lib/api';
import { Ejercicio, ResultadoIntento } from '@/lib/types';
import { CodeBlock } from '@/components/code-block';
import { AlexPanel } from '@/components/alex-panel';
import { CheckCircle, ArrowRight, ChevronLeft, Code, X } from '@/components/icons';

export default function DetallePage() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();

  const [ej, setEj] = useState<Ejercicio | null>(null);
  const [orden, setOrden] = useState<{ idx: number; total: number; ids: number[] }>({ idx: 0, total: 1, ids: [] });
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoIntento | null>(null);
  const [retro, setRetro] = useState<string | null>(null);
  const [fallidos, setFallidos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [inicio] = useState(() => Date.now());

  useEffect(() => {
    setResultado(null); setRetro(null); setSeleccion(null);
    api.get<{ ejercicio: Ejercicio }>(`/ejercicios/${id}`).then((r) => {
      setEj(r.ejercicio);
      api.get<{ ejercicios: Ejercicio[] }>(`/ejercicios?nivel=${r.ejercicio.nivelId}`).then((lr) => {
        const ids = lr.ejercicios.map((e) => e.id);
        const i = ids.indexOf(r.ejercicio.id);
        setOrden({ idx: i < 0 ? 0 : i, total: ids.length || 1, ids });
      }).catch(() => undefined);
    }).catch(() => undefined);
  }, [id]);

  async function enviar() {
    if (!seleccion || !ej) return;
    setEnviando(true);
    try {
      const r = await api.post<ResultadoIntento>('/intentos', {
        ejercicioId: ej.id, respuestaDada: seleccion, tiempoSeg: Math.round((Date.now() - inicio) / 1000),
      });
      setResultado(r);
      if (r.correcto) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb', '#16a34a', '#f59e0b'] });
        if (r.nivel.nivelDesbloqueadoNumero) {
          setTimeout(() => confetti({ particleCount: 140, spread: 100, origin: { y: 0.5 } }), 300);
        }
      } else {
        setFallidos((f) => f + 1);
        try {
          const fb = await api.post<{ explicacion: string }>('/ai/retroalimentacion', {
            respuestaEstudiante: seleccion, respuestaCorrecta: r.respuesta_correcta, codigo: ej.codigoPython ?? undefined,
          });
          setRetro(fb.explicacion);
        } catch { setRetro(r.explicacion_base); }
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Error al enviar');
    } finally { setEnviando(false); }
  }

  if (!ej) return <p className="text-slate-400">Cargando ejercicio…</p>;
  const progreso = Math.round(((orden.idx + 1) / orden.total) * 100);
  const sig = orden.ids[orden.idx + 1];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button onClick={() => router.push('/ejercicios')} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50" title="Salir"><X className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-sm font-semibold text-prexi-navy">Ejercicio {orden.idx + 1} de {orden.total}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${progreso}%` }} /></div>
        </div>
        <span className="text-prexi-amber">{'★'.repeat(ej.estrellas)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className={`card ${resultado && !resultado.correcto ? 'animate-shake' : ''}`}>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-prexi-blue"><Code className="h-4 w-4" /> {ej.categoria} · Python</div>
            <h1 className="mb-5 text-xl font-bold text-prexi-navy">{ej.enunciado}</h1>
            {ej.codigoPython && <div className="mb-5"><CodeBlock code={ej.codigoPython} /></div>}

            <div className="grid gap-3 sm:grid-cols-2">
              {ej.opciones.map((o) => {
                const elegido = seleccion === o.id;
                const esCorrecta = resultado && o.id === resultado.respuesta_correcta;
                const malaElegida = resultado && elegido && !resultado.correcto;
                return (
                  <button key={o.id} disabled={!!resultado} onClick={() => setSeleccion(o.id)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition active:scale-[0.99] ${esCorrecta ? 'border-prexi-green bg-green-50' : malaElegida ? 'border-red-400 bg-red-50' : elegido ? 'border-prexi-blue bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${esCorrecta ? 'bg-prexi-green text-white' : elegido ? 'bg-prexi-blue text-white' : 'bg-slate-100 text-slate-500'}`}>{o.id}</span>
                    <span className="whitespace-pre-line font-medium text-slate-700">{o.texto}</span>
                  </button>
                );
              })}
            </div>

            {resultado && (
              <div className="mt-5">
                {resultado.correcto ? (
                  <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4 animate-fade-up">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-prexi-green" />
                    <div>
                      <p className="font-bold text-prexi-green">¡Correcto! <span className="ml-1 text-prexi-amber">+{resultado.xp.xpOtorgado} XP</span></p>
                      <p className="text-sm text-slate-600">base × {resultado.xp.multiplicador} por racha de {resultado.xp.rachaDias} días.</p>
                      {resultado.nivel.nivelDesbloqueadoNumero && <p className="mt-1 text-sm font-semibold text-prexi-blue">🔓 ¡Desbloqueaste el Nivel {resultado.nivel.nivelDesbloqueadoNumero}!</p>}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-red-50 p-4 animate-fade-up">
                    <p className="font-bold text-red-600">No es correcta esta vez.</p>
                    {retro && <p className="mt-1 text-sm text-slate-600"><span className="font-semibold text-prexi-navy">ALEX:</span> {retro}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
              <button onClick={() => router.push('/ejercicios')} className="btn-ghost"><ChevronLeft className="h-4 w-4" /> Volver</button>
              {!resultado ? (
                <button onClick={enviar} disabled={!seleccion || enviando} className="btn-primary disabled:opacity-50">{enviando ? 'Enviando…' : 'Enviar respuesta'}</button>
              ) : sig ? (
                <button onClick={() => router.push(`/ejercicios/${sig}`)} className="btn-primary">Siguiente <ArrowRight className="h-4 w-4" /></button>
              ) : (
                <button onClick={() => router.push('/ejercicios')} className="btn-primary">Finalizar <CheckCircle className="h-4 w-4" /></button>
              )}
            </div>
          </div>
        </div>

        <div>
          <AlexPanel contextoTema={ej.categoria} maxPistas={ej.maxPistas} enunciado={ej.enunciado} codigo={ej.codigoPython ?? undefined} />
        </div>
      </div>
    </div>
  );
}
