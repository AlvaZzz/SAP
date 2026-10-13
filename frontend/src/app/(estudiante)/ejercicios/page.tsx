'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { UnidadEstudiante, colorUnidad } from '@/lib/types';
import { Skeleton } from '@/components/ui';
import { resumenUnidad, estadoExamen } from '@/components/ejercicios/camino';
import { Layers, CheckCircle, Lock, ArrowRight, GraduationCap, Play, Trophy, Star } from '@/components/icons';

/**
 * EJERCICIOS — el CAMINO del curso. Arriba, un solo botón grande que dice por
 * dónde seguir. Debajo, las unidades como paradas de un recorrido: cada una
 * termina en su examen, que es la puerta a la siguiente.
 */
export default function EjerciciosPage() {
  const [unidades, setUnidades] = useState<UnidadEstudiante[] | null>(null);

  useEffect(() => {
    api.get<{ unidades: UnidadEstudiante[] }>('/unidades').then((r) => setUnidades(r.unidades ?? [])).catch(() => setUnidades([]));
  }, []);

  const datos = useMemo(() => {
    const us = unidades ?? [];
    const res = us.map((u) => ({ u, r: resumenUnidad(u), examen: estadoExamen(u) }));
    // Unidad en curso: la primera abierta cuyo examen aún no se aprobó.
    const actual = res.find((x) => x.u.desbloqueada && x.examen !== 'aprobado') ?? null;
    return {
      res, actual,
      hechos: res.reduce((s, x) => s + x.r.hechos, 0),
      total: res.reduce((s, x) => s + x.r.total, 0),
      aprobadas: res.filter((x) => x.examen === 'aprobado').length,
    };
  }, [unidades]);

  if (unidades === null) return <div className="space-y-5"><Skeleton className="h-44" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>;

  if (!unidades.length) return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card py-20 text-center">
      <Layers className="mb-3 h-10 w-10 text-muted" />
      <h2 className="font-display text-lg font-bold text-fg">Aún no hay unidades publicadas</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">Cuando tu docente publique los temas de una unidad, aparecerán aquí para que practiques.</p>
    </div>
  );

  const { actual } = datos;
  const pctGlobal = datos.total ? Math.round((datos.hechos / datos.total) * 100) : 0;

  return (
    <div className="animate-fade-up">
      {/* ── Por dónde seguir ── */}
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-prexi-navy via-[#12356B] to-prexi-blue p-6 text-white shadow-lift sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 right-24 h-64 w-64 rounded-full bg-amber-300/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="min-w-[240px] flex-1">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-200"><span className="h-1.5 w-6 rounded-full bg-amber-300" /> Tu camino en Programación I</p>
            {actual ? (
              <>
                <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                  {actual.examen === 'listo' ? '¡Ya puedes rendir el examen!' : actual.r.siguiente ? 'Sigue donde lo dejaste' : 'Continúa tu unidad'}
                </h1>
                <p className="mt-1.5 text-base text-blue-100/90">
                  Unidad {actual.u.numero}: {actual.u.titulo}
                  {actual.examen !== 'listo' && actual.r.siguiente && <> · <b className="text-white">{actual.r.siguiente.numero} {actual.r.siguiente.titulo}</b></>}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {actual.examen === 'listo' ? (
                    <Link href={`/examen-unidad/${actual.u.id}`} className="btn-accion !py-3.5 text-base">
                      <GraduationCap className="h-5 w-5" /> Rendir el examen de la unidad <ArrowRight className="h-5 w-5" />
                    </Link>
                  ) : (
                    <Link href={`/ejercicios/unidad/${actual.u.id}`} className="btn-accion !py-3.5 text-base">
                      <Play className="h-5 w-5" /> Continuar <ArrowRight className="h-5 w-5" />
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <>
                <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">¡Completaste todas las unidades!</h1>
                <p className="mt-1.5 text-base text-blue-100/90">Puedes volver a cualquier unidad para repasar.</p>
              </>
            )}
          </div>

          {/* Avance general */}
          <div className="flex items-center gap-5">
            <Anillo pct={pctGlobal} />
            <div className="space-y-2 text-sm">
              <p><b className="font-display text-xl">{datos.hechos}</b> <span className="text-blue-100/80">de {datos.total} ejercicios</span></p>
              <p><b className="font-display text-xl">{datos.aprobadas}</b> <span className="text-blue-100/80">de {unidades.length} unidades aprobadas</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ── El recorrido ── */}
      <h2 className="mb-4 font-display text-xl font-extrabold text-fg">Las unidades del curso</h2>
      <ol className="relative space-y-4">
        {datos.res.map(({ u, r, examen }, i) => {
          const color = colorUnidad(u.numero);
          const abierta = u.desbloqueada;
          const esActual = actual?.u.id === u.id;
          const ultima = i === datos.res.length - 1;
          return (
            <li key={u.id} className="relative pl-14 sm:pl-16">
              {/* Línea del recorrido y parada */}
              {!ultima && <span aria-hidden className="absolute left-[19px] top-12 h-[calc(100%+0.25rem)] w-1 rounded-full sm:left-[23px]" style={{ backgroundColor: examen === 'aprobado' ? '#10B981' : 'rgb(var(--line))' }} />}
              <span className="absolute left-0 top-3 grid h-10 w-10 place-items-center rounded-full font-display text-lg font-extrabold text-white shadow-soft ring-4 ring-app sm:h-12 sm:w-12"
                style={{ backgroundColor: examen === 'aprobado' ? '#10B981' : abierta ? color : 'rgb(var(--muted))' }}>
                {examen === 'aprobado' ? <CheckCircle className="h-6 w-6" /> : abierta ? u.numero : <Lock className="h-5 w-5" />}
              </span>

              <div className={`overflow-hidden rounded-2xl border bg-card transition ${esActual ? 'border-2 shadow-lift' : 'border-line shadow-soft'} ${abierta ? '' : 'opacity-65'}`}
                style={esActual ? { borderColor: color } : undefined}>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[200px] flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: abierta ? color : undefined }}>
                        Unidad {u.numero}
                        {esActual && <span className="chip-accion">Estás aquí</span>}
                        {examen === 'aprobado' && <span className="rounded-full bg-prexi-green/15 px-2 py-0.5 text-2xs text-prexi-green">Aprobada</span>}
                      </p>
                      <h3 className="font-display text-xl font-bold text-fg">{u.titulo}</h3>
                      {abierta
                        ? u.descripcion && <p className="mt-0.5 line-clamp-2 max-w-2xl text-sm text-muted">{u.descripcion}</p>
                        : <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Lock className="h-4 w-4" /> Se abre al aprobar el examen de la Unidad {u.numero - 1}.</p>}
                    </div>
                    {abierta && (
                      <Link href={`/ejercicios/unidad/${u.id}`}
                        className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 ${esActual ? 'text-white shadow-md' : ''}`}
                        style={esActual ? { backgroundColor: color } : { color, backgroundColor: `${color}1F` }}>
                        {examen === 'aprobado' ? 'Repasar' : esActual ? 'Entrar a practicar' : 'Entrar'} <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>

                  {abierta && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                      <div className="min-w-[180px] flex-1">
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-subtle">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-fg">{r.completos} <span className="font-normal text-muted">de {r.temas} temas</span></span>
                      <span className="text-sm font-semibold text-fg">{r.hechos} <span className="font-normal text-muted">de {r.total} ejercicios</span></span>
                    </div>
                  )}
                </div>

                {/* El examen: la puerta a la siguiente unidad */}
                {abierta && examen !== 'sin_examen' && <PuertaExamen unidad={u} estado={examen} completos={r.enNivel} temas={r.temas} />}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Franja del examen dentro de la tarjeta de la unidad: se ve siempre, y brilla cuando ya se puede rendir. */
function PuertaExamen({ unidad, estado, completos, temas }: { unidad: UnidadEstudiante; estado: 'aprobado' | 'listo' | 'falta'; completos: number; temas: number }) {
  if (estado === 'aprobado') {
    return (
      <div className="flex items-center gap-2.5 border-t border-prexi-green/30 bg-prexi-green/10 px-4 py-3 text-sm font-semibold text-prexi-green sm:px-5">
        <Trophy className="h-5 w-5 shrink-0" /> Examen aprobado. La siguiente unidad está abierta.
      </div>
    );
  }
  if (estado === 'listo') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-300/50 bg-amber-300/10 px-4 py-3.5 sm:px-5">
        <p className="flex items-center gap-2.5 text-sm font-semibold text-fg"><Star className="h-5 w-5 shrink-0 text-amber-500" /> Completaste todos los temas. ¡El examen te espera!</p>
        <Link href={`/examen-unidad/${unidad.id}`} className="btn-accion !rounded-xl !px-5 !py-2.5 text-sm">
          <GraduationCap className="h-5 w-5" /> Rendir el examen <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle/50 px-4 py-3 sm:px-5">
      <p className="flex items-center gap-2.5 text-sm text-muted">
        <GraduationCap className="h-5 w-5 shrink-0 text-prexi-blue-deep" />
        <span><b className="text-fg">Examen de la unidad:</b> completa los {temas} temas en nivel Intermedio o más. Llevas <b className="text-fg">{completos} de {temas}</b>.</span>
      </p>
      <Link href={`/examen-unidad/${unidad.id}`} className="text-sm font-semibold text-prexi-blue-deep hover:underline">Ver el examen</Link>
    </div>
  );
}

/** Anillo de avance general. */
function Anillo({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[88px] w-[88px] shrink-0" role="img" aria-label={`${pct} % del curso completado`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#F7C255" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100} className="transition-all duration-700" />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-lg font-extrabold">{pct}%</span>
    </div>
  );
}
