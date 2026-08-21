'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { CodeBlock } from '@/components/code-block';
import { Clock, Bot, ChevronLeft, ChevronRight, CheckCircle, GraduationCap } from '@/components/icons';

interface Pregunta {
  id: number; categoria: string; estrellas: number; tipo: string;
  enunciado: string; codigoPython: string | null;
  opciones: { id: string; texto: string }[]; opcion_guardada: string | null;
}
const DURACION = 25 * 60;

export default function PostestPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [idx, setIdx] = useState(0);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [seg, setSeg] = useState(DURACION);
  const [cargando, setCargando] = useState(true);
  const [bloqueado, setBloqueado] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [errorFin, setErrorFin] = useState('');
  const yaFin = useRef(false);

  useEffect(() => {
    if (usuario && usuario.rol !== 'estudiante') { router.replace('/dashboard'); return; }
    api.get<{ disponible: boolean; habilitado: boolean; repasoCompletado: boolean; completado: boolean; desdeNivel: number }>('/postest/estado').then((e) => {
      if (e.completado) { router.replace('/postest/resultado'); return; }
      if (!e.habilitado) { setBloqueado('La evaluación final estará disponible cuando tu docente la habilite. Te avisaremos con una notificación.'); setCargando(false); return; }
      // Gate: el docente ya habilitó, pero falta revisar el repaso de cierre.
      if (!e.repasoCompletado) { router.replace('/postest/repaso'); return; }
      api.get<{ preguntas: Pregunta[] }>('/postest/preguntas').then((r) => {
        setPreguntas(r.preguntas);
        const ini: Record<number, string> = {};
        r.preguntas.forEach((p) => { if (p.opcion_guardada) ini[p.id] = p.opcion_guardada; });
        setResp(ini);
      }).finally(() => setCargando(false));
    }).catch(() => setCargando(false));
  }, [usuario, router]);

  const finalizar = useCallback(async () => {
    if (yaFin.current) return; yaFin.current = true; setFinalizando(true); setErrorFin('');
    try {
      await api.post('/postest/finalizar', { tiempoSeg: DURACION - seg });
      router.replace('/postest/resultado');
    } catch (err) {
      setErrorFin(err instanceof ApiError ? err.message : 'No se pudo finalizar. Intenta de nuevo.');
      setFinalizando(false); yaFin.current = false;
    }
  }, [router, seg]);

  // Finalización manual (botón): confirma si quedan preguntas sin responder.
  const finalizarManual = useCallback(() => {
    const sinResponder = preguntas.filter((q) => !resp[q.id]).length;
    if (sinResponder === preguntas.length) {
      setErrorFin('Responde al menos una pregunta antes de finalizar la evaluación.');
      return;
    }
    if (sinResponder > 0 && !window.confirm(`Te faltan ${sinResponder} pregunta(s) sin responder. ¿Deseas finalizar de todos modos?`)) return;
    finalizar();
  }, [preguntas, resp, finalizar]);

  useEffect(() => {
    if (cargando || bloqueado) return;
    if (seg <= 0) { finalizar(); return; }
    const t = setInterval(() => setSeg((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seg, cargando, bloqueado, finalizar]);

  async function elegir(op: string) {
    const p = preguntas[idx];
    setResp((r) => ({ ...r, [p.id]: op }));
    api.post('/postest/responder', { ejercicioId: p.id, opcion: op }).catch(() => undefined);
  }

  if (cargando) return <div className="grid min-h-screen place-items-center bg-app"><div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-prexi-blue" /></div>;
  if (bloqueado) return (
    <div className="grid min-h-screen place-items-center bg-app p-6 text-center">
      <div className="card max-w-md">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-prexi-blue/10 text-prexi-blue-deep"><GraduationCap className="h-7 w-7" /></div>
        <h1 className="text-xl font-bold text-fg">Evaluación final aún no disponible</h1>
        <p className="mt-2 text-sm text-muted">{bloqueado}</p>
        <button onClick={() => router.push('/dashboard')} className="btn-primary mt-5">Volver al dashboard</button>
      </div>
    </div>
  );
  if (!preguntas.length) return <div className="grid min-h-screen place-items-center text-muted">No hay preguntas disponibles.</div>;

  const p = preguntas[idx]; const total = preguntas.length;
  const respondidas = preguntas.filter((q) => resp[q.id]).length;
  const alerta = seg <= 120; const mmss = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-10 border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2 font-extrabold text-fg"><GraduationCap className="h-6 w-6 text-prexi-blue-deep" /> Evaluación final</div>
          <div className="mx-4 hidden flex-1 sm:block">
            <div className="mb-1 flex justify-between text-xs text-muted"><span>Pregunta {idx + 1} de {total}</span><span>{Math.round((respondidas / total) * 100)}% completado</span></div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${(respondidas / total) * 100}%` }} /></div>
          </div>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${alerta ? 'animate-pulse-soft bg-red-500/10 text-red-600' : 'bg-prexi-blue/10 text-prexi-blue-deep'}`}><Clock className="h-4 w-4" /> {mmss}</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card">
            <span className="text-xs font-bold uppercase tracking-wide text-prexi-blue-deep">{p.categoria}</span>
            <h1 className="mb-4 mt-1 text-lg font-bold text-fg">{p.enunciado}</h1>
            {p.codigoPython && <div className="mb-5"><CodeBlock code={p.codigoPython} /></div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {p.opciones.map((o) => {
                const sel = resp[p.id] === o.id;
                return (
                  <button key={o.id} onClick={() => elegir(o.id)} className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition active:scale-[0.99] ${sel ? 'border-prexi-blue bg-prexi-blue/10' : 'border-line hover:border-prexi-blue/40'}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${sel ? 'bg-prexi-blue text-white' : 'bg-subtle text-muted'}`}>{o.id}</span>
                    <span className="whitespace-pre-line font-medium text-fg">{o.texto}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
              <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="btn-ghost disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button>
              {idx < total - 1 ? (
                <button onClick={() => setIdx((i) => i + 1)} className="btn-primary">Siguiente <ChevronRight className="h-4 w-4" /></button>
              ) : (
                <button onClick={finalizarManual} disabled={finalizando} className="btn-primary disabled:opacity-60">{finalizando ? 'Calculando…' : <>Finalizar <CheckCircle className="h-4 w-4" /></>}</button>
              )}
            </div>
            {errorFin && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{errorFin}</p>}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card">
            <h3 className="mb-3 text-sm font-bold text-fg">Tiempo y progreso</h3>
            <div className={`mb-3 rounded-xl p-3 text-center ${alerta ? 'bg-red-500/10' : 'bg-prexi-blue/10'}`}><p className={`text-2xl font-extrabold ${alerta ? 'text-red-600' : 'text-prexi-blue-deep'}`}>{mmss}</p><p className="text-xs text-muted">tiempo restante</p></div>
            <p className="mb-2 text-xs text-muted">{respondidas} de {total} respondidas</p>
            <div className="grid grid-cols-10 gap-1.5">
              {preguntas.map((q, i) => (
                <button key={q.id} onClick={() => setIdx(i)} className={`aspect-square rounded-md text-[10px] font-bold transition ${i === idx ? 'bg-prexi-blue text-accent-on' : resp[q.id] ? 'bg-prexi-green text-white' : 'bg-subtle text-muted hover:bg-line'}`}>{i + 1}</button>
              ))}
            </div>
          </div>
          <div className="card flex items-start gap-3 bg-subtle"><Bot className="mt-0.5 h-5 w-5 shrink-0 text-muted" /><p className="text-sm text-muted"><b className="text-fg">Examen sin ayuda de IA</b>: PREXI está deshabilitado para medir tu avance real.</p></div>
        </aside>
      </div>
    </div>
  );
}
