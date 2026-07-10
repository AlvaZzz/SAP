'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { UnidadEstudiante, TemaEstudiante } from '@/lib/types';
import { Skeleton, Badge } from '@/components/ui';
import { Layers, CheckCircle, Lock, ArrowRight, Lightbulb } from '@/components/icons';

/** Recorre un tema y sus subtemas acumulando totales (ejercicios y temas). */
function acumular(t: TemaEstudiante, acc: { total: number; comp: number; temas: number; temasOk: number; desbloqueado: boolean }) {
  acc.temas++;
  acc.total += t.total_ejercicios;
  acc.comp += Math.min(t.ejercicios_completados, t.total_ejercicios || t.ejercicios_completados);
  if (t.estado === 'completado') acc.temasOk++;
  if (t.desbloqueado) acc.desbloqueado = true;
  (t.subtemas ?? []).forEach((s) => acumular(s, acc));
}

function resumenUnidad(u: UnidadEstudiante) {
  const acc = { total: 0, comp: 0, temas: 0, temasOk: 0, desbloqueado: false };
  u.temas.forEach((t) => acumular(t, acc));
  return { ...acc, pct: acc.total ? Math.round((acc.comp / acc.total) * 100) : 0 };
}

/**
 * MÓDULO DE EJERCICIOS — Vista 1: las UNIDADES de la UPEA.
 * El estudiante ve las unidades como filas; al entrar ve sus temas (niveles) y
 * subtemas. La estructura la define el docente; aquí solo se consume (BD real).
 */
export default function EjerciciosPage() {
  const router = useRouter();
  const [unidades, setUnidades] = useState<UnidadEstudiante[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ unidades: UnidadEstudiante[] }>('/unidades')
      .then((r) => setUnidades(r.unidades))
      .catch(() => undefined)
      .finally(() => setCargando(false));
  }, []);

  const global = useMemo(() => {
    let total = 0, comp = 0, unidadesOk = 0;
    for (const u of unidades) {
      const r = resumenUnidad(u);
      total += r.total; comp += r.comp;
      if (r.temas > 0 && r.temasOk === r.temas) unidadesOk++;
    }
    return { total, comp, unidadesOk, pct: total ? Math.round((comp / total) * 100) : 0 };
  }, [unidades]);

  if (cargando) return <div className="space-y-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>;

  if (!unidades.length) return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card py-20 text-center">
      <Layers className="mb-3 h-10 w-10 text-muted" />
      <h2 className="font-display text-lg font-bold text-fg">Aún no hay unidades publicadas</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">Cuando tu docente publique los temas de una unidad, aparecerán aquí para que practiques.</p>
    </div>
  );

  return (
    <div className="animate-fade-up">
      {/* Progreso general del curso */}
      <div className="card mb-8 border-0 bg-gradient-to-r from-prexi-navy to-prexi-navy-soft text-white">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-[240px] flex-1">
            <h1 className="font-display text-2xl font-extrabold">Programación I — UPEA</h1>
            <p className="mb-4 text-sm font-medium text-blue-100/80">{global.pct}% del curso completado</p>
            <div className="h-3 w-full max-w-lg overflow-hidden rounded-full bg-white/20"><div className="h-full origin-left rounded-full bg-white transition-all duration-700 animate-grow-x" style={{ width: `${global.pct}%` }} /></div>
          </div>
          <div className="flex gap-8 text-center">
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200/70">Ejercicios</p><p className="font-display text-2xl font-extrabold">{global.comp}/{global.total}</p></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200/70">Unidades OK</p><p className="font-display text-2xl font-extrabold">{global.unidadesOk}/{unidades.length}</p></div>
          </div>
        </div>
      </div>

      <h2 className="font-display text-2xl font-extrabold text-fg">Unidades del curso</h2>
      <p className="mb-6 text-[15px] text-muted">Entra a una unidad para avanzar por sus temas (niveles). Tu ruta se <b>adapta a tu nivel</b>.</p>

      <div className="space-y-4">
        {unidades.map((u) => {
          const r = resumenUnidad(u);
          const completa = r.temas > 0 && r.temasOk === r.temas;
          const abierta = u.desbloqueada;
          const iconoBg = completa ? 'bg-emerald-500/10 text-prexi-green' : abierta ? 'bg-prexi-blue/10 text-prexi-blue-deep' : 'bg-subtle text-muted';
          const borde = completa ? 'border-l-prexi-green' : abierta ? 'border-l-prexi-blue' : 'border-l-line';
          return (
            <button key={u.id} onClick={() => abierta && router.push(`/ejercicios/unidad/${u.id}`)}
              disabled={!abierta}
              className={`card block w-full border-l-4 text-left ${borde} ${abierta ? 'card-hover' : 'cursor-not-allowed opacity-80'}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${iconoBg}`}>
                    {abierta ? <span className="font-display text-lg font-extrabold">{u.numero}</span> : <Lock className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {completa && <Badge tone="green"><CheckCircle className="h-3 w-3" /> Completada</Badge>}
                      {!completa && abierta && <Badge tone="blue">En progreso</Badge>}
                      {!abierta && <Badge tone="slate"><Lock className="h-3 w-3" /> Bloqueada</Badge>}
                      {abierta && <Badge tone="slate">Dominio: {u.nivel_dominio_label}</Badge>}
                      <span className="text-xs font-semibold text-muted">{r.temasOk}/{r.temas} temas</span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-fg">Unidad {u.numero}: {u.titulo}</h3>
                    {u.descripcion && <p className="mt-0.5 line-clamp-2 max-w-2xl text-sm text-muted">{u.descripcion}</p>}
                    {!abierta && <p className="mt-1 text-xs font-medium text-muted">Alcanza nivel <b>{u.requiere_nivel_label}</b> de dominio en la unidad anterior para desbloquearla.</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 self-stretch sm:self-center">
                  <div className="hidden w-40 sm:block">
                    <div className="mb-1 flex justify-between text-[11px] text-muted"><span>Dominio {u.dominio_pct}%</span><span>{r.comp}/{r.total}</span></div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${u.dominio_pct}%` }} /></div>
                  </div>
                  {abierta && <span className="inline-flex items-center gap-1.5 rounded-xl bg-prexi-blue/10 px-3 py-2 text-sm font-semibold text-prexi-blue-deep">Ver <ArrowRight className="h-4 w-4" /></span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-xl bg-prexi-blue/10 px-3.5 py-2.5 text-sm text-fg">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" />
        <span>Cada unidad se divide en <b>temas (niveles)</b>. Completa los ejercicios de un tema para desbloquear el siguiente.</span>
      </div>
    </div>
  );
}
