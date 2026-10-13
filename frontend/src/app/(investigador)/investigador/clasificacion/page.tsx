'use client';

/**
 * VALIDACIÓN DE LA CLASIFICACIÓN POR NIVELES.
 *
 * Responde con datos a lo que un tribunal pregunta sobre el corazón de la
 * adaptatividad: ¿los umbrales θ = ±0.5 discriminan, predicen y adaptan?
 * La justificación teórica vive en docs/CLASIFICACION_NIVELES.md; esta pantalla
 * aporta la evidencia empírica que la respalda (o que la refuta).
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, PageHeader, ResponsiveTable, SectionTitle, Skeleton } from '@/components/ui';
import {
  AvisoMuestra, Comparacion, ContrasteCard, Explicacion, num, pTexto,
} from '@/components/investigador/estadistica';
import { AlertTriangle, Layers } from '@/components/icons';

type Nivel = 'basico' | 'intermedio' | 'avanzado';
const ETIQUETA: Record<Nivel, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };
const TONO: Record<Nivel, 'amber' | 'blue' | 'green'> = { basico: 'amber', intermedio: 'blue', avanzado: 'green' };

interface Reparto { nivel: Nivel; n: number; pct: number }
interface Desc { n: number; media: number; sd: number; min: number; max: number; mediana: number }
interface TasaNivel {
  nivel_asignado: Nivel; n: number; con_actividad: number;
  tasa_en_items_basicos: number | null;
  tasa_en_items_intermedios: number | null;
  tasa_en_items_avanzados: number | null;
}
interface Datos {
  hay_datos: boolean; suficiente: boolean; n_clasificados: number; advertencia: string | null;
  umbrales_vigentes: {
    basico: number; avanzado: number;
    anclas_b: { nivel: Nivel; b: number }[];
    justificacion: string;
  };
  distribucion: {
    por_nivel: Reparto[]; theta: Desc | null;
    concentracion_extrema: boolean; veredicto: string;
  };
  validez_predictiva: {
    tasa_por_nivel_asignado: TasaNivel[];
    contraste: Comparacion;
    correlacion_theta_desempeno: { r: number; p: number; n: number; magnitud: string } | null;
    que_significa: string;
  };
  movilidad: {
    subieron_de_nivel: number; mantuvieron: number; sin_temas_iniciados: number; que_significa: string;
  };
  sensibilidad: {
    escenarios: { umbral: number; vigente: boolean; distribucion: Reparto[] }[];
    que_significa: string;
  };
  regla_de_revision: string;
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)} %`);

export default function ClasificacionPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/investigador/clasificacion')
      .then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  if (!d) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Validación de la clasificación"
        subtitle="¿Los umbrales θ = ±0.5 discriminan, predicen el desempeño y permiten movilidad? Evidencia empírica de la adaptatividad."
      />

      {/* Umbrales y su justificación: lo primero, porque es lo que se defiende */}
      <Card className="mb-6">
        <SectionTitle className="mb-3">Umbrales vigentes y por qué</SectionTitle>
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-subtle p-4 font-mono text-sm">
          <Badge tone="amber">Básico</Badge>
          <span className="text-muted">θ &lt; {d.umbrales_vigentes.basico}</span>
          <span className="text-line">│</span>
          <Badge tone="blue">Intermedio</Badge>
          <span className="text-muted">{d.umbrales_vigentes.basico} ≤ θ ≤ {d.umbrales_vigentes.avanzado}</span>
          <span className="text-line">│</span>
          <Badge tone="green">Avanzado</Badge>
          <span className="text-muted">θ &gt; {d.umbrales_vigentes.avanzado}</span>
        </div>

        <p className="mb-2 text-sm text-muted">
          Dificultad <b>b</b> de los ítems por nivel (misma escala logit que θ):
        </p>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {d.umbrales_vigentes.anclas_b.map((a) => (
            <div key={a.nivel} className="rounded-lg bg-subtle px-2 py-1.5 text-center">
              <p className="text-2xs uppercase tracking-wide text-muted">{ETIQUETA[a.nivel]}</p>
              <p className="font-mono text-sm font-semibold text-fg">b = {a.b > 0 ? '+' : ''}{a.b}</p>
            </div>
          ))}
        </div>
        <Explicacion>{d.umbrales_vigentes.justificacion}</Explicacion>
      </Card>

      {!d.hay_datos ? (
        <EmptyState
          icon={<Layers className="h-7 w-7" />}
          title="Todavía no hay estudiantes clasificados"
          hint="La validación necesita estudiantes con el diagnóstico rendido. Aparecerá aquí en cuanto los haya."
        />
      ) : (
        <>
          {d.advertencia && <AvisoMuestra texto={d.advertencia} />}

          {/* 1. ¿Discrimina? */}
          <Card className="mb-6 mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>1. ¿Los umbrales discriminan?</SectionTitle>
              <Badge tone="slate">{d.n_clasificados} clasificados</Badge>
            </div>

            <div className="mb-4 space-y-2">
              {d.distribucion.por_nivel.map((r) => (
                <div key={r.nivel} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-fg">{ETIQUETA[r.nivel]}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-subtle">
                    <div
                      className={`h-full rounded transition-all duration-700 ${r.nivel === 'basico' ? 'bg-prexi-amber' : r.nivel === 'intermedio' ? 'bg-prexi-blue' : 'bg-prexi-green'}`}
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-muted">{r.n} · {r.pct} %</span>
                </div>
              ))}
            </div>

            {d.distribucion.theta && (
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[
                  ['θ media', num(d.distribucion.theta.media, 3)],
                  ['DE', num(d.distribucion.theta.sd, 3)],
                  ['Mediana', num(d.distribucion.theta.mediana, 3)],
                  ['Mín', num(d.distribucion.theta.min, 2)],
                  ['Máx', num(d.distribucion.theta.max, 2)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-subtle px-2 py-1.5 text-center">
                    <p className="text-2xs uppercase tracking-wide text-muted">{l}</p>
                    <p className="text-sm font-semibold text-fg">{v}</p>
                  </div>
                ))}
              </div>
            )}

            {d.distribucion.concentracion_extrema
              ? <AvisoMuestra texto={d.distribucion.veredicto} />
              : <Explicacion>{d.distribucion.veredicto}</Explicacion>}
          </Card>

          {/* 2. ¿Predice? — la evidencia más fuerte */}
          <SectionTitle className="mb-3">2. ¿La clasificación predice el desempeño posterior?</SectionTitle>
          <Card className="mb-4">
            <p className="mb-3 text-sm text-muted">
              Tasa de acierto por nivel asignado, sobre ejercicios <b>fuera del pretest</b>. Si la
              clasificación mide habilidad, quienes quedaron en niveles superiores deberían acertar más
              los ítems difíciles.
            </p>
            <ResponsiveTable
              rows={d.validez_predictiva.tasa_por_nivel_asignado}
              rowKey={(t) => t.nivel_asignado}
              cols={[
                { header: 'Nivel asignado', cell: (t) => <Badge tone={TONO[t.nivel_asignado]}>{ETIQUETA[t.nivel_asignado]}</Badge> },
                { header: 'n', cell: (t) => <span className="text-muted">{t.n}</span> },
                { header: 'Con actividad', cell: (t) => <span className="text-muted">{t.con_actividad}</span> },
                { header: 'Acierto en ítems básicos', cell: (t) => <span className="text-fg">{pct(t.tasa_en_items_basicos)}</span> },
                { header: 'En intermedios', cell: (t) => <span className="text-fg">{pct(t.tasa_en_items_intermedios)}</span> },
                { header: 'En avanzados', cell: (t) => <span className="text-fg">{pct(t.tasa_en_items_avanzados)}</span> },
              ]}
              card={(t) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge tone={TONO[t.nivel_asignado]}>{ETIQUETA[t.nivel_asignado]}</Badge>
                    <span className="text-xs text-muted">n = {t.n} · {t.con_actividad} con actividad</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    {[['Básicos', pct(t.tasa_en_items_basicos)], ['Interm.', pct(t.tasa_en_items_intermedios)], ['Avanz.', pct(t.tasa_en_items_avanzados)]].map(([l, v]) => (
                      <div key={l} className="rounded-lg bg-subtle px-1 py-1.5">
                        <p className="text-2xs uppercase text-muted">{l}</p>
                        <p className="text-sm font-semibold text-fg">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            />

            {d.validez_predictiva.correlacion_theta_desempeno && (
              <div className="mt-3 rounded-2xl border border-line p-4">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                  Correlación θ inicial ↔ acierto posterior
                </p>
                <p className="text-sm text-fg">
                  r = {num(d.validez_predictiva.correlacion_theta_desempeno.r, 3)} ·{' '}
                  {pTexto(d.validez_predictiva.correlacion_theta_desempeno.p)} ·{' '}
                  n = {d.validez_predictiva.correlacion_theta_desempeno.n} ·{' '}
                  asociación {d.validez_predictiva.correlacion_theta_desempeno.magnitud}
                </p>
              </div>
            )}

            <Explicacion>{d.validez_predictiva.que_significa}</Explicacion>
          </Card>

          <ContrasteCard
            c={d.validez_predictiva.contraste}
            titulo="Contraste: ¿aciertan más los clasificados en niveles superiores?"
          />

          {/* 3. ¿Adapta? */}
          <SectionTitle className="mb-3 mt-8">3. ¿El sistema adapta o encasilla?</SectionTitle>
          <Card className="mb-6">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Subieron de nivel', d.movilidad.subieron_de_nivel],
                ['Se mantuvieron', d.movilidad.mantuvieron],
                ['Sin temas iniciados', d.movilidad.sin_temas_iniciados],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded-xl bg-subtle px-2 py-3 text-center">
                  <p className="font-display text-2xl font-bold text-fg">{v}</p>
                  <p className="text-2xs uppercase tracking-wide text-muted">{l}</p>
                </div>
              ))}
            </div>
            <Explicacion>{d.movilidad.que_significa}</Explicacion>
          </Card>

          {/* 4. Sensibilidad */}
          <SectionTitle className="mb-3">4. ¿Y si el corte fuera otro?</SectionTitle>
          <Card className="mb-6">
            <div className="space-y-4">
              {d.sensibilidad.escenarios.map((e) => (
                <div key={e.umbral} className={`rounded-2xl border p-4 ${e.vigente ? 'border-prexi-blue/40 bg-prexi-blue/5' : 'border-line'}`}>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="font-mono text-sm font-bold text-fg">θ = ±{e.umbral}</p>
                    {e.vigente && <Badge tone="blue">vigente</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.distribucion.map((r) => (
                      <span key={r.nivel} className="rounded-lg bg-subtle px-2 py-1 text-xs text-fg">
                        {ETIQUETA[r.nivel]} <b className="text-muted">· {r.n} ({r.pct} %)</b>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Explicacion>{d.sensibilidad.que_significa}</Explicacion>
          </Card>
        </>
      )}

      {/* Regla de revisión: visible siempre, haya datos o no */}
      <Card className="border-prexi-amber/30">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-prexi-amber" />
          <div>
            <p className="mb-1 font-display text-sm font-bold text-fg">Regla de revisión de los umbrales</p>
            <p className="text-sm leading-relaxed text-fg">{d.regla_de_revision}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
