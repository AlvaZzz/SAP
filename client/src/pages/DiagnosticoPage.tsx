import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { DiagnosticoPregunta, DiagnosticoResultado } from '../lib/types';
import { useAuth } from '../context/AuthContext';

type Fase = 'bienvenida' | 'cuestionario' | 'resultado';

export default function DiagnosticoPage() {
  const { usuario, actualizarUsuario } = useAuth();
  const navigate = useNavigate();

  const [fase, setFase] = useState<Fase>('bienvenida');
  const [preguntas, setPreguntas] = useState<DiagnosticoPregunta[]>([]);
  const [indice, setIndice] = useState(0);
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  const [resultado, setResultado] = useState<DiagnosticoResultado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Si ya completó el diagnóstico, muestra su perfil al entrar aquí.
  const yaCompletado = useRef(usuario?.diagnostico_completado ?? false);
  useEffect(() => {
    if (yaCompletado.current) {
      api
        .get<{ completado: boolean; resultado: DiagnosticoResultado | null }>('/diagnostico/estado')
        .then((r) => {
          if (r.resultado) {
            setResultado(r.resultado);
            setFase('resultado');
          }
        })
        .catch(() => undefined);
    }
  }, []);

  // Docentes/admins no hacen diagnóstico.
  if (usuario && usuario.rol !== 'estudiante' && !yaCompletado.current) {
    return <Navigate to="/" replace />;
  }

  async function comenzar() {
    setCargando(true);
    setError('');
    try {
      const r = await api.get<{ preguntas: DiagnosticoPregunta[] }>('/diagnostico/preguntas');
      setPreguntas(r.preguntas);
      setIndice(0);
      setRespuestas({});
      setFase('cuestionario');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron generar las preguntas');
    } finally {
      setCargando(false);
    }
  }

  async function finalizar() {
    setCargando(true);
    setError('');
    try {
      const payload = {
        respuestas: preguntas.map((p) => ({ pregunta_id: p.id, opcion: respuestas[p.id] ?? '' })),
      };
      const r = await api.post<{ resultado: DiagnosticoResultado }>('/diagnostico/evaluar', payload);
      setResultado(r.resultado);
      setFase('resultado');
      await actualizarUsuario(); // abre el acceso a la app (diagnostico_completado = true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo evaluar el diagnóstico');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="mx-auto max-w-3xl py-8">
        {fase === 'bienvenida' && <Bienvenida onComenzar={comenzar} cargando={cargando} error={error} />}
        {fase === 'cuestionario' && (
          <Cuestionario
            preguntas={preguntas}
            indice={indice}
            setIndice={setIndice}
            respuestas={respuestas}
            setRespuestas={setRespuestas}
            onFinalizar={finalizar}
            cargando={cargando}
            error={error}
          />
        )}
        {fase === 'resultado' && resultado && (
          <Resultado resultado={resultado} onIr={() => navigate('/')} />
        )}
      </div>
    </div>
  );
}

// ── Estado 1: bienvenida ────────────────────────────────────
function Bienvenida({ onComenzar, cargando, error }: { onComenzar: () => void; cargando: boolean; error: string }) {
  return (
    <div className="card mx-auto max-w-xl text-center">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-prexi-blue text-3xl text-white">
        🤖
      </div>
      <h1 className="text-2xl font-extrabold text-prexi-navy">Diagnóstico inicial con IA</h1>
      <p className="mx-auto mt-3 max-w-md text-slate-500">
        Antes de empezar, ALEX te hará un breve cuestionario para medir tu nivel en programación y
        recomendarte por qué módulos empezar. Son <b>10 preguntas</b> y toma unos 5 minutos.
      </p>
      <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-slate-600">
        <li className="flex gap-2"><span>🎯</span> Sin nota: solo sirve para personalizar tu ruta.</li>
        <li className="flex gap-2"><span>🧠</span> La IA analiza tus respuestas y arma tu perfil.</li>
        <li className="flex gap-2"><span>🚀</span> Al terminar verás tu nivel y módulos sugeridos.</li>
      </ul>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button onClick={onComenzar} disabled={cargando} className="btn-primary mt-6 w-full">
        {cargando ? 'Generando preguntas…' : 'Comenzar diagnóstico →'}
      </button>
    </div>
  );
}

// ── Estado 2: cuestionario ──────────────────────────────────
function Cuestionario({
  preguntas, indice, setIndice, respuestas, setRespuestas, onFinalizar, cargando, error,
}: {
  preguntas: DiagnosticoPregunta[];
  indice: number;
  setIndice: (n: number) => void;
  respuestas: Record<number, string>;
  setRespuestas: (r: Record<number, string>) => void;
  onFinalizar: () => void;
  cargando: boolean;
  error: string;
}) {
  const [seg, setSeg] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mmss = `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

  const p = preguntas[indice];
  const total = preguntas.length;
  const esUltima = indice === total - 1;
  const todasRespondidas = preguntas.every((q) => respuestas[q.id]);
  const progreso = Math.round(((indice + 1) / total) * 100);

  function elegir(opcionId: string) {
    setRespuestas({ ...respuestas, [p.id]: opcionId });
  }

  return (
    <div>
      {/* Barra superior */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-prexi-navy">Pregunta {indice + 1} de {total}</span>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-600 shadow-sm">⏱ {mmss}</span>
      </div>
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${progreso}%` }} />
      </div>

      <div className="card">
        <span className="text-xs font-bold uppercase tracking-wide text-prexi-blue">{p.categoria}</span>
        <h2 className="mb-4 mt-1 text-lg font-bold text-prexi-navy">{p.enunciado}</h2>

        {p.pseudocodigo && (
          <pre className="mb-5 overflow-x-auto rounded-xl bg-prexi-navy p-4 text-sm leading-relaxed text-blue-50">
            <code>{p.pseudocodigo}</code>
          </pre>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {p.opciones.map((o) => {
            const elegido = respuestas[p.id] === o.id;
            return (
              <button
                key={o.id}
                onClick={() => elegir(o.id)}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                  elegido ? 'border-prexi-blue bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
                  elegido ? 'bg-prexi-blue text-white' : 'bg-slate-100 text-slate-500'
                }`}>{o.id}</span>
                <span className="font-medium text-slate-700">{o.texto}</span>
              </button>
            );
          })}
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setIndice(Math.max(0, indice - 1))}
            disabled={indice === 0}
            className="btn-ghost disabled:opacity-40"
          >
            ← Anterior
          </button>

          {!esUltima ? (
            <button onClick={() => setIndice(indice + 1)} className="btn-primary">Siguiente →</button>
          ) : (
            <button
              onClick={onFinalizar}
              disabled={!todasRespondidas || cargando}
              className="btn-primary disabled:opacity-50"
            >
              {cargando ? 'Evaluando con IA…' : 'Finalizar ✓'}
            </button>
          )}
        </div>
        {esUltima && !todasRespondidas && (
          <p className="mt-3 text-center text-xs text-slate-400">Responde todas las preguntas para finalizar.</p>
        )}
      </div>
    </div>
  );
}

// ── Estado 3: resultado ─────────────────────────────────────
const COLOR_NIVEL: Record<string, string> = {
  Principiante: '#f59e0b',
  Intermedio: '#2563eb',
  Avanzado: '#16a34a',
};

function Resultado({ resultado, onIr }: { resultado: DiagnosticoResultado; onIr: () => void }) {
  const color = COLOR_NIVEL[resultado.nivel] ?? '#2563eb';
  return (
    <div className="card mx-auto max-w-2xl text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-prexi-blue text-2xl text-white">🏅</div>
      <h1 className="text-2xl font-extrabold text-prexi-navy">¡Diagnóstico completado!</h1>
      <p className="mx-auto mt-2 max-w-md text-slate-500">{resultado.analisis_ia}</p>

      {/* Gráfico circular */}
      <div className="my-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Anillo puntaje={resultado.puntaje} color={color} />
        <span
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          ● Nivel {resultado.nivel}
        </span>
      </div>

      <div className="grid gap-4 text-left sm:grid-cols-2">
        <div className="rounded-xl bg-green-50 p-4">
          <h3 className="mb-2 font-bold text-prexi-green">✅ Fortalezas</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {resultado.fortalezas.map((f) => <li key={f}>• {f}</li>)}
          </ul>
        </div>
        <div className="rounded-xl bg-amber-50 p-4">
          <h3 className="mb-2 font-bold text-prexi-amber">📈 A reforzar</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {resultado.debilidades.length
              ? resultado.debilidades.map((d) => <li key={d}>• {d}</li>)
              : <li>¡Nada urgente, sigue así!</li>}
          </ul>
        </div>
      </div>

      {resultado.recomendaciones.length > 0 && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left">
          <h3 className="mb-2 font-bold text-prexi-navy">🚀 Módulos recomendados</h3>
          <div className="flex flex-wrap gap-2">
            {resultado.recomendaciones.map((r) => (
              <span key={r.nivel_id} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
                {r.titulo}
                <span className={`ml-2 text-xs ${r.prioridad === 'alta' ? 'text-red-500' : 'text-slate-400'}`}>
                  {r.prioridad}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <button onClick={onIr} className="btn-primary mt-6 w-full sm:w-auto">Ir a Mi Ruta →</button>
    </div>
  );
}

function Anillo({ puntaje, color }: { puntaje: number; color: string }) {
  const r = 52;
  const circ = useMemo(() => 2 * Math.PI * r, []);
  const offset = circ - (Math.min(100, Math.max(0, puntaje)) / 100) * circ;
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle
        cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text x="70" y="64" textAnchor="middle" className="fill-prexi-navy" fontSize="28" fontWeight="800">
        {puntaje}
      </text>
      <text x="70" y="86" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">
        PUNTOS
      </text>
    </svg>
  );
}
