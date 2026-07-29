'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { UnidadEstudiante, TemaEstudiante, NIVEL_COLOR, NIVEL_LABEL, colorUnidad } from '@/lib/types';
import { Skeleton } from '@/components/ui';
import { Layers, CheckCircle, Lock, ArrowRight, Lightbulb, GraduationCap } from '@/components/icons';

/** Badge sutil (fondo del color al 12% + texto del color) — regla 60-30-10. */
function ColorPill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ color, backgroundColor: `${color}1F` }}>
      {children}
    </span>
  );
}

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
      <h1 className="font-display text-2xl font-extrabold text-fg sm:text-3xl">Unidades del curso</h1>
      <p className="mb-6 text-[15px] text-muted">Programación I — UPEA · Cada unidad tiene su color; el nivel indica tu dificultad actual.</p>

      {/* Tu avance general: barra de acento a la izquierda + resumen numérico */}
      <div className="card mb-6 border-l-4 border-l-prexi-blue">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-[220px] flex-1">
            <h2 className="font-display text-xl font-extrabold text-fg">Tu avance general</h2>
            <p className="mt-1 text-sm text-muted">Sigue completando temas para desbloquear las siguientes unidades.</p>
          </div>
          <div className="flex gap-8">
            <div className="text-right"><p className="font-display text-3xl font-extrabold text-fg">{global.comp}<span className="text-muted">/{global.total}</span></p><p className="stat-label">Ejercicios</p></div>
            <div className="text-right"><p className="font-display text-3xl font-extrabold text-fg">{global.unidadesOk}<span className="text-muted">/{unidades.length}</span></p><p className="stat-label">Unidades</p></div>
          </div>
        </div>
      </div>

      {/* Leyenda de niveles (color unificado en todo el sistema) */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
        <span className="font-semibold text-fg">Nivel del tema:</span>
        {(['basico', 'intermedio', 'avanzado'] as const).map((n) => (
          <span key={n} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NIVEL_COLOR[n] }} /> {NIVEL_LABEL[n]}
          </span>
        ))}
      </div>

      <div className="space-y-4">
        {unidades.map((u) => {
          const r = resumenUnidad(u);
          const completa = r.temas > 0 && r.temasOk === r.temas;
          const abierta = u.desbloqueada;
          const color = colorUnidad(u.numero);      // acento distintivo de la unidad
          const domColor = NIVEL_COLOR[u.nivel_dominio]; // color unificado del nivel
          return (
            <div key={u.id}>
            <div className={`group overflow-hidden rounded-2xl border border-line bg-card shadow-soft transition-[transform,box-shadow,border-color] duration-200 ${abierta ? 'hover:-translate-y-0.5 hover:shadow-lift' : 'opacity-70'}`}>
              {/* Barra superior de acento = color de la unidad (nunca fondo grande) */}
              <div className="h-1.5 w-full" style={{ backgroundColor: color, opacity: abierta ? 1 : 0.5 }} />
              <button onClick={() => abierta && router.push(`/ejercicios/unidad/${u.id}`)}
                disabled={!abierta}
                className={`block w-full p-5 text-left sm:p-6 ${abierta ? '' : 'cursor-not-allowed'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Número de unidad en su color (tinte 15% + texto del color) */}
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-extrabold"
                      style={{ color, backgroundColor: `${color}26` }}>
                      {abierta ? u.numero : <Lock className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {completa
                          ? <ColorPill color="#10B981"><CheckCircle className="h-3 w-3" /> Completada</ColorPill>
                          : abierta
                            ? <ColorPill color={color}>En progreso</ColorPill>
                            : <span className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted"><Lock className="h-3 w-3" /> Bloqueado</span>}
                        {abierta && <ColorPill color={domColor}>Dominio: {u.nivel_dominio_label}</ColorPill>}
                        {abierta
                          ? <span className="text-xs font-semibold text-muted">{r.temasOk}/{r.temas} temas</span>
                          : <span className="text-xs font-semibold text-faint">Requiere completar la Unidad {u.numero - 1}</span>}
                      </div>
                      <h3 className="font-display text-lg font-bold text-fg">Unidad {u.numero}: {u.titulo}</h3>
                      {u.descripcion && <p className={`mt-0.5 line-clamp-2 max-w-2xl text-sm ${abierta ? 'text-muted' : 'text-faint'}`}>{u.descripcion}</p>}
                      {!abierta && <p className="mt-1 text-xs font-medium text-faint">Aprueba el <b>examen de fin de unidad</b> de la unidad anterior (nivel ≥ {u.requiere_nivel_label}) para desbloquearla.</p>}
                    </div>
                  </div>
                  {abierta && (
                    <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition group-hover:gap-2.5"
                      style={{ color, backgroundColor: `${color}1F` }}>Ver <ArrowRight className="h-4 w-4" /></span>
                  )}
                </div>

                {/* Barra de progreso de la unidad en SU color */}
                {abierta && (
                  <div className="mt-4">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${r.pct}%`, backgroundColor: color }} />
                    </div>
                    <p className="mt-1.5 text-right text-xs font-medium text-muted">{r.comp}/{r.total} · {r.pct}%</p>
                  </div>
                )}
              </button>
            </div>

            {/* Examen de fin de unidad (gate de avance a la siguiente unidad) */}
            {abierta && (u.examen_aprobado ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-prexi-green">
                <CheckCircle className="h-4 w-4" /> Examen de unidad aprobado — siguiente unidad desbloqueada
              </div>
            ) : u.examen_disponible ? (
              <button onClick={() => router.push(`/examen-unidad/${u.id}`)}
                className="mt-1.5 flex w-full items-center justify-between gap-3 rounded-xl border border-prexi-blue/30 bg-prexi-blue/5 px-4 py-2.5 text-left transition hover:bg-prexi-blue/10">
                <span className="flex items-center gap-2 text-sm font-semibold text-prexi-blue-deep"><GraduationCap className="h-4 w-4" /> {u.repaso_revisado ? 'Rendir examen de fin de unidad' : 'Repasar y rendir el examen de fin de unidad'}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-prexi-blue-deep">para avanzar <ArrowRight className="h-4 w-4" /></span>
              </button>
            ) : null)}
            </div>
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
