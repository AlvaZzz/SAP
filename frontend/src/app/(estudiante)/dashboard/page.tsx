'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { TarjetaEvaluarPrexi } from '@/components/cuestionario-instrumento';
import { MiCurso } from '@/components/mi-curso';
import { useAuth } from '@/providers/auth-provider';
import { CountUp } from '@/components/count-up';
import { Card, StatGrid, SectionTitle, Skeleton, Badge } from '@/components/ui';
import { Sparkline, Anillo, suavizar } from '@/components/sparkline';
import { RangoIcon } from '@/components/rango-icon';
import { UnidadEstudiante, NivelDificultad, NIVEL_COLOR, colorUnidad } from '@/lib/types';
import { Star, CheckCircle, Flame, Sparkles, ArrowRight, GraduationCap, Award, Lock, TrendingUp, Lightbulb } from '@/components/icons';

/* Acentos del dashboard (paleta del sistema + semánticos): azul=acento/datos base,
   verde=avance, ámbar=en camino/racha, violeta=rango. Alineados con los tokens. */
const AZUL = '#3B82F6', VERDE = '#10B981', AMBAR = '#F59E0B', ROJO = '#EF4444', VIOLETA = '#8B5CF6';

interface Resumen { puntos: number; posicion: number | null; racha_dias: number; ejercicios: { completados: number; total: number } }
interface Dia { dia: string; intentos: number; aciertos: number; xp: number }
interface Recientes { tasa_acierto: number | null; recientes: { titulo: string; ubicacion: string; correcto: boolean; xp: number; fecha: string }[] }
interface Evolucion { serie: { theta: number; origen: string; fecha: string; semana: string }[]; grupo: { semana: string; theta: number }[] }
interface Rangos { global: { puntaje: number; rango: { nombre: string; svgKey: string; color: string }; siguiente: { nombre: string; faltan: number } | null } }
interface Recomendado {
  id: number; titulo: string; xp: number;
  nivel: NivelDificultad; nivel_label: string;
  unidad_numero: number; tema_numero: string; tema_titulo: string;
  razon: string;
}

