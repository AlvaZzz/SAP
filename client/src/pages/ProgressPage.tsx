import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Nivel } from '../lib/types';
import { TrendingUp, Sparkles, CheckCircle, Lock, Play } from '../components/icons';

interface Comparativa {
  comparativa: { categoria: string; pretest: number | null; postest: number | null; mejora: number | null }[];
  pretest_total: number | null;
  postest_total: number | null;
  ganancia: number | null;
}

export default function ProgressPage() {
  const [data, setData] = useState<Comparativa | null>(null);
  const [niveles, setNiveles] = useState<Nivel[]>([]);

  useEffect(() => {
    api.get<Comparativa>('/pretest/comparativa').then(setData).catch(() => undefined);
    api.get<{ niveles: Nivel[] }>('/niveles').then((r) => setNiveles(r.niveles)).catch(() => undefined);
  }, []);

  const radar = (data?.comparativa ?? [])
    .filter((c) => c.postest != null)
    .map((c) => ({ etiqueta: c.categoria, pre: c.pretest ?? 0, post: c.postest ?? 0 }));

  const masFuerte = [...(data?.comparativa ?? [])].sort((a, b) => (b.postest ?? 0) - (a.postest ?? 0))[0];
  const masDebil = [...(data?.comparativa ?? [])].sort((a, b) => (a.postest ?? 0) - (b.postest ?? 0))[0];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Banner */}
      <div className="card mb-6 border-0 bg-gradient-to-r from-prexi-navy to-prexi-blue text-white">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Reporte semestral</span>
            <h1 className="mt-2 text-2xl font-extrabold">Tu progreso académico</h1>
            <p className="text-sm text-blue-100/80">Crecimiento entre tu evaluación inicial y la final.</p>
          </div>
          <div className="flex items-center gap-6">
            <div><p className="text-[11px] uppercase text-blue-200/70">Pretest</p><p className="text-2xl font-extrabold">{data?.pretest_total ?? '—'}</p></div>
            <div><p className="text-[11px] uppercase text-blue-200/70">Postest</p><p className="text-2xl font-extrabold">{data?.postest_total ?? '—'}</p></div>
            <div className="rounded-2xl bg-prexi-green px-5 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <TrendingUp className="h-5 w-5" />
                <p className="text-2xl font-extrabold">{data?.ganancia != null ? `+${data.ganancia}` : '—'}</p>
              </div>
              <p className="text-[11px] text-green-50">puntos de mejora</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Comparativa por tema */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-prexi-navy">Comparativa por tema</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-blue" /> Pretest</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-green" /> Postest</span>
            </div>
          </div>
          {!data?.comparativa.length && <p className="text-sm text-slate-400">Aún no hay registros de pre/postest.</p>}
          <div className="space-y-4">
            {data?.comparativa.map((c) => (
              <div key={c.categoria}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{c.categoria}</span>
                  {c.mejora != null && <span className="font-semibold text-prexi-green">+{c.mejora}% mejora</span>}
                </div>
                <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-prexi-blue" style={{ width: `${c.pretest ?? 0}%` }} />
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-prexi-green" style={{ width: `${c.postest ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Radar de competencias */}
        <div className="card">
          <h2 className="mb-1 text-lg font-bold text-prexi-navy">Radar de competencias</h2>
          <p className="mb-2 text-sm text-slate-500">Visualización 360° de tus habilidades.</p>
          {radar.length >= 3 ? <Radar datos={radar} /> : <p className="py-12 text-center text-sm text-slate-400">Se necesitan al menos 3 categorías evaluadas.</p>}
          {masFuerte && masDebil && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-slate-600">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue" />
              <span>Tu punto más fuerte es <b className="text-prexi-navy">{masFuerte.categoria}</b>. Recomendamos reforzar <b className="text-prexi-navy">{masDebil.categoria}</b>.</span>
            </div>
          )}
        </div>
      </div>

      {/* Progreso por nivel */}
      <h2 className="mb-3 mt-7 text-lg font-bold text-prexi-navy">Progreso por nivel</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[...niveles].sort((a, b) => a.numero - b.numero).map((n) => {
          const completo = n.ejercicios_completados >= n.umbral;
          const enProgreso = n.desbloqueado && !completo;
          return (
            <div key={n.id} className={`rounded-2xl border bg-white p-4 ${enProgreso ? 'border-prexi-blue ring-1 ring-blue-100' : 'border-slate-200'} ${!n.desbloqueado ? 'opacity-70' : ''}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Nivel {n.numero}</span>
                {completo ? <CheckCircle className="h-4 w-4 text-prexi-green" /> : enProgreso ? <Play className="h-4 w-4 text-prexi-blue" /> : <Lock className="h-4 w-4 text-slate-300" />}
              </div>
              <p className="text-sm font-semibold leading-tight text-prexi-navy">{n.titulo}</p>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                completo ? 'bg-green-100 text-prexi-green' : enProgreso ? 'bg-blue-100 text-prexi-blue' : 'bg-slate-100 text-slate-400'
              }`}>
                {completo ? 'Completado' : enProgreso ? 'En progreso' : 'Bloqueado'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Radar SVG ───────────────────────────────────────────────
function Radar({ datos }: { datos: { etiqueta: string; pre: number; post: number }[] }) {
  const size = 280, cx = size / 2, cy = size / 2, R = 95;
  const n = datos.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const punto = (i: number, valor: number) => {
    const r = (valor / 100) * R;
    return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  };
  const poligono = (clave: 'pre' | 'post') => datos.map((d, i) => punto(i, d[clave]).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]">
      {/* Anillos */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f}
          points={datos.map((_, i) => [cx + R * f * Math.cos(ang(i)), cy + R * f * Math.sin(ang(i))].join(',')).join(' ')}
          fill="none" stroke="#eef2f7" strokeWidth={1} />
      ))}
      {/* Ejes + etiquetas */}
      {datos.map((d, i) => {
        const [x, y] = punto(i, 100);
        const [lx, ly] = [cx + (R + 16) * Math.cos(ang(i)), cy + (R + 16) * Math.sin(ang(i))];
        return (
          <g key={d.etiqueta}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="#eef2f7" strokeWidth={1} />
            <text x={lx} y={ly} fontSize={9} fill="#64748b" textAnchor="middle" dominantBaseline="middle">
              {d.etiqueta.length > 10 ? d.etiqueta.slice(0, 9) + '…' : d.etiqueta}
            </text>
          </g>
        );
      })}
      {/* Pretest (contorno) */}
      <polygon points={poligono('pre')} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
      {/* Postest (relleno) */}
      <polygon points={poligono('post')} fill="#2563eb" fillOpacity={0.18} stroke="#2563eb" strokeWidth={2} />
      {datos.map((d, i) => {
        const [x, y] = punto(i, d.post);
        return <circle key={i} cx={x} cy={y} r={3} fill="#2563eb" />;
      })}
    </svg>
  );
}
