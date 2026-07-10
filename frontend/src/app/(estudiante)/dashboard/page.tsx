'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { CountUp } from '@/components/count-up';
import { Card, StatCard, SectionTitle, ProgressBar, Skeleton } from '@/components/ui';
import { Star, Trophy, CheckCircle, Flame, Sparkles, ArrowRight, Play, GraduationCap, Award } from '@/components/icons';

interface Resumen {
  puntos: number; posicion: number | null; racha_dias: number;
  ejercicios: { completados: number; total: number };
}
interface Recomendado { id: number; titulo: string; categoria: string; estrellas: number; xp: number }
interface Comp { comparativa: { categoria: string; pretest: number | null; postest: number | null }[] }
interface Dia { dia: string; intentos: number; aciertos: number }
interface PostestEstado { disponible: boolean; completado: boolean; desdeNivel: number }

export default function DashboardPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [r, setR] = useState<Resumen | null>(null);
  const [rec, setRec] = useState<Recomendado[]>([]);
  const [comp, setComp] = useState<Comp['comparativa']>([]);
  const [act, setAct] = useState<Dia[]>([]);
  const [postest, setPostest] = useState<PostestEstado | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Resumen>('/gamificacion/resumen').then(setR).catch(() => undefined),
      api.get<{ recomendados: Recomendado[] }>('/gamificacion/recomendados').then((x) => setRec(x.recomendados)).catch(() => undefined),
      api.get<Comp>('/progreso').then((x) => setComp(x.comparativa)).catch(() => undefined),
      api.get<{ actividad: Dia[] }>('/gamificacion/actividad').then((x) => setAct(x.actividad)).catch(() => undefined),
      api.get<PostestEstado>('/postest/estado').then(setPostest).catch(() => undefined),
    ]).finally(() => setCargando(false));
  }, []);

  const faltan = r ? Math.max(0, r.ejercicios.total - r.ejercicios.completados) : null;
  const metaPct = r && r.ejercicios.total ? Math.round((r.ejercicios.completados / r.ejercicios.total) * 100) : 0;

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl lg:text-4xl">¡Hola de nuevo, {usuario?.nombre.split(' ')[0]}!</h1>
      <p className="mb-7 mt-1 text-[15px] text-muted">
        {faltan != null && faltan > 0 ? `Estás a ${Math.min(faltan, 5)} ejercicios de seguir avanzando.` : 'Sigue tu ruta de aprendizaje en Python.'}
      </p>

      {/* Postest desbloqueable — tarjeta destacada */}
      {postest?.disponible && !postest.completado && (
        <div className="mb-6 flex flex-col items-start gap-4 overflow-hidden rounded-2xl border-0 bg-gradient-to-r from-prexi-green to-emerald-500 p-6 text-white shadow-soft sm:flex-row sm:items-center">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15"><GraduationCap className="h-8 w-8" /></div>
          <div className="flex-1">
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"><Award className="h-3.5 w-3.5" /> Nuevo · desbloqueado</div>
            <h2 className="font-display text-xl font-extrabold">¡Ya puedes rendir la evaluación final!</h2>
            <p className="text-sm text-white/85">Completaste el avance requerido. Mide cuánto aprendiste (postest) — sin ayuda de ALVARO.</p>
          </div>
          <button onClick={() => router.push('/postest')} className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-prexi-green transition hover:bg-white/90 active:scale-[0.98]">Rendir evaluación <ArrowRight className="ml-1 inline h-4 w-4" /></button>
        </div>
      )}
      {postest?.completado && (
        <button onClick={() => router.push('/postest/resultado')} className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left shadow-soft transition hover:bg-subtle">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-prexi-green"><Award className="h-6 w-6" /></div>
          <div className="flex-1"><p className="font-semibold text-fg">Evaluación final completada</p><p className="text-sm text-muted">Revisa tu puntaje, tu progreso vs. pretest y tus respuestas.</p></div>
          <ArrowRight className="h-5 w-5 text-muted" />
        </button>
      )}

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {cargando ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <StatCard icon={<Star className="h-7 w-7" />} accent="blue" label="Puntos XP" value={<CountUp value={r?.puntos ?? 0} />} />
            <StatCard icon={<Trophy className="h-7 w-7" />} accent="amber" label="Posición" value={r?.posicion ? `#${r.posicion}` : '—'} />
            <StatCard icon={<CheckCircle className="h-7 w-7" />} accent="green" label="Ejercicios" value={r ? `${r.ejercicios.completados}/${r.ejercicios.total}` : '—'} />
            <StatCard icon={<Flame className="h-7 w-7" />} accent="amber" label="Racha" value={<><CountUp value={r?.racha_dias ?? 0} /> días</>} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Progreso académico */}
        <Card hover className="lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <SectionTitle>Mi progreso académico</SectionTitle>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-line" /> Pretest</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-blue" /> Postest</span>
            </div>
          </div>
          <ChartPrePost datos={comp} />
        </Card>

        {/* Recomendado por ALVARO */}
        <div className="card overflow-hidden border-0 bg-gradient-to-b from-prexi-navy to-prexi-navy-soft text-white">
          <div className="mb-1 flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-300" /><h2 className="font-display text-xl font-bold">Recomendado por ALVARO</h2></div>
          <p className="mb-5 text-sm text-blue-100/80">Según tu desempeño, estos retos te ayudan a subir de nivel.</p>
          <div className="space-y-3">
            {rec.map((e) => (
              <div key={e.id} className="rounded-xl bg-white/10 p-3.5 ring-1 ring-white/5 transition hover:bg-white/15">
                <div className="mb-2.5 flex items-center justify-between gap-2">
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
        <Card className="flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between"><SectionTitle>Meta semanal</SectionTitle><span className="font-display text-2xl font-extrabold text-prexi-blue-deep">{metaPct}%</span></div>
            <ProgressBar value={metaPct} />
            <p className="mt-3 text-sm text-muted">{faltan != null ? `Te faltan ${faltan} ejercicios para completar el curso.` : 'Cargando…'}</p>
          </div>
          <Link href="/ejercicios" className="btn-primary mt-5 self-start"><Play className="h-4 w-4" /> Continuar</Link>
        </Card>
        <Card>
          <SectionTitle className="mb-5">Actividad de la semana</SectionTitle>
          <Actividad dias={act} />
        </Card>
      </div>
    </div>
  );
}

function ChartPrePost({ datos }: { datos: Comp['comparativa'] }) {
  if (!datos.length) return <p className="py-16 text-center text-sm text-muted">Aún no hay datos de pre/postest.</p>;
  const W = 560, H = 240, padX = 16, padB = 34, padT = 10, innerH = H - padB - padT;
  const grupos = datos.slice(0, 6); const stepX = (W - padX * 2) / grupos.length; const bw = Math.min(22, stepX / 3.4);
  const y = (v: number) => padT + innerH - (v / 100) * innerH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 25, 50, 75, 100].map((g) => <g key={g}><line x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="rgb(var(--line))" /><text x={padX} y={y(g) - 3} fontSize={9} fill="rgb(var(--muted))">{g}</text></g>)}
      {grupos.map((d, i) => {
        const cx = padX + stepX * i + stepX / 2; const pre = d.pretest ?? 0; const post = d.postest ?? 0;
        return (
          <g key={d.categoria} className="animate-grow-x" style={{ transformOrigin: 'bottom' }}>
            <rect x={cx - bw - 2} y={y(pre)} width={bw} height={innerH - (y(pre) - padT)} rx={4} fill="rgb(var(--line))" />
            <rect x={cx + 2} y={y(post)} width={bw} height={innerH - (y(post) - padT)} rx={4} fill="#2C4A6E" />
            <text x={cx} y={H - 14} fontSize={10} fill="rgb(var(--muted))" textAnchor="middle">{d.categoria.length > 11 ? d.categoria.slice(0, 10) + '…' : d.categoria}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Actividad({ dias }: { dias: Dia[] }) {
  if (!dias.length) return <p className="py-8 text-center text-sm text-muted">Sin actividad esta semana.</p>;
  const max = Math.max(1, ...dias.map((d) => d.intentos));
  const nombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return (
    <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
      {dias.map((d) => {
        const h = Math.round((d.intentos / max) * 100);
        const dow = nombres[new Date(d.dia + 'T00:00:00').getDay()];
        return (
          <div key={d.dia} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted">{d.intentos || ''}</span>
            <div className="flex w-full max-w-[38px] flex-1 items-end">
              <div className="w-full origin-bottom rounded-t-lg bg-gradient-to-t from-prexi-blue to-blue-400 transition-all" style={{ height: `${Math.max(4, h)}%` }} />
            </div>
            <span className="text-[11px] text-muted">{dow}</span>
          </div>
        );
      })}
    </div>
  );
}
