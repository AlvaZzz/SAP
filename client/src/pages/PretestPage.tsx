import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CodeBlock } from '../components/CodeBlock';
import { Clock, Bot, ChevronLeft, ChevronRight, CheckCircle, GraduationCap } from '../components/icons';

interface PreguntaPretest {
  id: number; categoria: string; estrellas: number; tipo: string;
  enunciado: string; codigo_python: string | null;
  opciones: { id: string; texto: string }[]; opcion_guardada: string | null;
}

const DURACION = 25 * 60; // 25 minutos

export default function PretestPage() {
  const { usuario, actualizarUsuario } = useAuth();
  const navigate = useNavigate();

  const [preguntas, setPreguntas] = useState<PreguntaPretest[]>([]);
  const [idx, setIdx] = useState(0);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [seg, setSeg] = useState(DURACION);
  const [cargando, setCargando] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [error, setError] = useState('');
  const yaFinalizando = useRef(false);

  // Carga inicial: si ya completó, va al resultado; si no, trae preguntas.
  useEffect(() => {
    if (usuario && usuario.rol !== 'estudiante') { navigate('/', { replace: true }); return; }
    api.get<{ completado: boolean }>('/pretest/estado').then((est) => {
      if (est.completado) { navigate('/pretest/resultado', { replace: true }); return; }
      api.get<{ preguntas: PreguntaPretest[] }>('/pretest/preguntas')
        .then((r) => {
          setPreguntas(r.preguntas);
          const inicial: Record<number, string> = {};
          r.preguntas.forEach((p) => { if (p.opcion_guardada) inicial[p.id] = p.opcion_guardada; });
          setResp(inicial);
        })
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false));
    }).catch((e) => { setError(e.message); setCargando(false); });
  }, []);

  const finalizar = useCallback(async () => {
    if (yaFinalizando.current) return;
    yaFinalizando.current = true;
    setFinalizando(true);
    try {
      await api.post('/pretest/finalizar');
      await actualizarUsuario();
      navigate('/pretest/resultado', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo finalizar');
      setFinalizando(false);
      yaFinalizando.current = false;
    }
  }, [actualizarUsuario, navigate]);

  // Cronómetro descendente; al llegar a 0, finaliza automáticamente.
  useEffect(() => {
    if (cargando) return;
    if (seg <= 0) { finalizar(); return; }
    const t = setInterval(() => setSeg((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seg, cargando, finalizar]);

  async function elegir(opcionId: string) {
    const p = preguntas[idx];
    setResp((r) => ({ ...r, [p.id]: opcionId }));
    try { await api.post('/pretest/responder', { ejercicio_id: p.id, opcion: opcionId }); } catch { /* autosave best-effort */ }
  }

  if (cargando) return <PantallaCarga />;
  if (error && !preguntas.length) return <div className="grid h-screen place-items-center text-red-500">{error}</div>;

  const p = preguntas[idx];
  const total = preguntas.length;
  const respondidas = preguntas.filter((q) => resp[q.id]).length;
  const alerta = seg <= 120;
  const mmss = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Barra superior */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2 font-extrabold text-prexi-navy">
            <GraduationCap className="h-6 w-6 text-prexi-blue" /> Diagnóstico inicial
          </div>
          <div className="mx-4 hidden flex-1 sm:block">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Pregunta {idx + 1} de {total}</span>
              <span>{Math.round((respondidas / total) * 100)}% completado</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${(respondidas / total) * 100}%` }} />
            </div>
          </div>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
            alerta ? 'animate-pulse bg-red-50 text-red-600' : 'bg-blue-50 text-prexi-blue'}`}>
            <Clock className="h-4 w-4" /> {mmss}
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-5 lg:grid-cols-3">
        {/* Pregunta */}
        <div className="lg:col-span-2">
          <div className="card">
            <span className="text-xs font-bold uppercase tracking-wide text-prexi-blue">{p.categoria}</span>
            <h1 className="mb-4 mt-1 text-lg font-bold text-prexi-navy">{p.enunciado}</h1>
            {p.codigo_python && <div className="mb-5"><CodeBlock code={p.codigo_python} /></div>}

            <div className="grid gap-3 sm:grid-cols-2">
              {p.opciones.map((o) => {
                const sel = resp[p.id] === o.id;
                return (
                  <button key={o.id} onClick={() => elegir(o.id)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
                      sel ? 'border-prexi-blue bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      sel ? 'bg-prexi-blue text-white' : 'bg-slate-100 text-slate-500'}`}>{o.id}</span>
                    <span className="whitespace-pre-line font-medium text-slate-700">{o.texto}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
              <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="btn-ghost disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              {idx < total - 1 ? (
                <button onClick={() => setIdx((i) => i + 1)} className="btn-primary">Siguiente <ChevronRight className="h-4 w-4" /></button>
              ) : (
                <button onClick={finalizar} disabled={finalizando} className="btn-primary disabled:opacity-60">
                  {finalizando ? 'Calculando…' : <>Finalizar diagnóstico <CheckCircle className="h-4 w-4" /></>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Panel lateral */}
        <aside className="space-y-4">
          <div className="card">
            <h3 className="mb-3 text-sm font-bold text-prexi-navy">Tiempo y progreso</h3>
            <div className={`mb-3 rounded-xl p-3 text-center ${alerta ? 'bg-red-50' : 'bg-blue-50'}`}>
              <p className={`text-2xl font-extrabold ${alerta ? 'text-red-600' : 'text-prexi-blue'}`}>{mmss}</p>
              <p className="text-xs text-slate-500">tiempo restante</p>
            </div>
            <p className="mb-2 text-xs text-slate-500">{respondidas} de {total} respondidas</p>
            <div className="grid grid-cols-10 gap-1.5">
              {preguntas.map((q, i) => (
                <button key={q.id} onClick={() => setIdx(i)}
                  className={`aspect-square rounded-md text-[10px] font-bold transition ${
                    i === idx ? 'bg-prexi-navy text-white'
                    : resp[q.id] ? 'bg-prexi-green text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="card flex items-start gap-3 bg-slate-50">
            <Bot className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-500">
              <b className="text-slate-600">ALEX está deshabilitado</b> durante el diagnóstico: este examen mide tu nivel real, sin ayuda.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PantallaCarga() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f8fafc]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-prexi-blue" />
        <p className="text-slate-500">Preparando tu diagnóstico…</p>
      </div>
    </div>
  );
}
