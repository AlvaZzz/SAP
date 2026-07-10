'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PageHeader, Badge, Skeleton, EmptyState } from '@/components/ui';
import { Target, CheckCircle, ArrowRight, Code, Star, Clock, AlertTriangle } from '@/components/icons';

type EstadoReto = 'nuevo' | 'pendiente' | 'aprobado' | 'necesita_mejorar';
interface Reto { id: number; titulo: string; categoria: string; nivel: number | null; estrellas: number; enunciado: string; xp: number; fecha_limite: string | null; autor: string; fecha: string; estado: EstadoReto; xp_obtenido: number; feedback: string | null }

function BadgeEstado({ estado }: { estado: EstadoReto }) {
  if (estado === 'aprobado') return <Badge tone="green"><CheckCircle className="h-3 w-3" /> Aprobado</Badge>;
  if (estado === 'pendiente') return <Badge tone="blue"><Clock className="h-3 w-3" /> En revisión</Badge>;
  if (estado === 'necesita_mejorar') return <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> A mejorar</Badge>;
  return <Badge tone="slate">Nuevo</Badge>;
}

export default function RetosPage() {
  const router = useRouter();
  const [retos, setRetos] = useState<Reto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ retos: Reto[] }>('/retos').then((r) => setRetos(r.retos)).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Retos del docente" subtitle="Desafíos extra publicados por tus docentes. Resuélvelos en la Zona de Práctica." />

      {cargando ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48" />)}</div> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {retos.map((r) => (
            <div key={r.id} className="card card-hover flex flex-col">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-prexi-blue/10 text-prexi-blue-deep"><Code className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-prexi-blue-deep">{r.categoria}{r.nivel ? ` · Nivel ${r.nivel}` : ''}</p>
                    <h3 className="font-display font-bold text-fg">{r.titulo}</h3>
                  </div>
                </div>
                <BadgeEstado estado={r.estado} />
              </div>
              <p className="mb-3 flex-1 text-sm text-muted line-clamp-3">{r.enunciado}</p>
              {r.fecha_limite && r.estado !== 'aprobado' && (
                <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300"><Clock className="h-3 w-3" /> Fecha límite: {new Date(r.fecha_limite).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}</p>
              )}
              {r.feedback && (r.estado === 'necesita_mejorar' || r.estado === 'aprobado') && (
                <p className="mb-3 rounded-lg bg-subtle px-3 py-2 text-xs text-muted line-clamp-2"><b className="text-fg">Feedback:</b> {r.feedback}</p>
              )}
              <div className="flex items-center justify-between border-t border-line pt-4">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="flex text-prexi-amber">{Array.from({ length: r.estrellas }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</span>
                  <span>· {r.estado === 'aprobado' ? `+${r.xp_obtenido} XP ganados` : `+${r.xp} XP`} · {r.autor}</span>
                </div>
                <button onClick={() => router.push(`/practica?reto=${r.id}`)} className="btn-primary !py-1.5 !px-3.5 text-sm">
                  {r.estado === 'aprobado' ? 'Ver' : r.estado === 'necesita_mejorar' ? 'Corregir' : r.estado === 'pendiente' ? 'Ver entrega' : 'Resolver'} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {retos.length === 0 && <div className="col-span-full"><EmptyState icon={<Target className="h-7 w-7" />} title="Aún no hay retos publicados" hint="Cuando un docente publique un reto, aparecerá aquí para que lo resuelvas en la Zona de Práctica." /></div>}
        </div>
      )}
    </div>
  );
}
