'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, SectionTitle, Skeleton, Badge, EmptyState, PageHeader, ResponsiveTable } from '@/components/ui';
import { BarChart3, TrendingUp } from '@/components/icons';

interface Desc { n: number; media: number | null; sd: number | null; min: number | null; max: number | null }
interface Grupo { grupo: 'control' | 'experimental'; n: number; con_pretest: number; con_postest: number; pretest: Desc; postest: Desc; ganancia_media: number | null }
interface Cat { categoria: string; control_pre: number | null; control_post: number | null; experimental_pre: number | null; experimental_post: number | null }
interface Resultados { hay_datos: boolean; resumen_grupos: Grupo[]; por_categoria: Cat[] }

const NOMBRE: Record<string, string> = { control: 'Control', experimental: 'Experimental' };

export default function ResultadosPage() {
  const [d, setD] = useState<Resultados | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Resultados>('/investigador/resultados').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  if (!d || !d.hay_datos) return (
    <div className="animate-fade-up">
      <Encabezado />
      <EmptyState icon={<BarChart3 className="h-7 w-7" />} title="Aún no hay datos suficientes para mostrar resultados" hint="Cuando los estudiantes rindan el pretest y el postest, aparecerán aquí las comparativas y los descriptivos." />
    </div>
  );

  const maxMedia = 100;

  return (
    <div className="animate-fade-up">
      <Encabezado />

      {/* Comparativa pretest vs postest por grupo */}
      <Card className="mb-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Pretest vs postest por grupo</SectionTitle>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-blue" /> Pretest</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-green" /> Postest</span>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {d.resumen_grupos.map((g) => (
            <div key={g.grupo} className="rounded-2xl border border-line p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display font-bold text-fg">Grupo {NOMBRE[g.grupo]}</p>
                <Badge tone={g.grupo === 'experimental' ? 'green' : 'slate'}>n = {g.n}</Badge>
              </div>
              <BarraDoble pre={g.pretest.media} post={g.postest.media} max={maxMedia} />
              <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-subtle py-2 text-sm">
                <TrendingUp className={`h-4 w-4 ${(g.ganancia_media ?? 0) >= 0 ? 'text-prexi-green' : 'text-prexi-red'}`} />
                <span className="text-muted">Ganancia media:</span>
                <b className={(g.ganancia_media ?? 0) >= 0 ? 'text-prexi-green' : 'text-prexi-red'}>
                  {g.ganancia_media != null ? `${g.ganancia_media > 0 ? '+' : ''}${g.ganancia_media}` : '—'}
                </b>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Estadística descriptiva */}
      <div className="mb-6">
        <SectionTitle>Estadística descriptiva por grupo</SectionTitle>
        <p className="mb-3 mt-1 text-sm text-muted">Media, desviación estándar, mínimo y máximo. La prueba t se realiza fuera del sistema con el CSV exportado.</p>
        <ResponsiveTable
          rows={d.resumen_grupos.flatMap((g) => ([
            { key: `${g.grupo}-pre`, grupo: NOMBRE[g.grupo], prueba: 'Pretest', desc: g.pretest },
            { key: `${g.grupo}-post`, grupo: NOMBRE[g.grupo], prueba: 'Postest', desc: g.postest },
          ]))}
          rowKey={(r) => r.key}
          cols={[
            { header: 'Grupo', cell: (r) => <span className="font-medium text-fg">{r.prueba === 'Pretest' ? r.grupo : ''}</span> },
            { header: 'Prueba', cell: (r) => <span className="text-muted">{r.prueba}</span> },
            { header: 'n', cell: (r) => <span className="text-muted">{r.desc.n}</span> },
            { header: 'Media', cell: (r) => <span className="font-semibold text-fg">{r.desc.media ?? '—'}</span> },
            { header: 'Desv. est.', cell: (r) => <span className="text-muted">{r.desc.sd ?? '—'}</span> },
            { header: 'Mín', cell: (r) => <span className="text-muted">{r.desc.min ?? '—'}</span> },
            { header: 'Máx', cell: (r) => <span className="text-muted">{r.desc.max ?? '—'}</span> },
          ]}
          card={(r) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><span className="font-medium text-fg">{r.grupo}</span><Badge tone={r.prueba === 'Postest' ? 'green' : 'blue'}>{r.prueba}</Badge></div>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {[['n', r.desc.n], ['Media', r.desc.media ?? '—'], ['DE', r.desc.sd ?? '—'], ['Mín', r.desc.min ?? '—'], ['Máx', r.desc.max ?? '—']].map(([l, v]) => (
                  <div key={String(l)} className="rounded-lg bg-subtle px-1 py-1.5"><p className="text-[10px] uppercase text-muted">{l}</p><p className="text-sm font-semibold text-fg">{v}</p></div>
                ))}
              </div>
            </div>
          )}
        />
      </div>

      {/* Comparativa por categoría */}
      <Card>
        <SectionTitle className="mb-1">Comparativa por categoría</SectionTitle>
        <p className="mb-5 text-sm text-muted">Promedio de acierto (%) por área temática. Pretest → postest de cada grupo.</p>
        <div className="space-y-5">
          {d.por_categoria.map((c) => (
            <div key={c.categoria}>
              <p className="mb-2 text-sm font-semibold text-fg">{c.categoria}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CatGrupo titulo="Control" pre={c.control_pre} post={c.control_post} />
                <CatGrupo titulo="Experimental" pre={c.experimental_pre} post={c.experimental_post} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Encabezado() {
  return <PageHeader title="Resultados pretest / postest" subtitle="Estadística descriptiva por grupo. La inferencial (prueba t) se hace fuera del sistema." />;
}

function BarraDoble({ pre, post, max }: { pre: number | null; post: number | null; max: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-xs text-muted">Pretest</span>
        <div className="h-5 flex-1 overflow-hidden rounded bg-subtle"><div className="h-full rounded bg-prexi-blue transition-all duration-700" style={{ width: `${((pre ?? 0) / max) * 100}%` }} /></div>
        <span className="w-9 shrink-0 text-right text-xs font-semibold text-fg">{pre ?? '—'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-xs text-muted">Postest</span>
        <div className="h-5 flex-1 overflow-hidden rounded bg-subtle"><div className="h-full rounded bg-prexi-green transition-all duration-700" style={{ width: `${((post ?? 0) / max) * 100}%` }} /></div>
        <span className="w-9 shrink-0 text-right text-xs font-semibold text-fg">{post ?? '—'}</span>
      </div>
    </div>
  );
}

function CatGrupo({ titulo, pre, post }: { titulo: string; pre: number | null; post: number | null }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{titulo}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="h-3.5 flex-1 overflow-hidden rounded bg-subtle"><div className="h-full rounded bg-prexi-blue" style={{ width: `${pre ?? 0}%` }} /></div>
          <span className="w-8 shrink-0 text-right text-xs text-muted">{pre ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3.5 flex-1 overflow-hidden rounded bg-subtle"><div className="h-full rounded bg-prexi-green" style={{ width: `${post ?? 0}%` }} /></div>
          <span className="w-8 shrink-0 text-right text-xs text-muted">{post ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}
