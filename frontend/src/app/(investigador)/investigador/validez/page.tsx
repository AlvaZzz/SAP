'use client';

/**
 * VALIDEZ INTERNA — lo que un tribunal busca para objetar.
 *
 * Flujo de participantes estilo CONSORT, mortalidad experimental, datos
 * faltantes y dosis de intervención. Reconocer estas limitaciones uno mismo
 * vale más que dejar que las descubra el tribunal.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import { AvisoMuestra, Comparacion, ContrasteCard, Explicacion, num } from '@/components/investigador/estadistica';
import { CheckCircle, Users } from '@/components/icons';

interface Etapa { etapa: string; n: number; perdida: number | null; pct_del_inicial: number; nota: string }
interface Desc { n: number; media: number; sd: number; min: number; max: number }
interface Dosis {
  grupo: string; n: number; sin_actividad: number;
  intentos: Desc; ejercicios_resueltos: Desc;
  minutos_totales_media: number | null;
  retos_entregados_media: number | null; consultas_ia_media: number | null;
}
interface Datos {
  flujo: { total: Etapa[]; por_grupo: { grupo: string; etapas: Etapa[] }[] };
  attrition: {
    por_grupo: { grupo: string; con_pretest: number; completaron: number; abandonaron: number; tasa_abandono: number | null }[];
    diferencial: boolean | null; veredicto: string;
  };
  faltantes: {
    criterio: string; sin_pretest: number; sin_postest: number; sin_ninguno: number;
    sin_theta_inicial: number; sin_theta_final: number; completos: number; total: number;
  };
  dosis: { por_grupo: Dosis[]; contraste: Comparacion; que_significa: string };
}

export default function ValidezPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/investigador/validez')
      .then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  if (!d) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Validez interna"
        subtitle="Flujo de participantes, abandono, datos faltantes y dosis real de intervención."
      />

      {/* Flujo CONSORT */}
      <Card className="mb-6">
        <SectionTitle className="mb-1">Flujo de participantes (CONSORT)</SectionTitle>
        <p className="mb-4 text-sm text-muted">
          De cuántos se partió y sobre cuántos se sostiene realmente la conclusión. Esta figura va
          directa al capítulo de resultados.
        </p>
        <Cascada etapas={d.flujo.total} />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {d.flujo.por_grupo.map((g) => (
            <div key={g.grupo} className="rounded-2xl border border-line p-4">
              <p className="mb-3 font-display font-bold capitalize text-fg">Grupo {g.grupo}</p>
              <Cascada etapas={g.etapas} compacto />
            </div>
          ))}
        </div>
      </Card>

      {/* Mortalidad experimental */}
      <Card className="mb-6">
        <SectionTitle className="mb-1">Mortalidad experimental (abandono)</SectionTitle>
        <p className="mb-4 text-sm text-muted">
          Si un grupo abandona mucho más que el otro, quienes permanecen dejan de ser comparables y el
          resultado queda sesgado.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {d.attrition.por_grupo.map((a) => (
            <div key={a.grupo} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium capitalize text-fg">{a.grupo}</p>
                <Badge tone={a.tasa_abandono !== null && a.tasa_abandono > 0.3 ? 'amber' : 'slate'}>
                  {a.tasa_abandono !== null ? `${Math.round(a.tasa_abandono * 100)} % abandono` : '—'}
                </Badge>
              </div>
              <p className="text-xs text-muted">
                {a.con_pretest} rindieron el pretest · {a.completaron} completaron · {a.abandonaron} se perdieron
              </p>
            </div>
          ))}
        </div>
        {d.attrition.diferencial === true
          ? <AvisoMuestra texto={d.attrition.veredicto} />
          : <Explicacion>{d.attrition.veredicto}</Explicacion>}
      </Card>

      {/* Datos faltantes */}
      <Card className="mb-6">
        <SectionTitle className="mb-1">Datos faltantes</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Celda etiqueta="Casos completos" valor={`${d.faltantes.completos} / ${d.faltantes.total}`} destacado />
          <Celda etiqueta="Sin pretest" valor={String(d.faltantes.sin_pretest)} />
          <Celda etiqueta="Sin postest" valor={String(d.faltantes.sin_postest)} />
          <Celda etiqueta="Sin ninguno" valor={String(d.faltantes.sin_ninguno)} />
          <Celda etiqueta="Sin θ inicial" valor={String(d.faltantes.sin_theta_inicial)} />
          <Celda etiqueta="Sin θ final" valor={String(d.faltantes.sin_theta_final)} />
        </div>
        <Explicacion>{d.faltantes.criterio}</Explicacion>
      </Card>

      {/* Dosis */}
      <Card className="mb-5">
        <SectionTitle className="mb-1">Dosis de intervención</SectionTitle>
        <p className="mb-4 text-sm text-muted">
          Responde a &ldquo;¿y si el grupo experimental simplemente no usó el sistema?&rdquo;.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {d.dosis.por_grupo.map((g) => (
            <div key={g.grupo} className="rounded-2xl border border-line p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display font-bold capitalize text-fg">{g.grupo}</p>
                <Badge tone={g.sin_actividad > 0 ? 'amber' : 'green'}>
                  {g.sin_actividad} sin actividad
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Celda etiqueta="Intentos (media)" valor={num(g.intentos.media, 1)} />
                <Celda etiqueta="Ejercicios (media)" valor={num(g.ejercicios_resueltos.media, 1)} />
                <Celda etiqueta="Minutos (media)" valor={num(g.minutos_totales_media, 0)} />
                <Celda etiqueta="Retos (media)" valor={num(g.retos_entregados_media, 1)} />
              </div>
            </div>
          ))}
        </div>
        <Explicacion>{d.dosis.que_significa}</Explicacion>
      </Card>
      <ContrasteCard c={d.dosis.contraste} titulo="¿Usó realmente más el sistema el grupo experimental?" />
    </div>
  );
}

