'use client';

/**
 * MÓDULO 3 — ESTUDIANTES EN RIESGO.
 *
 * Cada estudiante que se detecta a tiempo y no abandona es un caso que se
 * conserva en la muestra. Se listan TODOS los motivos que concurren, porque
 * cada uno pide una acción distinta.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import { AlertTriangle, CheckCircle, Users } from '@/components/icons';

interface Motivo { clave: string; detalle: string; gravedad: 'alta' | 'media' }
interface EnRiesgo {
  id: number; nombre: string; email: string;
  dias_inactivo: number | null; tasa_acierto: number | null; intentos: number;
  tiene_pretest: boolean; ultima_actividad: string | null;
  motivos: Motivo[];
}
interface Datos {
  total_estudiantes: number; en_riesgo: number;
  umbrales: { dias_inactivo: number; tasa_acierto_min: number; min_intentos: number; dias_estancado: number };
  estudiantes: EnRiesgo[];
  que_significa: string;
  por_que_importa: string;
}

export default function RiesgoPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/docente/estudiantes/riesgo')
      .then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (!d) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="3 · Estudiantes en riesgo"
        subtitle="Quién se está descolgando y por qué, para poder hacer algo antes de perderlo."
      />

      {/* Criterios a la vista: el docente debe saber con qué regla se le avisa. */}
      <Card className="mb-6">
        <SectionTitle className="mb-3">Criterios aplicados</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Inactividad', `> ${d.umbrales.dias_inactivo} días`],
            ['Acierto bajo', `< ${d.umbrales.tasa_acierto_min} %`],
            ['Mínimo de intentos', `${d.umbrales.min_intentos}`],
            ['Estancamiento', `> ${d.umbrales.dias_estancado} días`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-subtle px-2 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted">{l}</p>
              <p className="text-sm font-semibold text-fg">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">{d.que_significa}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{d.por_que_importa}</p>
      </Card>

      {d.estudiantes.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="h-7 w-7" />}
          title="Ningún estudiante cumple criterios de riesgo"
          hint={`Se revisaron ${d.total_estudiantes} estudiantes con los criterios de arriba.`}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted" />
            <p className="text-sm text-muted">
              <b className="text-fg">{d.en_riesgo}</b> de {d.total_estudiantes} estudiantes, ordenados por urgencia.
            </p>
          </div>

          <div className="space-y-3">
            {d.estudiantes.map((e) => {
              const grave = e.motivos.some((m) => m.gravedad === 'alta');
              return (
                <Card key={e.id} className={grave ? 'border-prexi-red/40' : 'border-prexi-amber/40'}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/docente/estudiantes?id=${e.id}`} className="font-display font-bold text-fg hover:text-prexi-blue-deep">
                        {e.nombre}
                      </Link>
                      <p className="text-xs text-muted">{e.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {e.dias_inactivo !== null && (
                        <Badge tone={e.dias_inactivo > d.umbrales.dias_inactivo ? 'amber' : 'slate'}>
                          {e.dias_inactivo} d sin entrar
                        </Badge>
                      )}
                      {e.tasa_acierto !== null && (
                        <Badge tone={e.tasa_acierto < d.umbrales.tasa_acierto_min ? 'amber' : 'slate'}>
                          {e.tasa_acierto} % acierto
                        </Badge>
                      )}
                      {!e.tiene_pretest && <Badge tone="red">sin pretest</Badge>}
                    </div>
                  </div>

                  <ul className="space-y-1.5">
                    {e.motivos.map((m) => (
                      <li key={m.clave} className="flex gap-2">
                        <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${m.gravedad === 'alta' ? 'text-prexi-red' : 'text-prexi-amber'}`} />
                        <span className="text-sm leading-relaxed text-fg">{m.detalle}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
