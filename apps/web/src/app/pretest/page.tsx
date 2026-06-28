'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { CodeBlock } from '@/components/code-block';
import { Clock, Bot, ChevronLeft, ChevronRight, CheckCircle, GraduationCap } from '@/components/icons';

interface Pregunta {
  id: number; categoria: string; estrellas: number; tipo: string;
  enunciado: string; codigoPython: string | null;
  opciones: { id: string; texto: string }[]; opcion_guardada: string | null;
}
const DURACION = 25 * 60;

export default function PretestPage() {
  const { usuario, refrescar } = useAuth();
  const router = useRouter();
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [idx, setIdx] = useState(0);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [seg, setSeg] = useState(DURACION);
  const [cargando, setCargando] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const yaFin = useRef(false);

  useEffect(() => {
    if (usuario && usuario.rol !== 'estudiante') { router.replace('/dashboard'); return; }
    api.get<{ completado: boolean }>('/pretest/estado').then((e) => {
      if (e.completado) { router.replace('/pretest/resultado'); return; }
      api.get<{ preguntas: Pregunta[] }>('/pretest/preguntas').then((r) => {
        setPreguntas(r.preguntas);
        const ini: Record<number, string> = {};
        r.preguntas.forEach((p) => { if (p.opcion_guardada) ini[p.id] = p.opcion_guardada; });
        setResp(ini);
      }).finally(() => setCargando(false));
    }).catch(() => setCargando(false));
  }, [usuario, router]);

  const finalizar = useCallback(async () => {
    if (yaFin.current) return; yaFin.current = true; setFinalizando(true);
    try {
      await api.post('/pretest/finalizar', { tiempoSeg: DURACION - seg });
      await refrescar();
      router.replace('/pretest/resultado');
    } catch { setFinalizando(false); yaFin.current = false; }
  }, [refrescar, router, seg]);

  useEffect(() => {
    if (cargando) return;
    if (seg <= 0) { finalizar(); return; }
    const t = setInterval(() => setSeg((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seg, cargando, finalizar]);

  async function elegir(op: string) {
    const p = preguntas[idx];
    setResp((r) => ({ ...r, [p.id]: op }));
    api.post('/pretest/responder', { ejercicioId: p.id, opcion: op }).catch(() => undefined);
  }

  if (cargando) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-prexi-blue" /></div>;
  if (!preguntas.length) return <div className="grid min-h-screen place-items-center text-slate-400">No hay preguntas disponibles.</div>;

  const p = preguntas[idx]; const total = preguntas.length;
  const respondidas = preguntas.filter((q) => resp[q.id]).length;
  const alerta = seg <= 120; const mmss = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2 font-extrabold text-prexi-navy"><GraduationCap className="h-6 w-6 text-prexi-blue" /> Diagnóstico inicial</div>
          <div className="mx-4 hidden flex-1 sm:block">
            <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Pregunta {idx + 1} de {total}</span><span>{Math.round((respondidas / total) * 100)}% completado</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${(respondidas / total) * 100}%` }} /></div>
          </div>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${alerta ? 'animate-pulse-soft bg-red-50 text-red-600' : 'bg-blue-50 text-prexi-blue'}`}><Clock className="h-4 w-4" /> {mmss}</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card">
            <span className="text-xs font-bold uppercase tracking-wide text-prexi-blue">{p.categoria}</span>
            <h1 className="mb-4 mt-1 text-lg font-bold text-prexi-navy">{p.enunciado}</h1>
            {p.codigoPython && <div className="mb-5"><CodeBlock code={p.codigoPython} /></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              {p.opciones.map((o) => {
                const sel = resp[p.id] === o.id;
                return (
                  <button key={o.id} onClick={() => elegir(o.id)} className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition active:scale-[0.99] ${sel ? 'border-prexi-blue bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${sel ? 'bg-prexi-blue text-white' : 'bg-slate-100 text-slate-500'}`}>{o.id}</span>
                    <span className="whitespace-pre-line font-medium text-slate-700">{o.texto}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
              <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="btn-ghost disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button>
              {idx < total - 1 ? (
                <button onClick={() => setIdx((i) => i + 1)} className="btn-primary">Siguiente <ChevronRight className="h-4 w-4" /></button>
              ) : (
                <button onClick={finalizar} disabled={finalizando} className="btn-primary disabled:opacity-60">{finalizando ? 'Calculando…' : <>Finalizar <CheckCircle className="h-4 w-4" /></>}</button>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card">
            <h3 className="mb-3 text-sm font-bold text-prexi-navy">Tiempo y progreso</h3>
            <div className={`mb-3 rounded-xl p-3 text-center ${alerta ? 'bg-red-50' : 'bg-blue-50'}`}><p className={`text-2xl font-extrabold ${alerta ? 'text-red-600' : 'text-prexi-blue'}`}>{mmss}</p><p className="text-xs text-slate-500">tiempo restante</p></div>
            <p className="mb-2 text-xs text-slate-500">{respondidas} de {total} respondidas</p>
            <div className="grid grid-cols-10 gap-1.5">
              {preguntas.map((q, i) => (
                <button key={q.id} onClick={() => setIdx(i)} className={`aspect-square rounded-md text-[10px] font-bold transition ${i === idx ? 'bg-prexi-navy text-white' : resp[q.id] ? 'bg-prexi-green text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{i + 1}</button>
              ))}
            </div>
          </div>
          <div className="card flex items-start gap-3 bg-slate-50"><Bot className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" /><p className="text-sm text-slate-500"><b className="text-slate-600">Examen sin ayuda de IA</b>: ALEX está deshabilitado para medir tu nivel real.</p></div>
        </aside>
      </div>
    </div>
  );
}
