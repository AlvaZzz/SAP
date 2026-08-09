'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Skeleton, Badge, EmptyState, ResponsiveTable } from '@/components/ui';
import { BarChart3, TrendingUp, Activity, Download, Users } from '@/components/icons';

type Tab = 'prepost' | 'progreso' | 'actividad';

interface PrePost {
  por_categoria: { categoria: string; pretest: number | null; postest: number | null }[];
  // Sin `grupo`: el rol docente es ciego a la asignación control/experimental.
  tabla: { id: number; nombre: string; pretest: number | null; postest: number | null; ganancia: number | null; categoria_mas_debil: string | null }[];
  resumen: { estudiantes_con_pretest: number; estudiantes_con_postest: number; promedio_pretest: number | null; promedio_postest: number | null; ganancia_promedio: number | null };
}
interface Progreso { total_estudiantes: number; niveles: { numero: number; titulo: string; estudiantes: number; tiempo_promedio_seg: number }[] }
interface ActividadSemanal { dias: { dia: string; intentos: number; aciertos: number; estudiantes_activos: number }[] }

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'prepost', label: 'Pretest vs Postest', icon: BarChart3 },
  { id: 'progreso', label: 'Progreso por nivel', icon: TrendingUp },
  { id: 'actividad', label: 'Actividad semanal', icon: Activity },
];

export default function DocenteReportesPage() {
  const [tab, setTab] = useState<Tab>('prepost');

  return (
    <div className="animate-fade-up">
      {/* Sin botón de exportación: el CSV de pretest/postest se retiró de este
          rol porque revelaba el grupo del estudio y duplicaba el dataset
          canónico. El análisis se exporta desde el rol investigador. */}
      <PageHeader title="Reportes del curso" subtitle="Avance del curso para el seguimiento pedagógico." />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === id ? 'bg-prexi-blue text-accent-on shadow-soft' : 'border border-line text-muted hover:bg-subtle'}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'prepost' && <TabPrePost />}
      {tab === 'progreso' && <TabProgreso />}
      {tab === 'actividad' && <TabActividad />}
    </div>
  );
}

