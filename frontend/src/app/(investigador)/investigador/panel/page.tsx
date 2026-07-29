'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, StatCard, StatGrid, SectionTitle, Skeleton, ProgressBar, EmptyState, ResponsiveTable, PageHeader } from '@/components/ui';
import { Users, UserCheck, GraduationCap, CheckCircle, ClipboardList, Calendar } from '@/components/icons';

interface Panel {
  muestra: { total: number; control: number; experimental: number };
  instituciones: { institucion: string; total: number; control: number; experimental: number }[];
  avance: { con_pretest: number; con_postest: number; completaron_intervencion: number; pct_pretest: number; pct_postest: number };
  recoleccion: { inicio: string | null; fin: string | null };
}

export default function PanelEstudioPage() {
  const [d, setD] = useState<Panel | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Panel>('/investigador/panel').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const fecha = (f: string | null) => (f ? new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

  return (
    <div className="animate-fade-up">
      <PageHeader title="Panel del estudio" subtitle="Resumen de la muestra y avance de la recolección de datos (solo lectura)." />

      {/* Muestra */}
      <StatGrid className="mb-6">
        {cargando ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <StatCard icon={<Users className="h-7 w-7" />} accent="blue" label="Muestra total (n)" value={d?.muestra.total ?? 0} />
            <StatCard icon={<UserCheck className="h-7 w-7" />} accent="navy" label="Grupo control" value={d?.muestra.control ?? 0} />
            <StatCard icon={<GraduationCap className="h-7 w-7" />} accent="green" label="Grupo experimental" value={d?.muestra.experimental ?? 0} />
            <StatCard icon={<CheckCircle className="h-7 w-7" />} accent="blue" label="Completaron intervención" value={d?.avance.completaron_intervencion ?? 0} />
          </>
        )}
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Avance de la recolección */}
        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-prexi-blue-deep" /><SectionTitle>Avance de la recolección</SectionTitle></div>
          {cargando ? <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            : !d || d.muestra.total === 0 ? <EmptyState icon={<Users className="h-7 w-7" />} title="Aún no hay datos suficientes" hint="Cuando los estudiantes se registren y rindan las evaluaciones, verás el avance aquí." />
            : (
              <div className="space-y-5">
                <Avance label="Rindieron el pretest" valor={d.avance.con_pretest} total={d.muestra.total} pct={d.avance.pct_pretest} tone="blue" />
                <Avance label="Rindieron el postest" valor={d.avance.con_postest} total={d.muestra.total} pct={d.avance.pct_postest} tone="green" />
                <div className="rounded-xl bg-subtle p-4 text-sm text-muted">
                  <b className="text-fg">{d.avance.completaron_intervencion}</b> estudiantes completaron la intervención (rindieron pretest y postest) — base para la comparación estadística.
                </div>
              </div>
            )}
        </Card>

        {/* Fechas de recolección */}
        <Card>
          <div className="mb-4 flex items-center gap-2"><Calendar className="h-5 w-5 text-prexi-blue-deep" /><SectionTitle>Periodo</SectionTitle></div>
          {cargando ? <Skeleton className="h-24" /> : (
            <div className="space-y-4">
              <div><p className="text-xs uppercase tracking-wide text-muted">Inicio</p><p className="font-display text-lg font-bold text-fg">{fecha(d?.recoleccion.inicio ?? null)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted">Último registro</p><p className="font-display text-lg font-bold text-fg">{fecha(d?.recoleccion.fin ?? null)}</p></div>
            </div>
          )}
        </Card>
      </div>

      {/* Desglose por institución */}
      <div className="mt-6">
        {cargando ? <Card className="!p-0"><div className="space-y-2 p-6">{[0, 1].map((i) => <Skeleton key={i} className="h-10" />)}</div></Card>
          : !d || d.instituciones.length === 0 ? <Card><SectionTitle>Desglose por institución / cohorte</SectionTitle><p className="py-6 text-center text-sm text-muted">Sin datos de institución.</p></Card>
          : (
            <>
              <SectionTitle className="mb-3">Desglose por institución / cohorte</SectionTitle>
              <ResponsiveTable
                rows={d.instituciones}
                rowKey={(i) => i.institucion}
                cols={[
                  { header: 'Institución / cohorte', cell: (i) => <span className="font-medium text-fg">{i.institucion}</span> },
                  { header: 'Total', cell: (i) => <span className="text-fg">{i.total}</span> },
                  { header: 'Control', cell: (i) => <span className="text-muted">{i.control}</span> },
                  { header: 'Experimental', cell: (i) => <span className="text-muted">{i.experimental}</span> },
                ]}
              />
            </>
          )}
      </div>
    </div>
  );
}

function Avance({ label, valor, total, pct, tone }: { label: string; valor: number; total: number; pct: number; tone: 'blue' | 'green' }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-fg">{label}</span>
        <span className="text-muted">{valor}/{total} · {pct}%</span>
      </div>
      <ProgressBar value={pct} tone={tone} />
    </div>
  );
}
