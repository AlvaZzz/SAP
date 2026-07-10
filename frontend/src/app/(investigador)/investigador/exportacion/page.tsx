'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, SectionTitle, Skeleton, Badge, EmptyState, ResponsiveTable, PageHeader } from '@/components/ui';
import { Download, Database, CheckCircle } from '@/components/icons';

interface PorCat { variables: number | null; condicionales: number | null; bucles: number | null; funciones: number | null; estructuras: number | null }
interface Fila {
  id_anonimo: string; grupo: 'control' | 'experimental'; institucion: string;
  pretest_total: number | null; postest_total: number | null; ganancia: number | null;
  pre: PorCat; post: PorCat; tiempo_pretest: number | null; tiempo_postest: number | null;
  ejercicios_resueltos: number; tiempo_promedio_ejercicio: number; xp_total: number; racha: number;
  consultas_ia: number; pistas_usadas: number; retos_entregados: number;
}

const COLUMNAS = [
  'id_anonimo', 'grupo', 'institucion', 'pretest_total', 'postest_total', 'ganancia',
  'pretest/postest por categoría (Variables, Condicionales, Bucles, Funciones, Estructuras)',
  'tiempo_pretest', 'tiempo_postest', 'ejercicios_resueltos', 'tiempo_promedio_ejercicio',
  'xp_total', 'racha', 'consultas_ia', 'pistas_usadas', 'retos_entregados',
];

export default function ExportacionPage() {
  const [filas, setFilas] = useState<Fila[] | null>(null);

  useEffect(() => {
    api.get<{ dataset: Fila[] }>('/investigador/exportacion/dataset').then((r) => setFilas(r.dataset)).catch(() => setFilas([]));
  }, []);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Exportación del dataset" subtitle="Dataset consolidado y anonimizado, listo para la prueba t de Student en Google Colab."
        action={<a href="/api/investigador/exportacion/export.csv" className="btn-primary"><Download className="h-4 w-4" /> Exportar CSV</a>} />

      {/* Aviso de anonimización + columnas */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="flex items-start gap-3 lg:col-span-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-prexi-green"><CheckCircle className="h-5 w-5" /></div>
          <div>
            <p className="font-semibold text-fg">Exportación anonimizada (ética de investigación)</p>
            <p className="mt-1 text-sm text-muted">Sin nombres, correos ni cédulas: cada estudiante se identifica con <code className="rounded bg-subtle px-1 text-xs">id_anonimo</code>. Incluye el <b>grupo</b> (control/experimental), imprescindible para la comparación estadística. Una fila por estudiante, valores desde la actividad real.</p>
          </div>
        </Card>
        <Card>
          <div className="mb-2 flex items-center gap-2"><Database className="h-4 w-4 text-prexi-blue-deep" /><p className="text-sm font-semibold text-fg">Columnas incluidas</p></div>
          <ul className="space-y-1 text-xs text-muted">
            {COLUMNAS.map((c) => <li key={c} className="flex gap-1.5"><span className="text-prexi-blue-deep">•</span> {c}</li>)}
          </ul>
        </Card>
      </div>

      {/* Vista previa (tabla en escritorio, tarjetas en móvil) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Vista previa</SectionTitle>
          {filas && filas.length > 0 && <Badge tone="blue">{filas.length} estudiantes</Badge>}
        </div>
        {filas === null ? <Card className="!p-0"><div className="space-y-2 p-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div></Card>
          : filas.length === 0 ? <EmptyState icon={<Database className="h-7 w-7" />} title="Aún no hay datos para exportar" hint="Cuando existan estudiantes con actividad registrada, el dataset aparecerá aquí." />
          : (
            <ResponsiveTable
              rows={filas}
              rowKey={(f) => f.id_anonimo}
              cols={[
                { header: 'ID', cell: (f) => <span className="font-mono text-xs font-semibold text-fg">{f.id_anonimo}</span> },
                { header: 'Grupo', cell: (f) => <Badge tone={f.grupo === 'experimental' ? 'green' : 'slate'}>{f.grupo}</Badge> },
                { header: 'Institución', cell: (f) => <span className="text-muted">{f.institucion}</span> },
                { header: 'Pretest', cell: (f) => <span className="text-muted">{f.pretest_total ?? '—'}</span> },
                { header: 'Postest', cell: (f) => <span className="text-muted">{f.postest_total ?? '—'}</span> },
                {
                  header: 'Ganancia',
                  cell: (f) => (
                    <span className={`font-semibold ${f.ganancia != null && f.ganancia > 0 ? 'text-prexi-green' : f.ganancia != null && f.ganancia < 0 ? 'text-prexi-red' : 'text-muted'}`}>
                      {f.ganancia != null ? `${f.ganancia > 0 ? '+' : ''}${f.ganancia}` : '—'}
                    </span>
                  ),
                },
                { header: 'Ejerc.', cell: (f) => <span className="text-muted">{f.ejercicios_resueltos}</span> },
                { header: 'XP', cell: (f) => <span className="text-muted">{f.xp_total}</span> },
                { header: 'IA', cell: (f) => <span className="text-muted">{f.consultas_ia}</span> },
                { header: 'Pistas', cell: (f) => <span className="text-muted">{f.pistas_usadas}</span> },
                { header: 'Retos', cell: (f) => <span className="text-muted">{f.retos_entregados}</span> },
              ]}
              card={(f) => (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-semibold text-fg">{f.id_anonimo}</span>
                    <Badge tone={f.grupo === 'experimental' ? 'green' : 'slate'}>{f.grupo}</Badge>
                  </div>
                  <p className="text-xs text-muted">{f.institucion}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-subtle px-2 py-1.5"><p className="text-[10px] uppercase tracking-wide text-muted">Pretest</p><p className="text-sm font-semibold text-fg">{f.pretest_total ?? '—'}</p></div>
                    <div className="rounded-lg bg-subtle px-2 py-1.5"><p className="text-[10px] uppercase tracking-wide text-muted">Postest</p><p className="text-sm font-semibold text-fg">{f.postest_total ?? '—'}</p></div>
                    <div className="rounded-lg bg-subtle px-2 py-1.5"><p className="text-[10px] uppercase tracking-wide text-muted">Ganancia</p>
                      <p className={`text-sm font-semibold ${f.ganancia != null && f.ganancia > 0 ? 'text-prexi-green' : f.ganancia != null && f.ganancia < 0 ? 'text-prexi-red' : 'text-muted'}`}>{f.ganancia != null ? `${f.ganancia > 0 ? '+' : ''}${f.ganancia}` : '—'}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted">{f.ejercicios_resueltos} ejerc. · {f.xp_total} XP · {f.consultas_ia} IA · {f.pistas_usadas} pistas · {f.retos_entregados} retos</p>
                </div>
              )}
            />
          )}
      </div>
    </div>
  );
}
