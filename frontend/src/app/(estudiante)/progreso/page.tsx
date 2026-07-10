'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { api } from '@/lib/api';
import { NivelDificultad, NIVEL_COLOR } from '@/lib/types';
import { Card, SectionTitle, Badge, Skeleton, Select } from '@/components/ui';
import { RangoIcon } from '@/components/rango-icon';
import { TrendingUp, Sparkles, CheckCircle, Lock, Play } from '@/components/icons';

interface Cat { categoria: string; pretest: number | null; postest: number | null; mejora: number | null; promedio_grupal: number | null }
interface NivelP { numero: number; titulo: string; umbral: number; ejercicios_completados: number; desbloqueado: boolean; estado: string }
interface Sesion { titulo: string; categoria: string; correcto: boolean; xp: number; tiempo_seg: number; fecha: string }
interface Datos { comparativa: Cat[]; pretest_total: number | null; postest_total: number | null; ganancia: number | null; niveles: NivelP[]; sesiones: Sesion[] }

interface RangoInfo { clave: string; nombre: string; orden: number; svgKey: string; color: string }
interface RangoResumen {
  global: { puntaje: number; rango: RangoInfo; siguiente: { nombre: string; umbral: number; faltan: number } | null };
  unidades: { unidadId: number; numero: number; titulo: string; puntaje: number; rango: RangoInfo }[];
}
interface TemaDet { temaId: number; numero: string; titulo: string; total_ejercicios: number; dominio: number; promedio_grupal: number; nivel_alcanzado: NivelDificultad; nivel_alcanzado_label: string }
interface UnidadDet { unidadId: number; numero: number; titulo: string; temas: TemaDet[]; nivel_dominio: NivelDificultad; nivel_dominio_label: string; dominio_pct: number }

// Paleta sobria de las gráficas (misma que tailwind.config).
const AZUL = '#2C4A6E';
const VERDE = '#2E7D5B';

