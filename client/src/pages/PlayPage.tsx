import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { EjercicioPublico, ResultadoIntento } from '../lib/types';
import { AlexTutor } from '../components/AlexTutor';
import { RankingVivo } from '../components/RankingVivo';
import { CodeBlock } from '../components/CodeBlock';
import { X, Clock, HelpCircle, Code, CheckCircle, ArrowRight, ChevronLeft } from '../components/icons';

export default function PlayPage() {
  const { id } = useParams();
  const ejercicioId = Number(id);
  const navigate = useNavigate();

  const [ej, setEj] = useState<EjercicioPublico | null>(null);
  const [orden, setOrden] = useState<{ indice: number; total: number; ids: number[] }>({ indice: 0, total: 1, ids: [] });
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoIntento | null>(null);
  const [retro, setRetro] = useState<string | null>(null);
  const [fallidos, setFallidos] = useState(0);
  const [seg, setSeg] = useState(0);
  const [enviando, setEnviando] = useState(false);

  // Cronómetro
  useEffect(() => {
    const t = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [ejercicioId]);
  const mmss = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

  useEffect(() => {
    setResultado(null); setRetro(null); setSeleccion(null); setSeg(0);
    api.get<{ ejercicio: EjercicioPublico }>(`/ejercicios/${ejercicioId}`).then((r) => {
      setEj(r.ejercicio);
      // Posición "Pregunta X de Y" dentro del nivel.
      api.get<{ ejercicios: EjercicioPublico[] }>(`/ejercicios?nivel=${r.ejercicio.nivel_id}`).then((lr) => {
        const ids = lr.ejercicios.map((e) => e.id);
        const idx = ids.indexOf(r.ejercicio.id);
        setOrden({ indice: idx < 0 ? 0 : idx, total: ids.length || 1, ids });
      }).catch(() => undefined);
    });
  }, [ejercicioId]);

  function irRelativo(delta: number) {
    const next = orden.ids[orden.indice + delta];
    if (next) navigate(`/ejercicios/${next}`);
  }

  async function enviar() {
    if (!seleccion || !ej) return;
    setEnviando(true);
    try {
      const r = await api.post<ResultadoIntento>('/intentos', {
        ejercicio_id: ej.id, respuesta_dada: seleccion,
        tiempo_seg: seg, uso_pistas: false,
      });
      setResultado(r);
      if (!r.correcto) {
        setFallidos((f) => f + 1);
        try {
          const fb = await api.post<{ explicacion: string }>('/ai/retroalimentacion', {
            ejercicio_id: ej.id, respuesta_estudiante: seleccion,
            respuesta_correcta: r.respuesta_correcta, codigo_pseudocodigo: ej.pseudocodigo ?? undefined,
          });
          setRetro(fb.explicacion);
        } catch { setRetro(r.explicacion_base); }
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Error al enviar');
    } finally { setEnviando(false); }
  }

  if (!ej) return <p className="text-slate-400">Cargando ejercicio…</p>;

  const progreso = Math.round(((orden.indice + 1) / orden.total) * 100);
  const hayPrev = orden.indice > 0;
  const haySig = orden.indice < orden.total - 1;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header del cuestionario */}
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button onClick={() => navigate('/ejercicios')} className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50" title="Salir">
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-sm font-semibold text-prexi-navy">Pregunta {orden.indice + 1} de {orden.total}</p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${progreso}%` }} />
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-prexi-blue">
          <Clock className="h-4 w-4" /> {mmss}
        </span>
        <button className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-slate-50" title="Ayuda">
          <HelpCircle className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ejercicio */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-prexi-blue">
              <Code className="h-4 w-4" /> {ej.categoria} · Python
              <span className="text-prexi-amber">{'★'.repeat(ej.estrellas)}</span>
            </div>
            <h1 className="mb-5 text-xl font-bold text-prexi-navy">{ej.enunciado}</h1>

            {(ej.codigo_python ?? ej.pseudocodigo) && (
              <div className="mb-5"><CodeBlock code={(ej.codigo_python ?? ej.pseudocodigo)!} /></div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {ej.opciones.map((o) => {
                const elegido = seleccion === o.id;
                const esCorrecta = resultado && o.id === resultado.respuesta_correcta;
                const esIncorrectaElegida = resultado && elegido && !resultado.correcto;
                return (
                  <button
                    key={o.id}
                    disabled={!!resultado}
                    onClick={() => setSeleccion(o.id)}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${
                      esCorrecta ? 'border-prexi-green bg-green-50'
                      : esIncorrectaElegida ? 'border-red-400 bg-red-50'
                      : elegido ? 'border-prexi-blue bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      esCorrecta ? 'bg-prexi-green text-white'
                      : elegido ? 'bg-prexi-blue text-white' : 'bg-slate-100 text-slate-500'
                    }`}>{o.id}</span>
                    <span className="whitespace-pre-line font-medium text-slate-700">{o.texto}</span>
                  </button>
                );
              })}
            </div>

            {resultado && <Feedback resultado={resultado} retro={retro} />}

            {/* Navegación */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
              <button onClick={() => irRelativo(-1)} disabled={!hayPrev}
                className="btn-ghost disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              {!resultado ? (
                <button onClick={enviar} disabled={!seleccion || enviando} className="btn-primary disabled:opacity-50">
                  {enviando ? 'Enviando…' : 'Enviar respuesta'}
                </button>
              ) : haySig ? (
                <button onClick={() => irRelativo(1)} className="btn-primary">Siguiente <ArrowRight className="h-4 w-4" /></button>
              ) : (
                <Link to="/ejercicios" className="btn-primary">Finalizar <CheckCircle className="h-4 w-4" /></Link>
              )}
            </div>
          </div>

          <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400">
            <span>© {new Date().getFullYear()} PREXI — UPEA Ingeniería de Sistemas</span>
            <span className="flex gap-4"><a href="#" className="hover:text-slate-600">Privacidad</a><a href="#" className="hover:text-slate-600">Soporte</a></span>
          </footer>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <AlexTutor ejercicioId={ej.id} contextoTema={ej.categoria} maxPistas={ej.max_pistas} intentosFallidos={fallidos} />
          <RankingVivo />
        </div>
      </div>
    </div>
  );
}

function Feedback({ resultado, retro }: { resultado: ResultadoIntento; retro: string | null }) {
  return (
    <div className="mt-5">
      {resultado.correcto ? (
        <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4">
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-prexi-green" />
          <div>
            <p className="font-bold text-prexi-green">¡Correcto! 🎉</p>
            <p className="text-sm text-slate-600">
              +{resultado.xp.xpOtorgado} XP (base {resultado.xp.xpBase} × {resultado.xp.multiplicador} por racha de {resultado.xp.rachaDias} días).
            </p>
            {resultado.nivel.nivelDesbloqueadoNumero && (
              <p className="mt-1 text-sm font-semibold text-prexi-blue">🔓 ¡Desbloqueaste el Nivel {resultado.nivel.nivelDesbloqueadoNumero}!</p>
            )}
            {resultado.logros_nuevos.length > 0 && (
              <p className="mt-1 text-sm text-prexi-amber">🏅 Nuevas insignias: {resultado.logros_nuevos.join(', ')}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-red-50 p-4">
          <p className="font-bold text-red-600">No es correcta esta vez.</p>
          {retro && <p className="mt-1 text-sm text-slate-600"><span className="font-semibold text-prexi-navy">ALEX:</span> {retro}</p>}
        </div>
      )}
      <p className="mt-3 text-sm text-slate-500">{resultado.recomendacion.mensaje}</p>
    </div>
  );
}