export default function DashboardPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [r, setR] = useState<Resumen | null>(null);
  const [dias, setDias] = useState<Dia[]>([]);
  const [rec, setRec] = useState<Recomendado[]>([]);
  const [recientes, setRecientes] = useState<Recientes | null>(null);
  const [evo, setEvo] = useState<Evolucion | null>(null);
  const [rangos, setRangos] = useState<Rangos | null>(null);
  const [unidades, setUnidades] = useState<UnidadEstudiante[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Resumen>('/gamificacion/resumen').then(setR).catch(() => undefined),
      api.get<{ actividad: Dia[] }>('/gamificacion/actividad').then((x) => setDias(x.actividad)).catch(() => undefined),
      api.get<Recientes>('/gamificacion/recientes').then(setRecientes).catch(() => undefined),
      api.get<Evolucion>('/progreso/evolucion').then(setEvo).catch(() => undefined),
      api.get<Rangos>('/gamificacion/rangos').then(setRangos).catch(() => undefined),
      api.get<{ unidades: UnidadEstudiante[] }>('/unidades').then((x) => setUnidades(x.unidades ?? [])).catch(() => undefined),
      api.get<{ recomendados: Recomendado[] }>('/gamificacion/recomendados').then((x) => setRec(x.recomendados)).catch(() => undefined),
    ]).finally(() => setCargando(false));
  }, []);

  // Series REALES de los sparklines (últimos 7 días).
  const xpSerie = dias.map((d) => d.xp);
  const aciertoSerie = dias.map((d) => (d.intentos ? Math.round((d.aciertos / d.intentos) * 100) : 0));
  const xpSemana = dias.reduce((s, d) => s + d.xp, 0);
  const intentosSemana = dias.reduce((s, d) => s + d.intentos, 0);
  const aciertosSemana = dias.reduce((s, d) => s + d.aciertos, 0);

  // Unidad ACTUAL = la primera desbloqueada cuyo examen aún no está aprobado.
  const unidadActualId = unidades.find((u) => u.desbloqueada && !u.examen_aprobado)?.id ?? null;

  return (
    <div className="animate-fade-up">
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-prexi-navy via-[#12356B] to-prexi-blue p-5 text-white shadow-lift sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-28 h-56 w-56 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 basis-64">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-amber-400"><span className="h-1.5 w-6 rounded-full bg-amber-500" /> Tu panel</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">Hola, {usuario?.nombre.split(' ')[0]}</h1>
            <p className="mt-1 text-base text-blue-100/90">Este es tu avance en Programación I. El verde significa que avanzaste; el ámbar, que vas en camino.</p>
          </div>
          <button onClick={() => router.push('/ejercicios')} className="btn-accion w-full sm:w-auto">Seguir aprendiendo <ArrowRight className="h-5 w-5" /></button>
        </div>
      </section>
      <MiCurso className="mb-5" />

      {/* Evaluación del sistema (SUS): solo aparece con la fase habilitada */}
      <TarjetaEvaluarPrexi href="/evaluar-prexi" />


      {/* ── Estadísticas destacadas ── */}
      <StatGrid className="mb-5 !grid-cols-2 sm:!grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
        {cargando ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[96px]" />) : (
          <>
            <SparkStat color={AZUL} icon={<Star className="h-5 w-5" />} label="Puntos XP"
              value={<CountUp value={r?.puntos ?? 0} />}
              sub={xpSemana > 0 ? <><b style={{ color: AZUL }}>+{xpSemana} XP</b> esta semana</> : 'Sin XP esta semana'} serie={xpSerie} />
            <SparkStat color={VERDE} icon={<CheckCircle className="h-5 w-5" />} label="Tasa de acierto"
              value={recientes?.tasa_acierto != null ? `${recientes.tasa_acierto}%` : '—'}
              sub={intentosSemana > 0 ? <><b style={{ color: VERDE }}>{aciertosSemana}/{intentosSemana}</b> esta semana</> : 'Sin intentos esta semana'} serie={aciertoSerie} />
            <SparkStat color={VIOLETA} icon={rangos ? <RangoIcon svgKey={rangos.global.rango.svgKey} color={rangos.global.rango.color} className="h-6 w-6" /> : <Award className="h-5 w-5" />}
              label="Rango actual" value={rangos?.global.rango.nombre ?? '—'}
              sub={rangos?.global.siguiente ? <><b style={{ color: VIOLETA }}>{rangos.global.siguiente.faltan} pts</b> para {rangos.global.siguiente.nombre}</> : '¡Rango máximo alcanzado!'} />
            <SparkStat color={AMBAR} icon={<Flame className="h-5 w-5" />} label="Racha"
              value={<><CountUp value={r?.racha_dias ?? 0} /> días</>}
              sub={r && r.racha_dias >= 3 ? 'Tu constancia multiplica tu XP' : 'Resuelve hoy para encenderla'} />
          </>
        )}
      </StatGrid>

      {/* ── Zona prioritaria: recomendaciones + evolución + progreso ── */}
      {/* Sin `items-start`: con él cada columna tomaba solo el alto de su propio
          contenido y la fila quedaba despareja. El valor por defecto de la
          rejilla (stretch) iguala las tres tarjetas, también en `lg` (2 col). */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(300px,0.9fr)] xl:gap-6">
        <Card className="flex h-full min-w-0 flex-col">
          <div className="mb-1 flex items-center gap-3"><Tile color={AMBAR}><Sparkles className="h-5 w-5" /></Tile><SectionTitle>Recomendado por tu tutor PREXI</SectionTitle></div>
          <p className="mb-4 text-sm text-muted">Elegidos según tu desempeño real: refuerzan tus puntos débiles y te acercan al siguiente nivel.</p>
          <div className="space-y-2.5">
            {rec.slice(0, 2).map((e) => {
              const cU = colorUnidad(e.unidad_numero);
              return (
              <div key={e.id} className="rounded-xl border border-line bg-subtle p-3 transition hover:border-prexi-blue/40">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="max-w-full truncate rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide"
                    style={{ color: cU, backgroundColor: `${cU}26` }}>
                    Unidad {e.unidad_numero} · {e.tema_numero} {e.tema_titulo}
                  </span>
                  <PillNivel nivel={e.nivel} label={e.nivel_label} />
                </div>
                <p className="text-sm font-semibold leading-snug text-fg">{e.titulo}</p>
                <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-prexi-amber" /> {e.razon}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-prexi-amber">+{e.xp} XP</span>
                  <button onClick={() => router.push(`/ejercicios/${e.id}`)} className="btn-primary flex-1 !px-3.5 !py-2 text-sm sm:flex-none sm:!py-1.5">
                    Resolver <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              );
            })}
            {!cargando && rec.length === 0 && (
              <div className="rounded-xl border border-line bg-subtle p-4 text-center">
                <p className="text-sm font-semibold text-fg">Estás al día</p>
                <p className="mt-0.5 text-xs text-muted">No hay ejercicios pendientes que reforzar por ahora.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="order-3 flex h-full min-w-0 flex-col lg:order-none">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3"><Tile color={AZUL}><TrendingUp className="h-5 w-5" /></Tile><div><SectionTitle>Tu evolución</SectionTitle><p className="mt-0.5 text-xs text-muted">Habilidad estimada (θ) en cada medición · comparada con tu grupo</p></div></div>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-subtle px-3 py-1.5 text-xs font-semibold text-fg"><TrendingUp className="h-3.5 w-3.5" style={{ color: AZUL }} /> IRT · Rasch</span>
          </div>
          <div className="mb-2 flex gap-5 text-2xs text-muted">
            <span className="flex items-center gap-1.5"><i className="inline-block w-4 rounded border-t-[2.5px]" style={{ borderColor: AZUL }} /> Tu habilidad (θ)</span>
            <span className="flex items-center gap-1.5"><i className="inline-block w-4 rounded border-t-[2.5px] border-dashed border-muted" /> Promedio del grupo</span>
          </div>
          <div className="flex-1">
            <ChartEvolucion evo={evo} cargando={cargando} />
          </div>
        </Card>

        <Card className="order-2 flex h-full min-w-0 flex-col lg:order-none">
          <div className="mb-4 flex items-center gap-3"><Tile color={VERDE}><GraduationCap className="h-5 w-5" /></Tile><div><SectionTitle>Progreso por unidad</SectionTitle><p className="mt-0.5 text-xs text-muted">Dominio estimado en cada unidad del plan</p></div></div>
          {cargando ? <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            : unidades.length === 0 ? <p className="py-8 text-center text-sm text-muted">Aún no hay unidades publicadas.</p>
              : (
                <div className="flex flex-1 flex-col justify-between gap-1">
                  {unidades.map((u) => <FilaUnidad key={u.id} u={u} actual={u.id === unidadActualId} onClick={() => router.push(`/ejercicios/unidad/${u.id}`)} />)}
                </div>
              )}
        </Card>
      </div>

      {/* ── Actividad reciente, en una fila propia ── */}
      <div className="mt-6">
        <Card className="min-w-0">
          <div className="mb-4 flex items-center gap-3"><Tile color={VIOLETA}><Flame className="h-5 w-5" /></Tile><SectionTitle>Actividad reciente</SectionTitle></div>
          {cargando ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            : !recientes || recientes.recientes.length === 0 ? <p className="py-8 text-center text-sm text-muted">Cuando resuelvas ejercicios, tu actividad aparecerá aquí.</p>
              : (
                <div className="divide-y divide-line">
                  {recientes.recientes.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 py-3 sm:gap-3.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${a.correcto ? VERDE : ROJO}1f` }}>
                        <FlechaDir up={a.correcto} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">{a.titulo}</p>
                        <p className="truncate text-xs text-muted">{a.ubicacion}</p>
                      </div>
                      <span className="hidden text-xs text-muted sm:inline" style={{ fontVariantNumeric: 'tabular-nums' }}>{hora(a.fecha)}</span>
                      <span className="w-16 text-right text-sm font-extrabold" style={{ color: a.correcto ? VERDE : ROJO, fontVariantNumeric: 'tabular-nums' }}>
                        {a.correcto ? `+${a.xp} XP` : '0 XP'}
                      </span>
                      <Badge tone={a.correcto ? 'green' : 'red'} className="hidden md:inline-flex">{a.correcto ? 'Completado' : 'Incorrecto'}</Badge>
                    </div>
                  ))}
                </div>
              )}
        </Card>
      </div>
    </div>
  );
}

/** Recuadro de icono de las cabeceras: da a cada tarjeta su color sin llenarla. */
function Tile({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ color, backgroundColor: `${color}1c` }}>{children}</span>;
}

/* ── Tarjeta destacada: ícono de color + número grande + sparkline real ── */
function SparkStat({ color, icon, label, value, sub, serie }: {
  color: string; icon: React.ReactNode; label: string; value: React.ReactNode; sub: React.ReactNode; serie?: number[];
}) {
  return (
    // Layout en COLUMNA (no en fila): la etiqueta ocupa el ancho de la tarjeta
    // menos el ícono, y el sparkline baja junto al subtexto. En la versión en
    // fila, el sparkline (88px) e ícono (44px) dejaban ~20px al texto dentro de
    // una columna de 210px, y la etiqueta se partía letra por letra (vertical).
    <div className="card card-hover relative flex flex-col gap-1.5 overflow-hidden !p-3.5 sm:gap-2 sm:!p-5 sm:!px-4">
      {/* Degradado MUY sutil desde el acento hacia el fondo */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(120% 140% at 0% 0%, ${color}17, transparent 55%)` }} />

      {/* Fila superior: ícono + etiqueta SIEMPRE horizontal (1-2 líneas) */}
      <div className="relative flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl" style={{ backgroundColor: `${color}1c`, color, boxShadow: `inset 0 0 0 1px ${color}33` }}>{icon}</div>
        <p className="stat-label min-w-0 flex-1">{label}</p>
      </div>

      {/* Número grande a todo el ancho: nada compite por su espacio */}
      <p className="relative font-display text-2xl font-extrabold leading-tight text-fg sm:text-3xl" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</p>

      {/* Fila inferior: subtexto + sparkline (que ya no aprieta la etiqueta) */}
      <div className="relative flex items-end justify-between gap-2">
        <p className="min-w-0 flex-1 text-2xs leading-snug text-muted">{sub}</p>
        {serie && serie.length >= 2 && <Sparkline values={serie} color={color} className="-mb-1" />}
      </div>
    </div>
  );
}

/* ── Gráfico "Tu evolución": curva suave de θ + promedio del grupo ── */
function ChartEvolucion({ evo, cargando }: { evo: Evolucion | null; cargando: boolean }) {
  if (cargando) return <Skeleton className="h-56" />;
  const serie = evo?.serie ?? [];
  if (serie.length < 2) {
    return <p className="py-14 text-center text-sm text-muted">Aún no hay suficientes mediciones de tu habilidad.<br />Rinde el diagnóstico y practica: tu curva aparecerá aquí.</p>;
  }
  const W = 640, H = 250, L = 44, R = 16, T = 26, B = 30;
  const thetas = serie.map((s) => s.theta);
  const grupoMap = new Map((evo?.grupo ?? []).map((g) => [g.semana, g.theta]));
  const grupoVals = serie.map((s) => grupoMap.get(s.semana)).filter((v): v is number => v != null);
  const todos = [...thetas, ...grupoVals];
  const yMin = Math.min(0, Math.min(...todos)) - 0.2;
  const yMax = Math.max(...todos) + 0.3;
  const X = (i: number) => L + (i * (W - L - R)) / (serie.length - 1);
  const Y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const pts: [number, number][] = serie.map((s, i) => [X(i), Y(s.theta)]);
  const ptsGrupo: [number, number][] = serie
    .map((s, i) => (grupoMap.has(s.semana) ? [X(i), Y(grupoMap.get(s.semana)!)] as [number, number] : null))
    .filter((p): p is [number, number] => p !== null);

  // Gridlines "bonitas": 4 cortes redondeados a 0.5.
  const cortes: number[] = [];
  for (let v = Math.ceil(yMin * 2) / 2; v <= yMax; v += 0.5) cortes.push(Number(v.toFixed(1)));

  const fin = pts[pts.length - 1];
  const ult = serie[serie.length - 1];
  const tw = 118, tx = Math.max(L, Math.min(fin[0] - tw / 2, W - R - tw)), ty = Math.max(2, fin[1] - 62);
  // Etiqueta cada ~n puntos para no saturar el eje X.
  const paso = Math.max(1, Math.ceil(serie.length / 7));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full min-h-[220px] w-full" role="img"
      aria-label={`Tu habilidad estimada actual es θ ${ult.theta}, medida en ${serie.length} momentos`}>
      <defs>
        <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={AZUL} stopOpacity={0.26} />
          <stop offset="100%" stopColor={AZUL} stopOpacity={0} />
        </linearGradient>
      </defs>
      {cortes.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="rgb(var(--line))" strokeDasharray="3 5" />
          <text x={L - 8} y={Y(v) + 3.5} textAnchor="end" fontSize={9.5} fill="rgb(var(--muted))">θ {v}</text>
        </g>
      ))}
      {serie.map((s, i) => (i % paso === 0 || i === serie.length - 1) && (
        <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontSize={9.5} fill="rgb(var(--muted))">{s.semana.split('-')[1]}</text>
      ))}
      <path d={`${suavizar(pts)} L ${fin[0]} ${H - B} L ${pts[0][0]} ${H - B} Z`} fill="url(#evoFill)" />
      {ptsGrupo.length >= 2 && <path d={suavizar(ptsGrupo)} fill="none" stroke="rgb(var(--muted))" strokeWidth={1.6} strokeDasharray="5 6" strokeLinecap="round" opacity={0.7} />}
      <path d={suavizar(pts)} fill="none" stroke={AZUL} strokeWidth={2.6} strokeLinecap="round" />
      {/* Punto actual: guía + halo + tooltip */}
      <line x1={fin[0]} y1={fin[1]} x2={fin[0]} y2={H - B} stroke={AZUL} strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
      <circle cx={fin[0]} cy={fin[1]} r={8} fill={AZUL} opacity={0.2} />
      <circle cx={fin[0]} cy={fin[1]} r={4.5} fill="rgb(var(--card))" stroke={AZUL} strokeWidth={2.4} />
      <g>
        <rect x={tx} y={ty} width={tw} height={40} rx={10} fill="rgb(var(--app))" stroke="rgb(var(--line))" />
        <text x={tx + tw / 2} y={ty + 17} textAnchor="middle" fontSize={12.5} fontWeight={800} fill="rgb(var(--fg))">θ {ult.theta}</text>
        <text x={tx + tw / 2} y={ty + 31} textAnchor="middle" fontSize={9.5} fill="rgb(var(--muted))">{ORIGEN[ult.origen] ?? ult.origen} · {ult.semana.split('-')[1]}</text>
      </g>
    </svg>
  );
}