function TabPrePost() {
  const [d, setD] = useState<PrePost | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { api.get<PrePost>('/docente/reportes/pretest-postest').then(setD).catch(() => undefined).finally(() => setCargando(false)); }, []);

  if (cargando) return <div className="space-y-4"><Skeleton className="h-72" /><Skeleton className="h-64" /></div>;
  if (!d || d.tabla.length === 0) return <EmptyState icon={<BarChart3 className="h-7 w-7" />} title="Sin datos de pretest/postest" hint="Cuando los estudiantes rindan las evaluaciones, verás la comparativa aquí." />;

  const max = 100;
  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Con pretest', value: d.resumen.estudiantes_con_pretest },
          { label: 'Con postest', value: d.resumen.estudiantes_con_postest },
          { label: 'Prom. pretest', value: d.resumen.promedio_pretest ?? '—' },
          { label: 'Ganancia prom.', value: d.resumen.ganancia_promedio != null ? `${d.resumen.ganancia_promedio > 0 ? '+' : ''}${d.resumen.ganancia_promedio}` : '—' },
        ].map((s) => (
          <Card key={s.label} className="text-center !p-4"><p className="font-display text-2xl font-extrabold text-fg">{s.value}</p><p className="text-[11px] uppercase tracking-wide text-muted">{s.label}</p></Card>
        ))}
      </div>

      {/* Gráfico de barras agrupadas por categoría */}
      <Card>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-fg">Promedio por categoría</h3>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-blue" /> Pretest</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-green" /> Postest</span>
          </div>
        </div>
        <div className="space-y-4">
          {d.por_categoria.map((c) => (
            <div key={c.categoria}>
              <p className="mb-1.5 text-sm font-medium text-fg">{c.categoria}</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-4 flex-1 overflow-hidden rounded bg-subtle"><div className="h-full rounded bg-prexi-blue transition-all duration-700" style={{ width: `${((c.pretest ?? 0) / max) * 100}%` }} /></div>
                  <span className="w-10 shrink-0 text-right text-xs text-muted">{c.pretest ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 flex-1 overflow-hidden rounded bg-subtle"><div className="h-full rounded bg-prexi-green transition-all duration-700" style={{ width: `${((c.postest ?? 0) / max) * 100}%` }} /></div>
                  <span className="w-10 shrink-0 text-right text-xs text-muted">{c.postest ?? '—'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tabla por estudiante (tarjetas en móvil) */}
      <ResponsiveTable
        rows={d.tabla}
        rowKey={(r) => r.id}
        cols={[
          { header: 'Estudiante', cell: (r) => <span className="font-medium text-fg">{r.nombre}</span> },
          { header: 'Pretest', cell: (r) => <span className="text-muted">{r.pretest ?? '—'}</span> },
          { header: 'Postest', cell: (r) => <span className="text-muted">{r.postest ?? '—'}</span> },
          {
            header: 'Ganancia',
            cell: (r) => (
              <span className={`font-semibold ${r.ganancia != null && r.ganancia > 0 ? 'text-prexi-green' : r.ganancia != null && r.ganancia < 0 ? 'text-prexi-red' : 'text-muted'}`}>
                {r.ganancia != null ? `${r.ganancia > 0 ? '+' : ''}${r.ganancia}` : '—'}
              </span>
            ),
          },
          { header: 'Categoría más débil', cell: (r) => <span className="text-muted">{r.categoria_mas_debil ?? '—'}</span> },
        ]}
      />
    </div>
  );
}

function TabProgreso() {
  const [d, setD] = useState<Progreso | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { api.get<Progreso>('/docente/reportes/progreso-niveles').then(setD).catch(() => undefined).finally(() => setCargando(false)); }, []);

  if (cargando) return <Skeleton className="h-72" />;
  if (!d || d.total_estudiantes === 0) return <EmptyState icon={<Users className="h-7 w-7" />} title="Sin estudiantes" hint="Aún no hay estudiantes registrados en el grupo." />;
  const max = Math.max(1, ...d.niveles.map((n) => n.estudiantes));
  const tiempo = (s: number) => (s <= 0 ? '—' : s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`);

  return (
    <Card>
      <h3 className="mb-1 font-display text-lg font-bold text-fg">Estudiantes por nivel</h3>
      <p className="mb-5 text-sm text-muted">{d.total_estudiantes} estudiantes en total · el tiempo es el promedio por ejercicio resuelto en cada nivel.</p>
      <div className="space-y-3.5">
        {d.niveles.map((n) => (
          <div key={n.numero} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm font-medium text-fg" title={n.titulo}>Nivel {n.numero} · {n.titulo}</span>
            <div className="h-8 flex-1 overflow-hidden rounded-lg bg-subtle">
              <div className="flex h-full items-center justify-end rounded-lg bg-prexi-blue px-2 text-xs font-bold text-accent-on transition-all duration-700" style={{ width: `${Math.max(6, (n.estudiantes / max) * 100)}%` }}>
                {n.estudiantes > 0 && n.estudiantes}
              </div>
            </div>
            <span className="w-20 shrink-0 text-right text-xs text-muted" title="Tiempo promedio por ejercicio">⏱ {tiempo(n.tiempo_promedio_seg)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TabActividad() {
  const [d, setD] = useState<ActividadSemanal | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { api.get<ActividadSemanal>('/docente/reportes/actividad-semanal').then(setD).catch(() => undefined).finally(() => setCargando(false)); }, []);

  if (cargando) return <Skeleton className="h-72" />;
  if (!d) return <EmptyState icon={<Activity className="h-7 w-7" />} title="Sin actividad" />;
  const max = Math.max(1, ...d.dias.map((x) => x.intentos));
  const dia = (f: string) => new Date(f + 'T00:00').toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric' });

  return (
    <Card>
      <h3 className="mb-5 font-display text-lg font-bold text-fg">Actividad de la semana</h3>
      <div className="flex h-56 items-end gap-3">
        {d.dias.map((x) => (
          <div key={x.dia} className="flex flex-1 flex-col items-center gap-2" title={`${x.intentos} intentos · ${x.aciertos} aciertos · ${x.estudiantes_activos} activos`}>
            <div className="flex w-full flex-1 items-end justify-center">
              <div className="w-full max-w-[48px] rounded-t-lg bg-prexi-blue transition-all duration-700" style={{ height: `${(x.intentos / max) * 100}%`, minHeight: x.intentos ? '6px' : '0' }} />
            </div>
            <span className="text-xs font-semibold text-fg">{x.intentos}</span>
            <span className="text-[10px] capitalize text-muted">{dia(x.dia)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-6 border-t border-line pt-4 text-sm">
        <span className="text-muted">Total intentos: <b className="text-fg">{d.dias.reduce((a, x) => a + x.intentos, 0)}</b></span>
        <span className="text-muted">Aciertos: <b className="text-prexi-green">{d.dias.reduce((a, x) => a + x.aciertos, 0)}</b></span>
      </div>
    </Card>
  );
}
