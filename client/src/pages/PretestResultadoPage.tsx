import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Award, CheckCircle, TrendingUp, ArrowRight } from '../components/icons';

interface Resultado {
  puntaje: number;
  nivel: 'Bajo' | 'Medio' | 'Alto';
  nivel_inicial: number;
  aciertos: number;
  total: number;
  por_categoria: { categoria: string; aciertos: number; total: number; porcentaje: number }[];
  fortalezas: string[];
  debilidades: string[];
}

const COLOR: Record<string, string> = { Bajo: '#f59e0b', Medio: '#2563eb', Alto: '#16a34a' };

export default function PretestResultadoPage() {
  const navigate = useNavigate();
  const [r, setR] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ completado: boolean; resultado: Resultado | null }>('/pretest/estado')
      .then((e) => { if (!e.completado || !e.resultado) navigate('/pretest', { replace: true }); else setR(e.resultado); })
      .catch(() => navigate('/', { replace: true }))
      .finally(() => setCargando(false));
  }, []);

  if (cargando || !r) {
    return <div className="grid min-h-screen place-items-center bg-[#f8fafc] text-slate-400">Cargando resultado…</div>;
  }
  const color = COLOR[r.nivel];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="mx-auto max-w-2xl py-8">
        <div className="card text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-prexi-blue text-white"><Award className="h-7 w-7" /></div>
          <h1 className="text-2xl font-extrabold text-prexi-navy">¡Diagnóstico completado!</h1>
          <p className="mx-auto mt-1 max-w-md text-slate-500">
            Mediste tu nivel inicial en Python. Acertaste {r.aciertos} de {r.total} preguntas.
          </p>

          <div className="my-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Gauge puntaje={r.puntaje} color={color} />
            <div className="text-left">
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold text-white" style={{ backgroundColor: color }}>
                Nivel {r.nivel}
              </span>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                <TrendingUp className="h-4 w-4 text-prexi-green" /> Empiezas en el <b className="text-prexi-navy">Nivel {r.nivel_inicial}</b> de tu ruta.
              </p>
            </div>
          </div>

          <div className="grid gap-4 text-left sm:grid-cols-2">
            <div className="rounded-xl bg-green-50 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-bold text-prexi-green"><CheckCircle className="h-4 w-4" /> Fortalezas</h3>
              <ul className="space-y-1 text-sm text-slate-700">
                {r.fortalezas.length ? r.fortalezas.map((c) => <li key={c}>• {c}</li>) : <li>Sigue practicando para destacar.</li>}
              </ul>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-bold text-prexi-amber"><TrendingUp className="h-4 w-4" /> A reforzar</h3>
              <ul className="space-y-1 text-sm text-slate-700">
                {r.debilidades.length ? r.debilidades.map((c) => <li key={c}>• {c}</li>) : <li>¡Excelente desempeño general!</li>}
              </ul>
            </div>
          </div>

          {/* Desglose por categoría */}
          <div className="mt-5 space-y-2 text-left">
            {r.por_categoria.map((c) => (
              <div key={c.categoria}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="font-medium text-slate-600">{c.categoria}</span>
                  <span className="text-slate-400">{c.aciertos}/{c.total} · {c.porcentaje}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${c.porcentaje}%`, backgroundColor: c.porcentaje >= 60 ? '#16a34a' : '#f59e0b' }} />
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => navigate('/')} className="btn-primary mt-7 w-full sm:w-auto">
            Ir a Mi Ruta de Aprendizaje <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Gauge({ puntaje, color }: { puntaje: number; color: string }) {
  const r = 52;
  const circ = useMemo(() => 2 * Math.PI * r, []);
  const offset = circ - (Math.min(100, Math.max(0, puntaje)) / 100) * circ;
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="70" y="64" textAnchor="middle" className="fill-prexi-navy" fontSize="28" fontWeight="800">{puntaje}</text>
      <text x="70" y="86" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">PUNTOS</text>
    </svg>
  );
}
