'use client';

/**
 * PARTICIPANTES Y USO DEL SISTEMA.
 *
 * El estudio es no experimental transversal: no hay grupos que comparar. Aquí
 * se documenta sobre cuánta gente se sostiene cada indicador y cuánto se usó
 * realmente el sistema durante el período de medición.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import { Explicacion, num } from '@/components/investigador/estadistica';

interface Etapa { etapa: string; n: number; perdida: number | null; pct_del_inicial: number; nota: string }
interface Desc { n: number; media: number; sd: number; min: number; max: number }
interface Datos {
  flujo: Etapa[];
  faltantes: {
    criterio: string; sin_diagnostico: number; sin_evaluacion_final: number;
    sin_actividad: number; sin_theta_inicial: number; total: number;
  };
  uso: {
    n: number; sin_actividad: number;
    intentos: Desc; ejercicios_resueltos: Desc; dias_activos: Desc;
    minutos_estimados_media: number | null; retos_entregados_media: number | null;
    consultas_ia_media: number | null; consultas_ranking_media: number | null;
    que_significa: string;
  };
}

export default function ParticipantesPage() {
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
        title="Participantes y uso"
        subtitle="Flujo de participantes, datos faltantes y uso real del sistema en el período de medición."
      />

      <Card className="mb-6">
        <SectionTitle className="mb-1">Flujo de participantes</SectionTitle>
        <p className="mb-4 text-sm text-muted">
          De cuántos se partió y sobre cuántos se sostiene cada indicador del estudio.
        </p>
        <Cascada etapas={d.flujo} />
      </Card>

      <Card className="mb-6">
        <SectionTitle className="mb-1">Datos faltantes</SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Celda etiqueta="Estudiantes" valor={String(d.faltantes.total)} destacado />
          <Celda etiqueta="Sin diagnóstico" valor={String(d.faltantes.sin_diagnostico)} />
          <Celda etiqueta="Sin actividad" valor={String(d.faltantes.sin_actividad)} />
          <Celda etiqueta="Sin evaluación final" valor={String(d.faltantes.sin_evaluacion_final)} />
        </div>
        <Explicacion>{d.faltantes.criterio}</Explicacion>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle>Uso del sistema</SectionTitle>
          <Badge tone={d.uso.sin_actividad > 0 ? 'amber' : 'green'}>{d.uso.sin_actividad} sin actividad</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Celda etiqueta="Intentos (media)" valor={num(d.uso.intentos.media, 1)} />
          <Celda etiqueta="Ejercicios resueltos (media)" valor={num(d.uso.ejercicios_resueltos.media, 1)} />
          <Celda etiqueta="Días activos (media)" valor={num(d.uso.dias_activos.media, 1)} />
          <Celda etiqueta="Minutos estimados (media)" valor={num(d.uso.minutos_estimados_media, 0)} />
          <Celda etiqueta="Retos entregados (media)" valor={num(d.uso.retos_entregados_media, 1)} />
          <Celda etiqueta="Consultas al tutor (media)" valor={num(d.uso.consultas_ia_media, 1)} />
          <Celda etiqueta="Consultas al ranking (media)" valor={num(d.uso.consultas_ranking_media, 1)} />
        </div>
        <Explicacion>{d.uso.que_significa}</Explicacion>
      </Card>
    </div>
  );
}

/** Cascada de etapas con la pérdida en cada paso. */
function Cascada({ etapas }: { etapas: Etapa[] }) {
  const inicial = etapas[0]?.n || 1;
  return (
    <div className="space-y-2">
      {etapas.map((e) => (
        <div key={e.etapa}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-fg">{e.etapa}</span>
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
          <p className="mt-1 text-[11px] text-muted">{e.nota}</p>
          {e.perdida !== null && e.perdida > 0 && (
            <p className="mt-1 text-[11px] text-prexi-red">↓ {e.perdida} menos que en la etapa anterior</p>
          )}
        </div>
      ))}
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