const ORIGEN: Record<string, string> = { pretest: 'Diagnóstico', practica: 'Práctica', subir_nivel: 'Subida de nivel', postest: 'Evaluación final' };

/* ── Fila de "Progreso por unidad" ── */
function FilaUnidad({ u, actual, onClick }: { u: UnidadEstudiante; actual: boolean; onClick: () => void }) {
  const bloqueada = !u.desbloqueada;
  const colorAnillo = bloqueada ? 'rgb(var(--muted))' : NIVEL_COLOR[u.nivel_dominio] ?? VERDE;
  return (
    <button onClick={onClick} disabled={bloqueada}
      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${actual ? 'bg-emerald-500/10 shadow-[inset_3px_0_0_#10B981]' : 'hover:bg-subtle'} ${bloqueada ? 'cursor-not-allowed opacity-55' : ''}`}>
      <Anillo pct={bloqueada ? 0 : u.dominio_pct} color={colorAnillo} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-fg">Unidad {u.numero}</p>
        <p className="truncate text-2xs text-muted">{u.titulo}</p>
      </div>
      {!bloqueada && <span className="text-xs font-semibold" style={{ color: colorAnillo }}>{u.nivel_dominio_label}</span>}
      {u.examen_aprobado ? <Badge tone="green">Completado</Badge>
        : bloqueada ? <span className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-0.5 text-2xs font-bold text-muted"><Lock className="h-3 w-3" /> Bloqueado</span>
          : <Badge tone="amber">En progreso</Badge>}
    </button>
  );
}

/* Pill de nivel: color unificado por nivel (mismo que el badge y la barra en todo
   el sistema) sobre fondo sutil del propio color. */
function PillNivel({ nivel, label }: { nivel: NivelDificultad; label: string }) {
  const color = NIVEL_COLOR[nivel];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide"
      style={{ color, backgroundColor: `${color}26` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {label}
    </span>
  );
}

function FlechaDir({ up }: { up: boolean }) {
  return up
    ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke={VERDE} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="8 7 17 7 17 16" /></svg>
    : <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke={ROJO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="7" x2="17" y2="17" /><polyline points="17 8 17 17 8 17" /></svg>;
}

function hora(fecha: string): string {
  const d = new Date(fecha);
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  const hhmm = d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  return esHoy ? hhmm : `${d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}, ${hhmm}`;
}
