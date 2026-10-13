'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, SectionTitle, Skeleton, Badge, EmptyState, ResponsiveTable, PageHeader } from '@/components/ui';
import { Download, Database, CheckCircle, AlertTriangle, ShieldCheck } from '@/components/icons';
import { ActualizarDatos, AvisoMuestra, Explicacion } from '@/components/investigador/estadistica';

interface PorCat { variables: number | null; condicionales: number | null; bucles: number | null; funciones: number | null; estructuras: number | null }
interface Fila {
  id_anonimo: string; paralelo: string; nivel_inicial: string | null;
  pretest_total: number | null; postest_total: number | null;
  pre: PorCat; post: PorCat; tiempo_pretest: number | null; tiempo_postest: number | null;
  ejercicios_resueltos: number; tiempo_promedio_ejercicio: number; xp_total: number; racha: number;
  consultas_ia: number; pistas_usadas: number; retos_entregados: number;
}

const COLUMNAS = [
  'id_anonimo', 'institucion', 'paralelo', 'nivel_inicial', 'theta_inicial', 'theta_final',
  'pretest_total (diagnóstico)', 'postest_total (evaluación final)',
  'pretest/postest por categoría (Variables, Condicionales, Bucles, Funciones, Estructuras)',
  'tiempo_pretest', 'tiempo_postest', 'ejercicios_resueltos', 'tiempo_promedio_ejercicio',
  'xp_total', 'racha', 'consultas_ia', 'pistas_usadas', 'retos_entregados',
  'días activos, sesiones, minutos estimados y regularidad de uso', 'consultas_ranking',
];

const DATASETS = [
  { archivo: 'log_adaptacion.csv', href: '/api/investigador/validacion/log-adaptacion.csv', detalle: 'Una fila por decisión del motor: θ, dificultad, rango objetivo y latencia.' },
  { archivo: 'sus.csv', href: '/api/investigador/validacion/sus.csv', detalle: 'Una fila por estudiante: los 10 ítems crudos y el puntaje SUS.' },
  { archivo: 'iso25010.csv', href: '/api/investigador/validacion/iso25010.csv', detalle: 'Una fila por evaluador: ítems crudos y media por característica.' },
  { archivo: 'uso_gamificacion.csv', href: '/api/investigador/validacion/uso-gamificacion.csv', detalle: 'Una fila por estudiante: personalización, retos, ranking y tiempos.' },
];

interface Metadatos {
  fecha_corte: string; n_participantes: number; n_con_actividad: number;
  hash_sha256: string; bytes_csv: number;
  ultima_actividad_registrada: string | null; como_verificar: string;
}
interface Variable {
  dataset: string; variable: string; descripcion: string; tipo: string; unidad: string; rango: string; calculo: string;
}
interface Etica {
  consentimiento: {
    total_estudiantes: number; con_registro_verificable: number; sin_registro_verificable: number;
    primer_registro: string | null; limitacion: string | null; nota: string;
  };
  anonimizacion: {
    confirmado: boolean; identificador_usado: string; campos_excluidos: string[];
    alcance: string; advertencia: string;
  };
}