export default function ProgresoPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [rangos, setRangos] = useState<RangoResumen | null>(null);
  const [detalle, setDetalle] = useState<UnidadDet[]>([]);
  const [unidadSel, setUnidadSel] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/progreso').then(setD).catch(() => undefined).finally(() => setCargando(false));
    api.get<RangoResumen>('/gamificacion/rangos').then(setRangos).catch(() => undefined);
    api.get<{ unidades: UnidadDet[] }>('/progreso/detalle').then((r) => {
      setDetalle(r.unidades);
      if (r.unidades.length) setUnidadSel(r.unidades[0].unidadId);
    }).catch(() => undefined);
  }, []);

  if (cargando) return <div className="space-y-5">{[0, 1].map((i) => <Skeleton key={i} className="h-44" />)}</div>;
  if (!d) return null;

  const unidadActual = detalle.find((u) => u.unidadId === unidadSel) ?? null;

  const hayPost = d.postest_total != null;
  // Radar: perfil propio (postest si existe; si no, pretest) vs promedio grupal.
  const radar = d.comparativa
    .filter((c) => (c.postest ?? c.pretest) != null)
    .map((c) => ({
      categoria: c.categoria.length > 12 ? c.categoria.slice(0, 11) + '…' : c.categoria,
      perfil: c.postest ?? c.pretest ?? 0,
      grupo: c.promedio_grupal ?? 0,
    }));
  const barras = d.comparativa.map((c) => ({
    categoria: c.categoria, Pretest: c.pretest ?? 0, Postest: c.postest ?? 0, mejora: c.mejora,
  }));
  const fuerte = [...d.comparativa].sort((a, b) => (b.postest ?? b.pretest ?? 0) - (a.postest ?? a.pretest ?? 0))[0];
  const debil = [...d.comparativa].sort((a, b) => (a.postest ?? a.pretest ?? 0) - (b.postest ?? b.pretest ?? 0))[0];

  return (
    <div className="animate-fade-up">
      {/* Banner: rango, pretest, postest y ganancia en grande */}
      <div className="card mb-6 border-0 bg-gradient-to-r from-prexi-navy-deep to-prexi-navy text-white" data-tour="progreso-banner">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {/* Rango de programador (arriba, antes de los datos) */}
            {rangos && (
              <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 pr-5">
                <RangoIcon svgKey={rangos.global.rango.svgKey} color={rangos.global.rango.color} className="h-14 w-14" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200/70">Tu rango</p>
                  <p className="font-display text-xl font-extrabold leading-tight">{rangos.global.rango.nombre}</p>
                  {rangos.global.siguiente
                    ? <p className="text-[11px] text-blue-100/70">Te faltan {rangos.global.siguiente.faltan} pts para {rangos.global.siguiente.nombre}</p>
                    : <p className="text-[11px] text-amber-200/90">¡Rango máximo alcanzado!</p>}
                </div>
              </div>
            )}
            <div>
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Reporte semestral</span>
              <h1 className="mt-2 font-display text-2xl font-extrabold">Tu progreso académico</h1>
              <p className="text-sm text-blue-100/80">Crecimiento entre tu evaluación inicial y la final.</p>
            </div>
          </div>
          <div className="flex items-center gap-7">
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200/70">Pretest</p><p className="font-display text-3xl font-extrabold">{d.pretest_total ?? '—'}</p></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200/70">Postest</p><p className="font-display text-3xl font-extrabold">{hayPost ? d.postest_total : '—'}</p></div>
            {hayPost ? (
              <div className="rounded-2xl bg-prexi-green px-5 py-3 text-center"><div className="flex items-center justify-center gap-1.5"><TrendingUp className="h-5 w-5" /><p className="font-display text-2xl font-extrabold">{d.ganancia != null && d.ganancia >= 0 ? '+' : ''}{d.ganancia}</p></div><p className="text-[11px] text-green-50">puntos de mejora</p></div>
            ) : <div className="rounded-2xl bg-white/10 px-5 py-3 text-center text-xs text-blue-100/80">Postest disponible<br />al avanzar el curso</div>}
          </div>
        </div>
        {/* Barra de progreso hacia el siguiente rango */}
        {rangos && rangos.global.siguiente && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-[11px] text-blue-100/70">
              <span>{rangos.global.rango.nombre}</span>
              <span>{rangos.global.puntaje} / {rangos.global.siguiente.umbral} pts</span>
              <span>{rangos.global.siguiente.nombre}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-prexi-amber transition-all" style={{ width: `${Math.min(100, Math.round((rangos.global.puntaje / rangos.global.siguiente.umbral) * 100))}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Comparativa por tema: barras horizontales dobles */}
        <Card hover data-tour="progreso-comparativa">
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Comparativa por tema</SectionTitle>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: AZUL }} /> Pretest</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: VERDE }} /> Postest</span>
            </div>
          </div>
          {!barras.length ? (
            <p className="py-16 text-center text-sm text-muted">Aún no hay evaluaciones registradas. Completa el pretest para ver tu comparativa.</p>
          ) : (
            <div className="rounded-xl bg-subtle p-3">
              <ResponsiveContainer width="100%" height={Math.max(220, barras.length * 64)}>
                <BarChart data={barras} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barGap={4}>
                  <CartesianGrid horizontal={false} stroke="rgb(var(--line))" strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} unit="%" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="categoria" width={104} tick={{ fontSize: 11, fill: 'rgb(var(--fg))' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v) => `${v ?? 0}%`}
                    contentStyle={{ background: 'rgb(var(--card))', border: '1px solid rgb(var(--line))', borderRadius: 12, fontSize: 12, color: 'rgb(var(--fg))' }}
                    cursor={{ fill: 'rgb(var(--line) / 0.35)' }}
                  />
                  <Bar dataKey="Pretest" fill={AZUL} radius={[0, 6, 6, 0]} barSize={12} />
                  <Bar dataKey="Postest" fill={VERDE} radius={[0, 6, 6, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {hayPost && barras.some((b) => (b.mejora ?? 0) > 0) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {d.comparativa.filter((c) => (c.mejora ?? 0) > 0).map((c) => (
                <span key={c.categoria} className="rounded-full bg-prexi-green-soft px-2.5 py-1 text-[11px] font-semibold text-prexi-green dark:bg-prexi-green/20">{c.categoria}: +{c.mejora}%</span>
              ))}
            </div>
          )}
        </Card>

        {/* Radar de competencias: tu perfil vs promedio grupal */}
        <Card hover data-tour="progreso-radar">
          <SectionTitle className="mb-1">Radar de competencias</SectionTitle>
          <p className="mb-2 text-sm text-muted">Tu perfil frente al promedio del grupo.</p>
          {radar.length >= 3 ? (
            <>
              <ResponsiveContainer width="100%" height={290}>
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="rgb(var(--line))" />
                  <PolarAngleAxis dataKey="categoria" tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Tu perfil" dataKey="perfil" stroke={AZUL} fill={AZUL} fillOpacity={0.28} strokeWidth={2} />
                  <Radar name="Promedio grupal" dataKey="grupo" stroke="rgb(var(--muted))" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(v) => `${v ?? 0}%`}
                    contentStyle={{ background: 'rgb(var(--card))', border: '1px solid rgb(var(--line))', borderRadius: 12, fontSize: 12, color: 'rgb(var(--fg))' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </>
          ) : <p className="py-16 text-center text-sm text-muted">El radar se dibuja cuando tienes al menos 3 temas evaluados (pretest o postest).</p>}
          {fuerte && debil && fuerte.categoria !== debil.categoria && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-prexi-blue/10 p-3.5 text-sm text-fg"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" /><span>Tu punto más fuerte es <b className="text-fg">{fuerte.categoria}</b>. Refuerza <b className="text-fg">{debil.categoria}</b>.</span></div>
          )}
        </Card>
      </div>

      {/* Progreso detallado por Unidad → Tema (radar + barras + mensaje) */}
      {detalle.length > 0 && (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-fg">Dominio detallado por unidad</h2>
            <div className="flex items-center gap-2">
              {rangos && unidadActual && (() => {
                const ru = rangos.unidades.find((x) => x.unidadId === unidadActual.unidadId);
                return ru ? <span className="flex items-center gap-1.5 text-sm text-muted"><RangoIcon svgKey={ru.rango.svgKey} color={ru.rango.color} className="h-6 w-6" /> {ru.rango.nombre}</span> : null;
              })()}
              <Select value={unidadSel ?? ''} onChange={(e) => setUnidadSel(Number(e.target.value))} className="!w-auto">
                {detalle.map((u) => <option key={u.unidadId} value={u.unidadId}>Unidad {u.numero}: {u.titulo}</option>)}
              </Select>
            </div>
          </div>

          {unidadActual && <DetalleUnidad unidad={unidadActual} />}
        </div>
      )}

      {/* Progreso por nivel: 5 mini-cards con barra y estado */}
      <h2 className="mb-4 mt-8 font-display text-xl font-bold text-fg">Progreso por nivel</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" data-tour="progreso-niveles">
        {d.niveles.map((n) => {
          const completo = n.estado === 'completado'; const enProg = n.estado === 'en_progreso';
          const pct = Math.min(100, Math.round((n.ejercicios_completados / Math.max(1, n.umbral)) * 100));
          return (
            <div key={n.numero} className={`card card-hover !p-4 ${enProg ? 'border-prexi-blue ring-1 ring-prexi-blue/30' : ''} ${n.estado === 'bloqueado' ? 'opacity-70' : ''}`}>
              <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">Nivel {n.numero}</span>{completo ? <CheckCircle className="h-4 w-4 text-prexi-green" /> : enProg ? <Play className="h-4 w-4 text-prexi-blue-deep" /> : <Lock className="h-4 w-4 text-muted" />}</div>
              <p className="text-sm font-semibold leading-tight text-fg">{n.titulo}</p>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                <div className={`h-full rounded-full ${completo ? 'bg-prexi-green' : 'bg-prexi-blue'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted">{n.ejercicios_completados}/{n.umbral} ejercicios</p>
              <Badge tone={completo ? 'green' : enProg ? 'blue' : 'slate'} className="mt-2">{completo ? 'Completado' : enProg ? 'En progreso' : 'Bloqueado'}</Badge>
            </div>
          );
        })}
      </div>

      {/* Sesiones recientes */}
      <h2 className="mb-4 mt-8 font-display text-xl font-bold text-fg">Sesiones recientes</h2>
      <div className="card !p-0 overflow-hidden">
        {d.sesiones.length === 0 && <p className="p-6 text-center text-sm text-muted">Aún no tienes actividad registrada. Resuelve tu primer ejercicio para verla aquí.</p>}
        {d.sesiones.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 transition last:border-0 hover:bg-subtle">
            <div className="flex items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${s.correcto ? 'bg-prexi-green' : 'bg-prexi-red'}`} /><div><p className="text-sm font-medium text-fg">{s.titulo}</p><p className="text-xs text-muted">{s.categoria} · {new Date(s.fecha).toLocaleDateString('es-BO')}</p></div></div>
            <span className="text-sm font-semibold text-prexi-blue-deep">+{s.xp} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Radar por tema (dominio vs promedio grupal), barras y mensaje motivador contextual. */
function DetalleUnidad({ unidad }: { unidad: UnidadDet }) {
  if (unidad.temas.length === 0) {
    return <Card><p className="py-10 text-center text-sm text-muted">Esta unidad aún no tiene temas con ejercicios publicados.</p></Card>;
  }
  const radar = unidad.temas.map((t) => ({
    tema: t.numero, titulo: t.titulo,
    dominio: t.dominio, grupo: t.promedio_grupal,
  }));
  const fuerte = [...unidad.temas].sort((a, b) => b.dominio - a.dominio)[0];
  const debil = [...unidad.temas].sort((a, b) => a.dominio - b.dominio)[0];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Radar por tema */}
      <Card hover>
        <SectionTitle className="mb-1">Radar de la Unidad {unidad.numero}</SectionTitle>
        <p className="mb-2 text-sm text-muted">Tu dominio por tema frente al promedio del grupo.</p>
        {radar.length >= 3 ? (
          <ResponsiveContainer width="100%" height={290}>
            <RadarChart data={radar} outerRadius="72%">
              <PolarGrid stroke="rgb(var(--line))" />
              <PolarAngleAxis dataKey="tema" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Tu dominio" dataKey="dominio" stroke={AZUL} fill={AZUL} fillOpacity={0.28} strokeWidth={2} />
              <Radar name="Promedio grupal" dataKey="grupo" stroke="rgb(var(--muted))" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `${v ?? 0}%`} labelFormatter={(l) => radar.find((r) => r.tema === l)?.titulo ?? l}
                contentStyle={{ background: 'rgb(var(--card))', border: '1px solid rgb(var(--line))', borderRadius: 12, fontSize: 12, color: 'rgb(var(--fg))' }} />
            </RadarChart>
          </ResponsiveContainer>
        ) : <p className="py-16 text-center text-sm text-muted">El radar por tema aparece cuando la unidad tiene al menos 3 temas.</p>}
      </Card>

      {/* Comparativa por tema (dominio vs grupo) + mensaje motivador */}
      <Card hover>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Dominio por tema</SectionTitle>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-subtle px-2.5 py-1 text-[11px] font-semibold text-fg">
            Dominio de la unidad: <b style={{ color: NIVEL_COLOR[unidad.nivel_dominio] }}>{unidad.nivel_dominio_label}</b>
          </span>
        </div>
        <p className="mb-3 text-[11px] text-muted"><b className="text-fg">Nivel</b> = dificultad de tus ejercicios (Básico/Intermedio/Avanzado). <b className="text-fg">Rango</b> = tu insignia de gamificación por desempeño.</p>
        <div className="space-y-3.5">
          {unidad.temas.map((t) => (
            <div key={t.temaId}>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-sm">
                <span className="flex flex-wrap items-center gap-1.5 font-medium text-fg">
                  {t.numero} {t.titulo}
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: NIVEL_COLOR[t.nivel_alcanzado] }} title="Tu nivel de dificultad en este tema">{t.nivel_alcanzado_label}</span>
                </span>
                <span className="text-muted">{t.dominio}% <span className="text-[11px]">(grupo {t.promedio_grupal}%)</span></span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-subtle">
                <div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${t.dominio}%` }} />
                {/* Marca del promedio grupal */}
                <span className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-muted" style={{ left: `${t.promedio_grupal}%` }} title={`Promedio grupal ${t.promedio_grupal}%`} />
              </div>
            </div>
          ))}
        </div>
        {fuerte && debil && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-prexi-blue/10 p-3.5 text-sm text-fg">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" />
            <span>
              Tu punto más fuerte en la <b>Unidad {unidad.numero}</b> es <b className="text-fg">{fuerte.titulo}</b> ({fuerte.dominio}%).
              {fuerte.temaId !== debil.temaId && <> Refuerza <b className="text-fg">{debil.titulo}</b> ({debil.dominio}%) para subir de rango.</>}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
