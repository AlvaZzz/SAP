import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { EjercicioPublico, ResultadoIntento } from '../lib/types';
import { AlexTutor } from '../components/AlexTutor';

export default function PlayPage() {
  const { id } = useParams();
  const ejercicioId = Number(id);

  const [ej, setEj] = useState<EjercicioPublico | null>(null);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoIntento | null>(null);
  const [retro, setRetro] = useState<string | null>(null);
  const [fallidos, setFallidos] = useState(0);
  const [inicio] = useState(() => Date.now());
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setResultado(null);
    setRetro(null);
    setSeleccion(null);
    api.get<{ ejercicio: EjercicioPublico }>(`/ejercicios/${ejercicioId}`).then((r) => setEj(r.ejercicio));
  }, [ejercicioId]);

  async function enviar() {
    if (!seleccion || !ej) return;
    setEnviando(true);
    try {
      const r = await api.post<ResultadoIntento>('/intentos', {
        ejercicio_id: ej.id,
        respuesta_dada: seleccion,
        tiempo_seg: Math.round((Date.now() - inicio) / 1000),
        uso_pistas: false,
      });
      setResultado(r);

      if (!r.correcto) {
        setFallidos((f) => f + 1);
        // Pide retroalimentación de ALEX sobre el error.
        try {
          const fb = await api.post<{ explicacion: string }>('/ai/retroalimentacion', {
            ejercicio_id: ej.id,
            respuesta_estudiante: seleccion,
            respuesta_correcta: r.respuesta_correcta,
            codigo_pseudocodigo: ej.pseudocodigo ?? undefined,
          });
          setRetro(fb.explicacion);
        } catch {
          setRetro(r.explicacion_base);
        }
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Error al enviar');
    } finally {
      setEnviando(false);
    }
  }

  if (!ej) return <p className="text-slate-400">Cargando ejercicio…</p>;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
      {/* Enunciado + opciones */}
      <div className="lg:col-span-2">
        <Link to="/ejercicios" className="mb-4 inline-block text-sm text-prexi-blue">← Volver a ejercicios</Link>
        <div className="card">
          <span className="text-xs font-bold uppercase tracking-wide text-prexi-blue">
            {ej.categoria} · {ej.dificultad}
          </span>
          <h1 className="mb-4 mt-1 text-xl font-bold text-prexi-navy">{ej.enunciado}</h1>

          {ej.pseudocodigo && (
            <pre className="mb-5 overflow-x-auto rounded-xl bg-prexi-navy p-4 text-sm leading-relaxed text-blue-50">
              <code>{ej.pseudocodigo}</code>
            </pre>
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
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                    esCorrecta
                      ? 'border-prexi-green bg-green-50'
                      : esIncorrectaElegida
                      ? 'border-red-400 bg-red-50'
                      : elegido
                      ? 'border-prexi-blue bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
                      elegido || esCorrecta ? 'bg-prexi-blue text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {o.id}
                  </span>
                  <span className="font-medium text-slate-700">{o.texto}</span>
                </button>
              );
            })}
          </div>

          {!resultado ? (
            <button onClick={enviar} disabled={!seleccion || enviando} className="btn-primary mt-6 w-full sm:w-auto">
              {enviando ? 'Enviando…' : 'Enviar respuesta'}
            </button>
          ) : (
            <Resultado resultado={resultado} retro={retro} />
          )}
        </div>
      </div>

      {/* ALEX */}
      <div>
        <AlexTutor
          ejercicioId={ej.id}
          contextoTema={ej.categoria}
          maxPistas={ej.max_pistas}
          intentosFallidos={fallidos}
        />
      </div>
    </div>
  );
}

function Resultado({ resultado, retro }: { resultado: ResultadoIntento; retro: string | null }) {
  return (
    <div className="mt-6">
      {resultado.correcto ? (
        <div className="rounded-xl bg-green-50 p-4">
          <p className="font-bold text-prexi-green">¡Correcto! 🎉</p>
          <p className="text-sm text-slate-600">
            +{resultado.xp.xpOtorgado} XP (base {resultado.xp.xpBase} × {resultado.xp.multiplicador} por racha de{' '}
            {resultado.xp.rachaDias} días). Total: {resultado.xp.xpTotal} XP.
          </p>
          {resultado.nivel.nivelDesbloqueadoNumero && (
            <p className="mt-1 text-sm font-semibold text-prexi-blue">
              🔓 ¡Desbloqueaste el Nivel {resultado.nivel.nivelDesbloqueadoNumero}!
            </p>
          )}
          {resultado.logros_nuevos.length > 0 && (
            <p className="mt-1 text-sm text-prexi-amber">🏅 Nuevas insignias: {resultado.logros_nuevos.join(', ')}</p>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-red-50 p-4">
          <p className="font-bold text-red-600">No es correcta esta vez.</p>
          {retro && (
            <p className="mt-1 text-sm text-slate-600">
              <span className="font-semibold text-prexi-navy">ALEX:</span> {retro}
            </p>
          )}
        </div>
      )}

      <p className="mt-3 text-sm text-slate-500">{resultado.recomendacion.mensaje}</p>

      <Link to="/ejercicios" className="btn-ghost mt-4">
        Siguiente →
      </Link>
    </div>
  );
}
