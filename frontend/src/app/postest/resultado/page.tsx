'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Award, CheckCircle, TrendingUp, ArrowRight, ClipboardList } from '@/components/icons';

interface Resultado {
  puntaje: number; aciertos: number; total: number; avance: number | null;
  por_categoria: { categoria: string; aciertos: number; total: number; porcentaje: number }[];
  fortalezas: string[]; debilidades: string[];
}

export default function PostestResultadoPage() {
  const router = useRouter();
  const [r, setR] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ completado: boolean; resultado: Resultado | null }>('/postest/estado')
      .then((e) => { if (!e.completado || !e.resultado) router.replace('/dashboard'); else setR(e.resultado); })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setCargando(false));
  }, [router]);

  if (cargando || !r) return <div className="grid min-h-screen place-items-center bg-app text-muted">Cargando…</div>;
  const avancePos = r.avance != null && r.avance >= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-app to-prexi-blue/5 p-4">
      <div className="mx-auto max-w-2xl py-8">
        <div className="card animate-fade-up text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-prexi-green text-white"><Award className="h-7 w-7" /></div>
          <h1 className="text-2xl font-extrabold text-fg">¡Evaluación final completada!</h1>
          <p className="mx-auto mt-1 max-w-md text-muted">Acertaste {r.aciertos} de {r.total} preguntas.</p>

          <div className="my-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Gauge puntaje={r.puntaje} color="#10B981" />
            <div className="text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-prexi-green px-4 py-1.5 text-sm font-bold text-white">Puntaje {r.puntaje}/100</span>
              {r.avance != null && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                  <TrendingUp className={`h-4 w-4 ${avancePos ? 'text-prexi-green' : 'text-prexi-amber'}`} />
                  Progreso vs. pretest: <b className={avancePos ? 'text-prexi-green' : 'text-prexi-amber'}>{avancePos ? '+' : ''}{r.avance} pts</b>
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 text-left sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-500/10 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-bold text-prexi-green"><CheckCircle className="h-4 w-4" /> Fortalezas</h3>
              <ul className="space-y-1 text-sm text-fg">{r.fortalezas.length ? r.fortalezas.map((c) => <li key={c}>• {c}</li>) : <li>Sigue practicando.</li>}</ul>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-bold text-prexi-amber"><TrendingUp className="h-4 w-4" /> A reforzar</h3>
              <ul className="space-y-1 text-sm text-fg">{r.debilidades.length ? r.debilidades.map((c) => <li key={c}>• {c}</li>) : <li>¡Excelente!</li>}</ul>
            </div>
          </div>

          <div className="mt-5 space-y-2 text-left">
            {r.por_categoria.map((c) => (
              <div key={c.categoria}>
                <div className="mb-0.5 flex justify-between text-xs"><span className="font-medium text-fg">{c.categoria}</span><span className="text-muted">{c.aciertos}/{c.total} · {c.porcentaje}%</span></div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.porcentaje}%`, backgroundColor: c.porcentaje >= 60 ? '#10B981' : '#F59E0B' }} /></div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={() => router.push('/postest/revision')} className="btn-ghost w-full sm:w-auto"><ClipboardList className="h-4 w-4" /> Revisar mis respuestas</button>
            <button onClick={() => router.push('/dashboard')} className="btn-primary w-full sm:w-auto">Ir al dashboard <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gauge({ puntaje, color }: { puntaje: number; color: string }) {
  const r = 52; const circ = useMemo(() => 2 * Math.PI * r, []);
  const offset = circ - (Math.min(100, Math.max(0, puntaje)) / 100) * circ;
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="70" y="64" textAnchor="middle" className="fill-fg" fontSize="28" fontWeight="800">{puntaje}</text>
      <text x="70" y="86" textAnchor="middle" fill="rgb(var(--muted))" fontSize="11" fontWeight="600">PUNTOS</text>
    </svg>
  );
}