export default function ExportacionPage() {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [calculadoEn, setCalculadoEn] = useState<string | null>(null);
  const [meta, setMeta] = useState<Metadatos | null>(null);
  const [codebook, setCodebook] = useState<Variable[] | null>(null);
  const [etica, setEtica] = useState<Etica | null>(null);

  const cargar = useCallback(() => {
    api.get<{ dataset: Fila[]; calculado_en: string | null }>('/investigador/exportacion/dataset')
      .then((r) => { setFilas(r.dataset); setCalculadoEn(r.calculado_en); })
      .catch(() => setFilas([]));
    api.get<Metadatos>('/investigador/metadatos-corte').then(setMeta).catch(() => undefined);
  }, []);

  useEffect(() => {
    cargar();
    api.get<{ variables: Variable[] }>('/investigador/codebook').then((r) => setCodebook(r.variables)).catch(() => undefined);
    api.get<Etica>('/investigador/etica').then(setEtica).catch(() => undefined);
  }, [cargar]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Exportación y reproducibilidad" subtitle="Dataset anonimizado, diccionario de variables y metadatos del corte, para que cualquier resultado reportado se pueda reproducir después."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ActualizarDatos calculadoEn={calculadoEn} onActualizado={cargar} />
            <a href="/api/investigador/exportacion/export.csv" className="btn-primary"><Download className="h-4 w-4" /> Dataset principal (CSV)</a>
          </div>
        } />

      {/* Metadatos del corte + hash: lo que hace reproducible un resultado */}
      {meta && (
        <Card className="mb-6">
          <SectionTitle className="mb-3">Metadatos de este corte</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Fecha del corte', new Date(meta.fecha_corte).toLocaleString('es-BO')],
              ['Participantes', String(meta.n_participantes)],
              ['Con actividad', String(meta.n_con_actividad)],
              ['Última actividad', meta.ultima_actividad_registrada ? new Date(meta.ultima_actividad_registrada).toLocaleDateString('es-BO') : '—'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-subtle px-2 py-1.5 text-center">
                <p className="text-2xs uppercase tracking-wide text-muted">{l}</p>
                <p className="text-sm font-semibold text-fg">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-line p-3">
            <p className="text-2xs uppercase tracking-wide text-muted">Hash SHA-256 del dataset</p>
            <p className="break-all font-mono text-xs text-fg">{meta.hash_sha256}</p>
          </div>
          <Explicacion>{meta.como_verificar}</Explicacion>
        </Card>
      )}

      {/* Un dataset por instrumento: los que alimentan los indicadores de la tesis */}
      <Card className="mb-6">
        <SectionTitle className="mb-1">Datasets por instrumento</SectionTitle>
        <p className="mb-3 text-sm text-muted">
          Un CSV anonimizado por instrumento, listo para analizar en Python (Pandas y SciPy). Sin nombre, CI ni RU.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DATASETS.map((ds) => (
            <a key={ds.href} href={ds.href} className="flex items-start gap-3 rounded-xl border border-line bg-card p-3 transition hover:bg-subtle">
              <Download className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" />
              <span><span className="block font-mono text-sm font-semibold text-fg">{ds.archivo}</span><span className="block text-xs text-muted">{ds.detalle}</span></span>
            </a>
          ))}
        </div>
      </Card>

      {/* Descargas complementarias (desglose fino del progreso) */}
      <div className="mb-6 flex flex-wrap gap-2">
        <a href="/api/investigador/exportacion/diagnostico-temas.csv" className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-semibold text-fg transition hover:bg-subtle"><Download className="h-4 w-4 text-prexi-blue-deep" /> Diagnóstico por tema (CSV)</a>
        <a href="/api/investigador/exportacion/examenes-unidad.csv" className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-semibold text-fg transition hover:bg-subtle"><Download className="h-4 w-4 text-prexi-blue-deep" /> Exámenes de unidad (CSV)</a>
      </div>

      {/* Ética: consentimiento y anonimización, con sus límites declarados */}
      {etica && (
        <Card className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-prexi-green" />
            <SectionTitle>Ética y consentimiento</SectionTitle>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ['Estudiantes', String(etica.consentimiento.total_estudiantes)],
              ['Con registro verificable', String(etica.consentimiento.con_registro_verificable)],
              ['Sin registro verificable', String(etica.consentimiento.sin_registro_verificable)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-subtle px-2 py-1.5 text-center">
                <p className="text-2xs uppercase tracking-wide text-muted">{l}</p>
                <p className="text-sm font-semibold text-fg">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{etica.consentimiento.nota}</p>
          {etica.consentimiento.limitacion && <AvisoMuestra texto={etica.consentimiento.limitacion} />}

          <div className="mt-4 rounded-2xl border border-line p-4">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-prexi-green" />
              <p className="text-sm font-semibold text-fg">Anonimización confirmada</p>
            </div>
            <p className="text-sm text-muted">{etica.anonimizacion.alcance}</p>
            <p className="mt-2 text-xs text-muted">
              Identificador usado: <code className="rounded bg-subtle px-1">{etica.anonimizacion.identificador_usado}</code>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {etica.anonimizacion.campos_excluidos.map((c) => (
                <span key={c} className="rounded-lg bg-subtle px-2 py-0.5 text-xs text-muted">sin {c}</span>
              ))}
            </div>
            <div className="mt-3 flex gap-2 rounded-xl bg-subtle p-3 text-xs leading-relaxed text-muted">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-prexi-amber" />
              <p>{etica.anonimizacion.advertencia}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Diccionario de variables (codebook) */}
      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Diccionario de variables (codebook)</SectionTitle>
          <a href="/api/investigador/codebook.csv" className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-fg transition hover:bg-subtle">
            <Download className="h-3.5 w-3.5" /> Descargar CSV
          </a>
        </div>
        <p className="mb-3 text-sm text-muted">
          Cada columna del dataset con su descripción, tipo, unidad, rango y cómo se calcula.
          Va directo a los anexos de la tesis.
        </p>
        {codebook === null ? <Skeleton className="h-40" /> : (
          <ResponsiveTable
            rows={codebook}
            rowKey={(v) => `${v.dataset}:${v.variable}`}
            cols={[
              { header: 'Dataset', cell: (v) => <span className="font-mono text-xs text-muted">{v.dataset}</span> },
              { header: 'Variable', cell: (v) => <span className="font-mono text-xs font-semibold text-fg">{v.variable}</span> },
              { header: 'Descripción', cell: (v) => <span className="text-muted">{v.descripcion}</span> },
              { header: 'Tipo', cell: (v) => <span className="text-muted">{v.tipo}</span> },
              { header: 'Unidad', cell: (v) => <span className="text-muted">{v.unidad}</span> },
              { header: 'Rango', cell: (v) => <span className="text-muted">{v.rango}</span> },
            ]}
            card={(v) => (
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-fg">{v.variable} <span className="font-normal text-muted">· {v.dataset}</span></p>
                <p className="text-xs text-muted">{v.descripcion}</p>
                <p className="text-2xs text-muted">{v.tipo} · {v.unidad} · {v.rango}</p>
                <p className="text-2xs italic text-muted">{v.calculo}</p>
              </div>
            )}
          />
        )}
      </Card>

      <Card className="mb-6">
        <div className="mb-2 flex items-center gap-2"><Database className="h-4 w-4 text-prexi-blue-deep" /><p className="text-sm font-semibold text-fg">Columnas incluidas en el CSV principal</p></div>
        <ul className="grid gap-1 text-xs text-muted sm:grid-cols-2">
          {COLUMNAS.map((c) => <li key={c} className="flex gap-1.5"><span className="text-prexi-blue-deep">•</span> {c}</li>)}
        </ul>
      </Card>

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
                { header: 'Paralelo', cell: (f) => <span className="text-muted">{f.paralelo}</span> },
                { header: 'Nivel inicial', cell: (f) => <span className="text-muted">{f.nivel_inicial ?? '—'}</span> },
                { header: 'Diagnóstico', cell: (f) => <span className="text-muted">{f.pretest_total ?? '—'}</span> },
                { header: 'Eval. final', cell: (f) => <span className="text-muted">{f.postest_total ?? '—'}</span> },
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
                    <Badge tone="slate">Paralelo {f.paralelo}</Badge>
                  </div>
                  <p className="text-xs text-muted">Nivel inicial: {f.nivel_inicial ?? '—'}</p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-subtle px-2 py-1.5"><p className="text-2xs uppercase tracking-wide text-muted">Diagnóstico</p><p className="text-sm font-semibold text-fg">{f.pretest_total ?? '—'}</p></div>
                    <div className="rounded-lg bg-subtle px-2 py-1.5"><p className="text-2xs uppercase tracking-wide text-muted">Eval. final</p><p className="text-sm font-semibold text-fg">{f.postest_total ?? '—'}</p></div>
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
