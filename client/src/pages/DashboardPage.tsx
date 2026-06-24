import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { DashboardData } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import { Star, Trophy, CheckCircle, Flame, Sparkles, ArrowRight, Play } from '../components/icons';

interface Comparativa {
  comparativa: { categoria: string; pretest: number | null; postest: number | null }[];
}
interface Recomendado { id: number; titulo: string; categoria: string; estrellas: number; xp: number }
interface DiaActividad { dia: string; intentos: number; aciertos: number }

export default function DashboardPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [comp, setComp] = useState<Comparativa['comparativa']>([]);
  const [recomendados, setRecomendados] = useState<Recomendado[]>([]);
  const [actividad, setActividad] = useState<DiaActividad[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardData>('/dashboard').then(setData).catch(() => undefined),
      api.get<Comparativa>('/pretest/comparativa').then((r) => setComp(r.comparativa)).catch(() => undefined),
      // Recomendados: seleccionados por el backend según el nivel actual.
      api.get<{ recomendados: Recomendado[] }>('/dashboard/recomendados').then((r) => setRecomendados(r.recomendados)).catch(() => undefined),
      api.get<{ actividad: DiaActividad[] }>('/dashboard/actividad').then((r) => setActividad(r.actividad)).catch(() => undefined),
    ]).finally(() => setCargando(false));
  }, []);

  const faltan = data ? Math.max(0, data.ejercicios.total - data.ejercicios.completados) : null;
  const metaPct = data && data.ejercicios.total
    ? Math.round((data.ejercicios.completados / data.ejercicios.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-extrabold tracking-tight text-prexi-navy">
        ¡Bienvenido de nuevo, {usuario?.nombre.split(' ')[0]}!
      </h1>
      <p className="mb-6 text-slate-500">
        {faltan != null && faltan > 0
          ? `Estás a ${Math.min(faltan, 5)} ejercicios de seguir avanzando en tu ruta.`
          : 'Sigue tu ruta de aprendizaje en programación.'}
      </p>

      {/* Stat cards (con skeleton mientras carga) */}
      {cargando && !data ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card flex items-center gap-4 !p-4">
              <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-slate-200" />
              <div className="flex-1 space-y-2"><div className="h-3 w-16 animate-pulse rounded bg-slate-200" /><div className="h-5 w-12 animate-pulse rounded bg-slate-200" /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={<Star className="h-6 w-6" />} accent="blue" label="Puntos XP" value={data ? data.puntos.toLocaleString() : '—'} />
          <StatCard icon={<Trophy className="h-6 w-6" />} accent="amber" label="Posición" value={data?.posicion ? `#${data.posicion}` : '—'} />
          <StatCard icon={<CheckCircle className="h-6 w-6" />} accent="green" label="Ejercicios" value={data ? `${data.ejercicios.completados}/${data.ejercicios.total}` : '—'} />
          <StatCard icon={<Flame className="h-6 w-6" />} accent="orange" label="Racha" value={data ? `${data.racha_dias} días` : '—'} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Progreso académico */}
        <div className="card lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-prexi-navy">Mi progreso académico</h2>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Pretest</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-blue" /> Postest</span>
            </div>
          </div>
          <ChartProgreso datos={comp} />
        </div>

        {/* Recomendado por la IA */}
        <div className="card border-0 bg-gradient-to-b from-prexi-navy to-[#16335a] text-white">
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-300" />
            <h2 className="text-lg font-bold">Recomendado por la IA</h2>
          </div>
          <p className="mb-4 text-sm text-blue-100/80">Basado en tu desempeño, estos retos te ayudarán a subir de nivel.</p>

          <div className="space-y-3">
            {recomendados.map((e) => (
              <div key={e.id} className="rounded-xl bg-white/10 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{e.titulo}</p>
                  <span className="shrink-0 rounded-md bg-prexi-amber/20 px-2 py-0.5 text-xs font-bold text-prexi-amber">+{e.xp} XP</span>
                </div>
                <button
                  onClick={() => navigate(`/ejercicios/${e.id}`)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-prexi-blue py-2 text-sm font-semibold transition hover:bg-blue-600"
                >
                  Resolver <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
            {recomendados.length === 0 && (
              <p className="rounded-xl bg-white/10 p-3 text-sm text-blue-100/80">
                ¡Has resuelto todo lo disponible! Vuelve pronto por más retos. 🎉
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Meta semanal */}
      <div className="card mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-prexi-navy">Meta semanal</h3>
            <span className="text-sm font-bold text-prexi-blue">{metaPct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-prexi-blue to-blue-400 transition-all" style={{ width: `${metaPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {faltan != null ? `Te faltan ${faltan} ejercicios para completar el curso.` : 'Cargando progreso…'}
          </p>
        </div>
        <Link to="/ejercicios" className="btn-primary shrink-0">
          <Play className="h-4 w-4" /> Continuar
        </Link>
      </div>

      {/* Actividad de la semana */}
      <div className="card mt-6">
        <h3 className="mb-4 font-bold text-prexi-navy">Actividad de la semana</h3>
        <ActividadSemanal dias={actividad} />
      </div>
    </div>
  );
}

// ── Mini gráfico de actividad (intentos por día) ────────────
function ActividadSemanal({ dias }: { dias: DiaActividad[] }) {
  if (!dias.length) return <p className="py-6 text-center text-sm text-slate-400">Aún no registras actividad esta semana.</p>;
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
              <div className="w-full rounded-t-md bg-gradient-to-t from-prexi-blue to-blue-400" style={{ height: `${Math.max(4, h)}px` }} title={`${d.intentos} intentos, ${d.aciertos} aciertos`} />
            </div>
            <span className="text-[11px] text-slate-500">{dow}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Gráfico de barras agrupadas (pretest vs postest) ────────
function ChartProgreso({ datos }: { datos: Comparativa['comparativa'] }) {
  if (!datos.length) {
    return <p className="py-12 text-center text-sm text-slate-400">Aún no hay datos de pre/postest para graficar.</p>;
  }
  const W = 560, H = 220, padX = 16, padB = 34, padT = 10;
  const innerW = W - padX * 2;
  const innerH = H - padB - padT;
  const grupos = datos.slice(0, 6);
  const stepX = innerW / grupos.length;
  const bw = Math.min(20, stepX / 3.4);
  const y = (v: number) => padT + innerH - (v / 100) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Rejilla */}
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="#eef2f7" strokeWidth={1} />
          <text x={padX} y={y(g) - 3} fontSize={9} fill="#cbd5e1">{g}</text>
        </g>
      ))}
      {grupos.map((d, i) => {
        const cx = padX + stepX * i + stepX / 2;
        const pre = d.pretest ?? 0;
        const post = d.postest ?? 0;
        return (
          <g key={d.categoria}>
            <rect x={cx - bw - 2} y={y(pre)} width={bw} height={innerH - (y(pre) - padT)} rx={3} fill="#cbd5e1" />
            <rect x={cx + 2} y={y(post)} width={bw} height={innerH - (y(post) - padT)} rx={3} fill="#2563eb" />
            <text x={cx} y={H - 14} fontSize={10} fill="#64748b" textAnchor="middle">
              {d.categoria.length > 12 ? d.categoria.slice(0, 11) + '…' : d.categoria}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