/** Cascada de etapas con la pérdida en cada paso. */
function Cascada({ etapas, compacto = false }: { etapas: Etapa[]; compacto?: boolean }) {
  const inicial = etapas[0]?.n || 1;
  return (
    <div className="space-y-2">
      {etapas.map((e, i) => (
        <div key={e.etapa}>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className={`${compacto ? 'text-xs' : 'text-sm'} font-medium text-fg`}>{e.etapa}</span>
                <span className="shrink-0 font-display text-sm font-bold text-fg">
                  {e.n}
                  <span className="ml-1 text-[10px] font-normal text-muted">{e.pct_del_inicial} %</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded bg-subtle">
                <div
                  className="h-full rounded bg-prexi-blue transition-all duration-700"
                  style={{ width: `${(e.n / inicial) * 100}%` }}
                />
              </div>
              {!compacto && <p className="mt-1 text-[11px] text-muted">{e.nota}</p>}
            </div>
          </div>
          {e.perdida !== null && e.perdida > 0 && i < etapas.length && (
            <p className="ml-2 mt-1 text-[11px] text-prexi-red">↓ se pierden {e.perdida}</p>
          )}
        </div>
      ))}
      {etapas.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-subtle px-3 py-2">
          {etapas[etapas.length - 1].n > 0
            ? <CheckCircle className="h-4 w-4 shrink-0 text-prexi-green" />
            : <Users className="h-4 w-4 shrink-0 text-muted" />}
          <p className="text-xs text-muted">
            El análisis final se sostiene sobre <b className="text-fg">{etapas[etapas.length - 1].n}</b> participantes.
          </p>
        </div>
      )}
    </div>
  );
}

function Celda({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 text-center ${destacado ? 'bg-prexi-blue/10' : 'bg-subtle'}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted">{etiqueta}</p>
      <p className="text-sm font-semibold text-fg">{valor}</p>
    </div>
  );
}
