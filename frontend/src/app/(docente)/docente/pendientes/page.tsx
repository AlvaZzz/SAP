'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { EntregaReto, PreguntaIa, EstudianteFila } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton, EmptyState } from '@/components/ui';
import { ClipboardList, Bot, AlertTriangle, ArrowRight, CheckCircle } from '@/components/icons';

export default function DocentePendientesPage() {
  const [entregas, setEntregas] = useState<EntregaReto[]>([]);
  const [preguntas, setPreguntas] = useState<PreguntaIa[]>([]);
  const [riesgo, setRiesgo] = useState<EstudianteFila[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ entregas: EntregaReto[] }>('/docente/revisiones').then((r) => setEntregas(r.entregas)).catch(() => undefined),
      api.get<{ preguntas: PreguntaIa[] }>('/docente/preguntas-ia?estado=borrador').then((r) => setPreguntas(r.preguntas)).catch(() => undefined),
      api.get<{ estudiantes: EstudianteFila[] }>('/docente/estudiantes').then((r) => setRiesgo(r.estudiantes.filter((e) => e.estado === 'en_riesgo'))).catch(() => undefined),
    ]).finally(() => setCargando(false));
  }, []);

  const total = entregas.length + preguntas.length + riesgo.length;

  if (cargando) return <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Pendientes" subtitle={total === 0 ? 'Estás al día: no hay nada pendiente.' : `${total} elemento${total > 1 ? 's' : ''} requieren tu atención.`} />

      {total === 0 ? (
        <EmptyState icon={<CheckCircle className="h-7 w-7" />} title="Todo al día" hint="No tienes entregas, preguntas ni alertas pendientes por revisar." />
      ) : (
        <div className="space-y-6">
          {entregas.length > 0 && (
            <Seccion icono={<ClipboardList className="h-5 w-5" />} titulo="Entregas de retos por revisar" total={entregas.length} enlace="/docente/revisiones">
              {entregas.slice(0, 5).map((e) => (
                <Fila key={`${e.retoId}-${e.estudianteId}`} titulo={e.retoTitulo} detalle={`${e.estudiante} · ${e.categoria}`} enlace="/docente/revisiones" />
              ))}
            </Seccion>
          )}

          {preguntas.length > 0 && (
            <Seccion icono={<Bot className="h-5 w-5" />} titulo="Preguntas del tutor PREXI pendientes de aprobar" total={preguntas.length} enlace="/docente/preguntas-ia">
              {preguntas.slice(0, 5).map((p) => (
                <Fila key={p.id} titulo={p.enunciado} detalle={`${p.tema} · ${p.categoria}`} enlace="/docente/preguntas-ia" />
              ))}
            </Seccion>
          )}

          {riesgo.length > 0 && (
            <Seccion icono={<AlertTriangle className="h-5 w-5" />} titulo="Estudiantes en riesgo" total={riesgo.length} enlace="/docente/estudiantes">
              {riesgo.slice(0, 5).map((e) => (
                <Fila key={e.id} titulo={e.nombre} detalle={`Nivel ${e.nivel_actual} · ${e.ejercicios_completados} ejercicios completados`} enlace={`/docente/estudiantes?id=${e.id}`} tono="red" />
              ))}
            </Seccion>
          )}
        </div>
      )}
    </div>
  );
}

function Seccion({ icono, titulo, total, enlace, children }: { icono: React.ReactNode; titulo: string; total: number; enlace: string; children: React.ReactNode }) {
  return (
    <Card hover>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-fg"><span className="text-prexi-blue-deep">{icono}</span><h2 className="font-display text-lg font-bold">{titulo}</h2><Badge tone="amber">{total}</Badge></div>
        <Link href={enlace} className="flex items-center gap-1 text-xs font-semibold text-prexi-blue-deep hover:underline">Ver todo <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}

function Fila({ titulo, detalle, enlace, tono = 'blue' }: { titulo: string; detalle: string; enlace: string; tono?: 'blue' | 'red' }) {
  return (
    <Link href={enlace} className="flex items-center justify-between gap-3 py-2.5 transition hover:bg-subtle -mx-2 px-2 rounded-lg">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{titulo}</p>
        <p className="truncate text-xs text-muted">{detalle}</p>
      </div>
      <span className={`h-2 w-2 shrink-0 rounded-full ${tono === 'red' ? 'bg-prexi-red' : 'bg-prexi-blue'}`} />
    </Link>
  );
}
