'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TrendingUp, Sparkles, CheckCircle, Lock, Play } from '@/components/icons';

interface Cat { categoria: string; pretest: number | null; postest: number | null; mejora: number | null }
interface NivelP { numero: number; titulo: string; umbral: number; ejercicios_completados: number; desbloqueado: boolean; estado: string }
interface Sesion { titulo: string; categoria: string; correcto: boolean; xp: number; tiempo_seg: number; fecha: string }
interface Datos { comparativa: Cat[]; pretest_total: number | null; postest_total: number | null; ganancia: number | null; niveles: NivelP[]; sesiones: Sesion[] }

export default function ProgresoPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => { api.get<Datos>('/progreso').then(setD).catch(() => undefined).finally(() => setCargando(false)); }, []);

  if (cargando) return <div className="mx-auto max-w-5xl space-y-4">{[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
  if (!d) return null;

  const radar = d.comparativa.filter((c) => c.postest != null).map((c) => ({ etiqueta: c.categoria, pre: c.pretest ?? 0, post: c.postest ?? 0 }));
  const fuerte = [...d.comparativa].sort((a, b) => (b.postest ?? 0) - (a.postest ?? 0))[0];
  const debil = [...d.comparativa].sort((a, b) => (a.postest ?? 0) - (b.postest ?? 0))[0];
  const hayPost = d.postest_total != null;

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      {/* Banner */}
      <div className="card mb-6 border-0 bg-gradient-to-r from-prexi-navy to-prexi-blue text-white">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Reporte semestral</span>
            <h1 className="mt-2 text-2xl font-extrabold">Tu progreso académico</h1>
            <p className="text-sm text-blue-100/80">Crecimiento entre tu evaluación inicial y la final.</p>
          </div>
          <div className="flex items-center gap-6">
            <div><p className="text-[11px] uppercase text-blue-200/70">Pretest</p><p className="text-2xl font-extrabold">{d.pretest_total ?? '—'}</p></div>
            <div><p className="text-[11px] uppercase text-blue-200/70">Postest</p><p className="text-2xl font-extrabold">{hayPost ? d.postest_total : '—'}</p></div>
            {hayPost ? (
              <div className="rounded-2xl bg-prexi-green px-5 py-3 text-center"><div className="flex items-center justify-center gap-1.5"><TrendingUp className="h-5 w-5" /><p className="text-2xl font-extrabold">{d.ganancia != null && d.ganancia >= 0 ? '+' : ''}{d.ganancia}</p></div><p className="text-[11px] text-green-50">puntos de mejora</p></div>
            ) : <div className="rounded-2xl bg-white/10 px-5 py-3 text-center text-xs text-blue-100/80">Postest disponible<br />al avanzar el curso</div>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Comparativa */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-prexi-navy">Comparativa por tema</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-blue" /> Pretest</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-green" /> Postest</span></div>
          </div>
          {!d.comparativa.length && <p className="text-sm text-slate-400">Aún no hay registros.</p>}
          <div className="space-y-4">
            {d.comparativa.map((c) => (
              <div key={c.categoria}>
                <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium text-slate-700">{c.categoria}</span>{c.mejora != null && <span className="font-semibold text-prexi-green">+{c.mejora}% mejora</span>}</div>
                <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-prexi-blue" style={{ width: `${c.pretest ?? 0}%` }} /></div>
                {c.postest != null && <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-prexi-green" style={{ width: `${c.postest}%` }} /></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Radar */}
        <div className="card">
          <h2 className="mb-1 text-lg font-bold text-prexi-navy">Radar de competencias</h2>
          <p className="mb-2 text-sm text-slate-500">Visualización 360° de tus habilidades.</p>
          {radar.length >= 3 ? <Radar datos={radar} /> : <p className="py-12 text-center text-sm text-slate-400">Disponible tras el postest.</p>}
          {fuerte && debil && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-sm text-slate-600"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue" /><span>Tu punto más fuerte es <b className="text-prexi-navy">{fuerte.categoria}</b>. Refuerza <b className="text-prexi-navy">{debil.categoria}</b>.</span></div>
          )}
        </div>
      </div>

      {/* Progreso por nivel */}
      <h2 className="mb-3 mt-7 text-lg font-bold text-prexi-navy">Progreso por nivel</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {d.niveles.map((n) => {
          const completo = n.estado === 'completado'; const enProg = n.estado === 'en_progreso';
          return (
            <div key={n.numero} className={`rounded-2xl border bg-white p-4 ${enProg ? 'border-prexi-blue ring-1 ring-blue-100' : 'border-slate-200'} ${n.estado === 'bloqueado' ? 'opacity-70' : ''}`}>
              <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Nivel {n.numero}</span>{completo ? <CheckCircle className="h-4 w-4 text-prexi-green" /> : enProg ? <Play className="h-4 w-4 text-prexi-blue" /> : <Lock className="h-4 w-4 text-slate-300" />}</div>
              <p className="text-sm font-semibold leading-tight text-prexi-navy">{n.titulo}</p>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${completo ? 'bg-green-100 text-prexi-green' : enProg ? 'bg-blue-100 text-prexi-blue' : 'bg-slate-100 text-slate-400'}`}>{completo ? 'Completado' : enProg ? 'En progreso' : 'Bloqueado'}</span>
            </div>
          );
        })}
      </div>

      {/* Sesiones recientes */}
      <h2 className="mb-3 mt-7 text-lg font-bold text-prexi-navy">Sesiones recientes</h2>
      <div className="card !p-0 overflow-hidden">
        {d.sesiones.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Aún no tienes actividad registrada.</p>}
        {d.sesiones.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-slate-50 px-5 py-2.5 last:border-0">
            <div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${s.correcto ? 'bg-prexi-green' : 'bg-prexi-red'}`} /><div><p className="text-sm font-medium text-slate-700">{s.titulo}</p><p className="text-xs text-slate-400">{s.categoria} · {new Date(s.fecha).toLocaleDateString('es-BO')}</p></div></div>
            <span className="text-sm font-semibold text-prexi-blue">+{s.xp} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Radar({ datos }: { datos: { etiqueta: string; pre: number; post: number }[] }) {
  const size = 280, cx = size / 2, cy = size / 2, R = 95, n = datos.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const punto = (i: number, v: number) => [cx + (v / 100) * R * Math.cos(ang(i)), cy + (v / 100) * R * Math.sin(ang(i))];
  const poly = (k: 'pre' | 'post') => datos.map((d, i) => punto(i, d[k]).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]">
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={datos.map((_, i) => [cx + R * f * Math.cos(ang(i)), cy + R * f * Math.sin(ang(i))].join(',')).join(' ')} fill="none" stroke="#eef2f7" />)}
      {datos.map((d, i) => { const [x, y] = punto(i, 100); const [lx, ly] = [cx + (R + 16) * Math.cos(ang(i)), cy + (R + 16) * Math.sin(ang(i))]; return <g key={d.etiqueta}><line x1={cx} y1={cy} x2={x} y2={y} stroke="#eef2f7" /><text x={lx} y={ly} fontSize={9} fill="#64748b" textAnchor="middle" dominantBaseline="middle">{d.etiqueta.length > 10 ? d.etiqueta.slice(0, 9) + '…' : d.etiqueta}</text></g>; })}
      <polygon points={poly('pre')} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 3" />
      <polygon points={poly('post')} fill="#2563eb" fillOpacity={0.18} stroke="#2563eb" strokeWidth={2} />
      {datos.map((d, i) => { const [x, y] = punto(i, d.post); return <circle key={i} cx={x} cy={y} r={3} fill="#2563eb" />; })}
    </svg>
  );
}
