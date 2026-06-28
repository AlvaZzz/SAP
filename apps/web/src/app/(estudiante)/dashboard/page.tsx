'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { CountUp } from '@/components/count-up';
import { Star, Trophy, CheckCircle, Flame, Sparkles, ArrowRight, Play } from '@/components/icons';

interface Resumen {
  puntos: number; posicion: number | null; racha_dias: number;
  ejercicios: { completados: number; total: number };
}
interface Recomendado { id: number; titulo: string; categoria: string; estrellas: number; xp: number }
interface Comp { comparativa: { categoria: string; pretest: number | null; postest: number | null }[] }
interface Dia { dia: string; intentos: number; aciertos: number }

export default function DashboardPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [r, setR] = useState<Resumen | null>(null);
  const [rec, setRec] = useState<Recomendado[]>([]);
  const [comp, setComp] = useState<Comp['comparativa']>([]);
  const [act, setAct] = useState<Dia[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Resumen>('/gamificacion/resumen').then(setR).catch(() => undefined),
      api.get<{ recomendados: Recomendado[] }>('/gamificacion/recomendados').then((x) => setRec(x.recomendados)).catch(() => undefined),
      api.get<Comp>('/progreso').then((x) => setComp(x.comparativa)).catch(() => undefined),
      api.get<{ actividad: Dia[] }>('/gamificacion/actividad').then((x) => setAct(x.actividad)).catch(() => undefined),
    ]).finally(() => setCargando(false));
  }, []);

  const faltan = r ? Math.max(0, r.ejercicios.total - r.ejercicios.completados) : null;
  const metaPct = r && r.ejercicios.total ? Math.round((r.ejercicios.completados / r.ejercicios.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight text-prexi-navy">¡Hola de nuevo, {usuario?.nombre.split(' ')[0]}!</h1>
      <p className="mb-6 text-slate-500">
        {faltan != null && faltan > 0 ? `Estás a ${Math.min(faltan, 5)} ejercicios de seguir avanzando.` : 'Sigue tu ruta de aprendizaje en Python.'}
      </p>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cargando ? [0, 1, 2, 3].map((i) => <div key={i} className="card !p-4"><div className="h-14 animate-pulse rounded bg-slate-100" /></div>) : (
          <>
            <Stat icon={<Star className="h-6 w-6" />} accent="blue" label="Puntos XP" value={r?.puntos ?? 0} />
            <Stat icon={<Trophy className="h-6 w-6" />} accent="amber" label="Posición" raw={r?.posicion ? `#${r.posicion}` : '—'} />
            <Stat icon={<CheckCircle className="h-6 w-6" />} accent="green" label="Ejercicios" raw={r ? `${r.ejercicios.completados}/${r.ejercicios.total}` : '—'} />
            <Stat icon={<Flame className="h-6 w-6" />} accent="orange" label="Racha" value={r?.racha_dias ?? 0} suffix=" días" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Progreso académico */}
        <div className="card card-hover lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-prexi-navy">Mi progreso académico</h2>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Pretest</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-blue" /> Postest</span>
            </div>
          </div>
          <ChartPrePost datos={comp} />
        </div>

        {/* Recomendado por ALEX */}
        <div className="card border-0 bg-gradient-to-b from-prexi-navy to-[#16335a] text-white">
          <div className="mb-1 flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-300" /><h2 className="text-lg font-bold">Recomendado por ALEX</h2></div>
          <p className="mb-4 text-sm text-blue-100/80">Según tu desempeño, estos retos te ayudan a subir de nivel.</p>
          <div className="space-y-3">
            {rec.map((e) => (
              <div key={e.id} className="rounded-xl bg-white/10 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{e.titulo}</p>
                  <span className="shrink-0 rounded-md bg-prexi-amber/20 px-2 py-0.5 text-xs font-bold text-prexi-amber">+{e.xp} XP</span>
                </div>
                <button onClick={() => router.push(`/ejercicios/${e.id}`)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-prexi-blue py-2 text-sm font-semibold transition hover:bg-blue-600 active:scale-[0.98]">
                  Resolver <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!cargando && rec.length === 0 && <p className="rounded-xl bg-white/10 p-3 text-sm text-blue-100/80">¡Resolviste todo lo disponible! 🎉</p>}
          </div>
        </div>
      </div>

      {/* Meta semanal + actividad */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card flex flex-col justify-between">
          <div>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-bold text-prexi-navy">Meta semanal</h3><span className="text-sm font-bold text-prexi-blue">{metaPct}%</span></div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-prexi-blue to-blue-400 transition-all duration-700" style={{ width: `${metaPct}%` }} /></div>
            <p className="mt-2 text-xs text-slate-400">{faltan != null ? `Te faltan ${faltan} ejercicios para completar el curso.` : 'Cargando…'}</p>
          </div>
          <Link href="/ejercicios" className="btn-primary mt-4 self-start"><Play className="h-4 w-4" /> Continuar</Link>
        </div>
        <div className="card">
          <h3 className="mb-4 font-bold text-prexi-navy">Actividad de la semana</h3>
          <Actividad dias={act} />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, raw, suffix, accent }: { icon: React.ReactNode; label: string; value?: number; raw?: string; suffix?: string; accent: 'blue' | 'amber' | 'green' | 'orange' }) {
  const tones = { blue: 'bg-blue-50 text-prexi-blue', amber: 'bg-amber-50 text-prexi-amber', green: 'bg-green-50 text-prexi-green', orange: 'bg-orange-50 text-orange-500' };
  return (
    <div className="card card-hover flex items-center gap-4 !p-4">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tones[accent]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-extrabold leading-tight text-prexi-navy">
          {raw ?? <><CountUp value={value ?? 0} />{suffix}</>}
        </p>
      </div>
    </div>
  );
}

function ChartPrePost({ datos }: { datos: Comp['comparativa'] }) {
  if (!datos.length) return <p className="py-12 text-center text-sm text-slate-400">Aún no hay datos de pre/postest.</p>;
  const W = 560, H = 220, padX = 16, padB = 34, padT = 10, innerH = H - padB - padT;
  const grupos = datos.slice(0, 6); const stepX = (W - padX * 2) / grupos.length; const bw = Math.min(20, stepX / 3.4);
  const y = (v: number) => padT + innerH - (v / 100) * innerH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 25, 50, 75, 100].map((g) => <g key={g}><line x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="#eef2f7" /><text x={padX} y={y(g) - 3} fontSize={9} fill="#cbd5e1">{g}</text></g>)}
      {grupos.map((d, i) => {
        const cx = padX + stepX * i + stepX / 2; const pre = d.pretest ?? 0; const post = d.postest ?? 0;
        return (
          <g key={d.categoria}>
            <rect x={cx - bw - 2} y={y(pre)} width={bw} height={innerH - (y(pre) - padT)} rx={3} fill="#cbd5e1" />
            <rect x={cx + 2} y={y(post)} width={bw} height={innerH - (y(post) - padT)} rx={3} fill="#2563eb" />
            <text x={cx} y={H - 14} fontSize={10} fill="#64748b" textAnchor="middle">{d.categoria.length > 11 ? d.categoria.slice(0, 10) + '…' : d.categoria}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Actividad({ dias }: { dias: Dia[] }) {
  if (!dias.length) return <p className="py-6 text-center text-sm text-slate-400">Sin actividad esta semana.</p>;
  const max = Math.max(1, ...dias.map((d) => d.intentos));
  const nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return (
    <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
      {dias.map((d) => {
        const h = Math.round((d.intentos / max) * 90);
        const dow = nombres[new Date(d.dia + 'T00:00:00').getDay()];
        return (
          <div key={d.dia} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-semibold text-slate-400">{d.intentos || ''}</span>
            <div className="flex w-full max-w-[34px] flex-1 items-end">
              <div className="w-full rounded-t-md bg-gradient-to-t from-prexi-blue to-blue-400 transition-all" style={{ height: `${Math.max(4, h)}px` }} />
            </div>
            <span className="text-[11px] text-slate-500">{dow}</span>
          </div>
        );
      })}
    </div>
  );
}
