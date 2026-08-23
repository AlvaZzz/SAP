'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { NivelDificultad, NIVEL_COLOR } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { Card, StatCard, StatGrid, SectionTitle, Skeleton, Badge, EmptyState } from '@/components/ui';
import { EstadoBadge } from '@/components/docente/estado-badge';
import { Users, UserCheck, CheckCircle, AlertTriangle, Star, Code, Target, FileText, BarChart3, ClipboardList } from '@/components/icons';

interface Dashboard {
  stats: { estudiantes_total: number; estudiantes_activos: number; completados_hoy: number; promedio_xp: number; en_riesgo: number; entregas_pendientes: number };
  // Distribución por NIVEL ADAPTATIVO (básico/intermedio/avanzado), que es el
  // que el sistema usa para adaptar. Antes venía del modelo viejo de 5 niveles.
  distribucion_niveles: { nivel: NivelDificultad; numero: number; titulo: string; estudiantes: number }[];
  en_riesgo: { id: number; nombre: string; estado: string; xp: number; ejercicios_completados: number }[];
  actividad_reciente: { estudiante: string; titulo: string; categoria: string; correcto: boolean; xp: number; fecha: string }[];
}

const ACCESOS = [
  { href: '/docente/ejercicios', label: 'Ejercicios', icon: Code },
  { href: '/docente/retos', label: 'Retos', icon: Target },
  { href: '/docente/revisiones', label: 'Revisiones', icon: ClipboardList },
  { href: '/docente/documentos', label: 'Documentos', icon: FileText },
  { href: '/docente/estudiantes', label: 'Estudiantes', icon: Users },
  { href: '/docente/reportes', label: 'Reportes', icon: BarChart3 },
];

export default function DocenteDashboardPage() {
  const { usuario } = useAuth();
  const [d, setD] = useState<Dashboard | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Dashboard>('/docente/dashboard').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const maxNivel = d ? Math.max(1, ...d.distribucion_niveles.map((n) => n.estudiantes)) : 1;
  const hora = (f: string) => new Date(f).toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl lg:text-4xl">
        Panel del docente
      </h1>
      <p className="mb-7 mt-1 text-[15px] text-muted">Resumen del grupo, {usuario?.nombre.split(' ')[0]}.</p>

      {/* Stat cards */}
      <StatGrid className="mb-6">
        {cargando ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <StatCard icon={<UserCheck className="h-7 w-7" />} accent="blue" label="Estudiantes activos" value={`${d?.stats.estudiantes_activos ?? 0}/${d?.stats.estudiantes_total ?? 0}`} />
            <StatCard icon={<CheckCircle className="h-7 w-7" />} accent="green" label="Completados hoy" value={d?.stats.completados_hoy ?? 0} />
            <StatCard icon={<Star className="h-7 w-7" />} accent="navy" label="XP promedio" value={d?.stats.promedio_xp ?? 0} />
            <StatCard icon={<AlertTriangle className="h-7 w-7" />} accent="amber" label="En riesgo" value={d?.stats.en_riesgo ?? 0} />
            <Link href="/docente/revisiones" className="block">
              <StatCard icon={<ClipboardList className="h-7 w-7" />} accent="blue" label="Por revisar" value={d?.stats.entregas_pendientes ?? 0} />
            </Link>
          </>
        )}
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Distribución por nivel */}
        <Card className="min-w-0 lg:col-span-2">
          <SectionTitle className="mb-1">Distribución de estudiantes por nivel</SectionTitle>
          <p className="mb-5 text-xs text-muted">Nivel adaptativo (dominio combinado de todos sus temas), que es el que decide qué ejercicios recibe cada estudiante.</p>
          {cargando ? <div className="space-y-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}</div> : (
            <div className="space-y-3.5">
              {d?.distribucion_niveles.map((n) => (
                <div key={n.nivel} className="flex items-center gap-3">
                  {/* Etiqueta y color del NIVEL ADAPTATIVO: los mismos que ve el
                      estudiante en su vista de unidad, para que docente y
                      estudiante nunca lean cifras que se contradigan. */}
                  <span className="w-28 shrink-0 text-sm font-medium text-fg">{n.titulo}</span>
                  <div className="h-7 flex-1 overflow-hidden rounded-lg bg-subtle">
                    <div className="flex h-full items-center justify-end rounded-lg px-2 text-xs font-bold text-white transition-all duration-700"
                      style={{ width: `${Math.max(6, (n.estudiantes / maxNivel) * 100)}%`, backgroundColor: NIVEL_COLOR[n.nivel] }}>
                      {n.estudiantes > 0 && n.estudiantes}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* En riesgo */}
        <Card className="min-w-0">
          <div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-prexi-amber" /><SectionTitle>Requieren atención</SectionTitle></div>
          {cargando ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
            : d && d.en_riesgo.length > 0 ? (
              <div className="space-y-2.5">
                {d.en_riesgo.map((e) => (
                  <Link key={e.id} href={`/docente/estudiantes?id=${e.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 transition hover:border-prexi-blue/40 hover:bg-subtle">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-fg">{e.nombre}</p><p className="text-xs text-muted">{e.ejercicios_completados} ejercicios · {e.xp} XP</p></div>
                    <EstadoBadge estado="en_riesgo" />
                  </Link>
                ))}
              </div>
            ) : <p className="py-6 text-center text-sm text-muted">Ningún estudiante en riesgo.</p>}
        </Card>
      </div>

      {/* Actividad reciente + accesos rápidos */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <SectionTitle className="mb-4">Actividad reciente del grupo</SectionTitle>
          {cargando ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>
            : d && d.actividad_reciente.length > 0 ? (
              <div className="divide-y divide-line">
                {d.actividad_reciente.map((a, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-2.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.correcto ? 'bg-prexi-green' : 'bg-prexi-red'}`} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm text-fg"><b className="font-semibold">{a.estudiante}</b> · {a.titulo}</p></div>
                    <Badge tone="blue" className="hidden sm:inline-flex">{a.categoria}</Badge>
                    <span className="hidden shrink-0 text-xs text-muted sm:inline">{hora(a.fecha)}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="Sin actividad todavía" hint="Cuando los estudiantes resuelvan ejercicios, aparecerá aquí." />}
        </Card>

        <Card>
          <SectionTitle className="mb-4">Accesos rápidos</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {ACCESOS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-xl border border-line p-4 text-center transition hover:border-prexi-blue/40 hover:bg-subtle">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-prexi-blue/10 text-prexi-blue-deep"><Icon className="h-5 w-5" /></div>
                <span className="text-sm font-medium text-fg">{label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
