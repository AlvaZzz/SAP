'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { UnidadEstudiante, TemaEstudiante, NIVEL_COLOR } from '@/lib/types';
import { Skeleton, Badge } from '@/components/ui';
import { ChevronLeft, CheckCircle, Lock, Play, ArrowRight, RotateCcw, Lightbulb, Layers, TrendingUp } from '@/components/icons';

/**
 * MÓDULO DE EJERCICIOS — Vista 2: DENTRO de una unidad.
 * Los TEMAS se presentan como NIVELES (Nivel 1 = primer tema…) y los SUBTEMAS
 * como extensión del nivel al que pertenecen. Se respeta el desbloqueo y la
 * adaptatividad ya existentes (la ruta la ordena el backend por dificultad).
 */
export default function UnidadPage() {
  const router = useRouter();
  const params = useParams();
  const unidadId = Number(params.id);
  const [unidad, setUnidad] = useState<UnidadEstudiante | null>(null);
  const [resueltos, setResueltos] = useState<Set<number>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [yendo, setYendo] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ unidades: UnidadEstudiante[] }>('/unidades').then((r) => setUnidad(r.unidades.find((u) => u.id === unidadId) ?? null)),
      api.get<{ ids: number[] }>('/ejercicios/resueltos').then((r) => setResueltos(new Set(r.ids))).catch(() => undefined),
    ]).catch(() => undefined).finally(() => setCargando(false));
  }, [unidadId]);

  // Arranca la ruta ADAPTATIVA del tema: el backend ordena por dificultad y deja
  // los pendientes primero. Navegamos al primer ejercicio no resuelto.
  async function iniciar(temaId: number, total: number) {
    if (!total) return;
    setYendo(temaId);
    try {
      const r = await api.get<{ ejercicios: { id: number }[] }>(`/ejercicios/ruta?tema=${temaId}`);
      const pend = r.ejercicios.find((e) => !resueltos.has(e.id)) ?? r.ejercicios[0];
      if (pend) { router.push(`/ejercicios/${pend.id}`); return; }
    } catch { /* sin ruta */ }
    setYendo(null);
  }

  const progreso = useMemo(() => {
    if (!unidad) return { pct: 0, comp: 0, total: 0 };
    let total = 0, comp = 0;
    const walk = (t: TemaEstudiante) => { total += t.total_ejercicios; comp += Math.min(t.ejercicios_completados, t.total_ejercicios || t.ejercicios_completados); (t.subtemas ?? []).forEach(walk); };
    unidad.temas.forEach(walk);
    return { pct: total ? Math.round((comp / total) * 100) : 0, comp, total };
  }, [unidad]);

  if (cargando) return <div className="space-y-5"><Skeleton className="h-20" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>;

  if (!unidad) return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card py-20 text-center">
      <Layers className="mb-3 h-10 w-10 text-muted" />
      <h2 className="font-display text-lg font-bold text-fg">Unidad no disponible</h2>
      <p className="mt-1 text-sm text-muted">Puede que aún no tenga temas publicados.</p>
      <button onClick={() => router.push('/ejercicios')} className="btn-primary mt-4"><ChevronLeft className="h-4 w-4" /> Volver a las unidades</button>
    </div>
  );

  return (
    <div className="animate-fade-up">
      <button onClick={() => router.push('/ejercicios')} className="btn-ghost mb-4"><ChevronLeft className="h-4 w-4" /> Unidades</button>

      {/* Encabezado de la unidad + introducción teórica breve (opcional) */}
      <div className="card mb-6 border-l-4 border-l-prexi-blue">
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-prexi-blue/10 font-display text-lg font-extrabold text-prexi-blue-deep">{unidad.numero}</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Unidad {unidad.numero}</p>
            <h1 className="font-display text-2xl font-extrabold text-fg">{unidad.titulo}</h1>
          </div>
        </div>
        {unidad.descripcion && (
          <div className="flex items-start gap-2 rounded-xl bg-subtle px-3.5 py-3 text-sm leading-relaxed text-fg">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-prexi-amber" />
            <p>{unidad.descripcion}</p>
          </div>
        )}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted"><span>Progreso de la unidad</span><span>{progreso.comp}/{progreso.total} ejercicios</span></div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${progreso.pct}%` }} /></div>
        </div>

        {/* Dominio agregado → avance a la siguiente unidad (mínimo Intermedio) */}
        <div className="mt-4 rounded-xl border border-line bg-subtle/60 p-3.5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg"><TrendingUp className="h-4 w-4 text-prexi-blue-deep" /> Dominio de la unidad: <b style={{ color: NIVEL_COLOR[unidad.nivel_dominio] }}>{unidad.nivel_dominio_label}</b></span>
            {unidad.habilita_siguiente
              ? <Badge tone="green"><CheckCircle className="h-3 w-3" /> Puedes avanzar de unidad</Badge>
              : <span className="text-xs text-muted">Alcanza <b>{unidad.requiere_nivel_label}</b> para avanzar</span>}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full transition-all" style={{ width: `${unidad.dominio_pct}%`, backgroundColor: NIVEL_COLOR[unidad.nivel_dominio] }} /></div>
          <p className="mt-1.5 text-xs text-muted">El dominio combina tu <b>nivel</b> en todos los temas de la unidad (no cuántos ejercicios hiciste). Sube de nivel en los temas para aumentarlo.</p>
        </div>
      </div>

      <h2 className="mb-3 font-display text-lg font-extrabold text-fg">Temas (niveles)</h2>

      <div className="space-y-4">
        {unidad.temas.map((t, i) => (
          <TemaFila key={t.id} tema={t} nivel={i + 1} yendo={yendo} onIniciar={iniciar} onSubir={(id) => router.push(`/ejercicios/subir-nivel/${id}`)} />
        ))}
      </div>
    </div>
  );
}

/** Chip del nivel adaptativo del estudiante en un tema (distinto del RANGO de gamificación). */
function NivelChip({ label, nivel }: { label: string; nivel: TemaEstudiante['nivel_actual'] }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: NIVEL_COLOR[nivel] }} title="Tu nivel de dificultad en este tema">
      Tu nivel: {label}
    </span>
  );
}

/** Una fila de tema (nivel), con sus subtemas como extensión debajo. */
function TemaFila({ tema, nivel, yendo, onIniciar, onSubir }: {
  tema: TemaEstudiante; nivel: number; yendo: number | null;
  onIniciar: (temaId: number, total: number) => void;
  onSubir: (temaId: number) => void;
}) {
  const completo = tema.estado === 'completado';
  const Icono = completo ? CheckCircle : tema.desbloqueado ? Play : Lock;
  const iconoBg = completo ? 'bg-emerald-500/10 text-prexi-green' : tema.desbloqueado ? 'bg-prexi-blue/10 text-prexi-blue-deep' : 'bg-subtle text-muted';
  const borde = completo ? 'border-l-prexi-green' : tema.desbloqueado ? 'border-l-prexi-blue' : 'border-l-line opacity-80';
  const restantes = Math.max(0, tema.umbral - tema.ejercicios_completados);
  const subtemas = tema.subtemas ?? [];

  return (
    <div className={`card border-l-4 ${borde}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${iconoBg}`}><Icono className="h-5 w-5" /></div>
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-prexi-navy/10 px-2 py-0.5 text-[11px] font-bold text-prexi-navy dark:bg-white/10 dark:text-blue-200">Nivel {nivel}</span>
              <span className="text-[11px] font-semibold text-muted">Tema {tema.numero}</span>
              {tema.desbloqueado && <NivelChip label={tema.nivel_actual_label} nivel={tema.nivel_actual} />}
              {completo && <Badge tone="green"><CheckCircle className="h-3 w-3" /> Completado</Badge>}
            </div>
            <h3 className="font-display text-lg font-bold text-fg">{tema.titulo}</h3>
            {tema.descripcion && <p className="mt-0.5 max-w-2xl text-sm text-muted">{tema.descripcion}</p>}
          </div>
        </div>
        <div className="text-right">
          {tema.total_ejercicios === 0 ? (
            <span className="text-xs italic text-muted">Aún no hay ejercicios en este tema</span>
          ) : !tema.desbloqueado ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Lock className="h-3.5 w-3.5" /> Completa el tema anterior</span>
          ) : completo ? (
            <button onClick={() => onIniciar(tema.id, tema.total_ejercicios_nivel)} disabled={yendo === tema.id}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-prexi-blue-deep hover:underline disabled:opacity-50"><RotateCcw className="h-4 w-4" /> Repasar</button>
          ) : (
            <button onClick={() => onIniciar(tema.id, tema.total_ejercicios_nivel)} disabled={yendo === tema.id}
              className="btn-primary !py-2 disabled:opacity-60">{yendo === tema.id ? 'Abriendo…' : <>Continuar <ArrowRight className="h-4 w-4" /></>}</button>
          )}
        </div>
      </div>

      {/* Progreso del tema (ejercicios completados) — dato DISTINTO del nivel/dominio */}
      {tema.desbloqueado && tema.total_ejercicios > 0 && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-[11px] text-muted">
            <span>Progreso: {tema.ejercicios_completados} de {tema.umbral} para completar el tema</span>
            <span>{tema.total_ejercicios_nivel} ejercicios en tu nivel</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${Math.min(100, Math.round((tema.ejercicios_completados / tema.umbral) * 100))}%` }} /></div>
          {!completo && restantes > 0 && <p className="mt-1.5 text-xs text-muted">Te faltan {restantes} ejercicios para completar el tema.</p>}
          {/* Nivel de dificultad del tema: subir al siguiente, o aviso de nivel máximo */}
          {tema.puede_subir && tema.nivel_objetivo_label ? (
            <button onClick={() => onSubir(tema.id)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-prexi-blue-deep/40 bg-prexi-blue/10 px-3 py-1.5 text-xs font-semibold text-prexi-blue-deep transition hover:bg-prexi-blue/20">
              <TrendingUp className="h-3.5 w-3.5" /> ¿Intentar subir a nivel {tema.nivel_objetivo_label}?
            </button>
          ) : tema.nivel_maximo ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-prexi-green">
              <TrendingUp className="h-3.5 w-3.5" /> Estás en el nivel máximo (Avanzado) de este tema.
            </p>
          ) : null}
        </div>
      )}

      {/* Subtemas = extensión del nivel */}
      {subtemas.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Subtemas de este nivel</p>
          {subtemas.map((s) => {
            const sCompleto = s.estado === 'completado';
            const SIcon = sCompleto ? CheckCircle : s.desbloqueado ? Play : Lock;
            return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-subtle/50 px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${sCompleto ? 'bg-emerald-500/10 text-prexi-green' : s.desbloqueado ? 'bg-prexi-blue/10 text-prexi-blue-deep' : 'bg-subtle text-muted'}`}><SIcon className="h-4 w-4" /></div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-fg">{s.numero} {s.titulo}</p>
                      {s.desbloqueado && <NivelChip label={s.nivel_actual_label} nivel={s.nivel_actual} />}
                    </div>
                    <p className="text-[11px] text-muted">{s.ejercicios_completados}/{s.umbral} · {s.total_ejercicios_nivel} en tu nivel</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {s.desbloqueado && s.puede_subir && s.nivel_objetivo_label ? (
                    <button onClick={() => onSubir(s.id)} title={`Subir a nivel ${s.nivel_objetivo_label}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-prexi-blue-deep hover:underline"><TrendingUp className="h-3 w-3" /> Subir</button>
                  ) : s.desbloqueado && s.nivel_maximo ? (
                    <span title="Estás en el nivel máximo (Avanzado)" className="inline-flex items-center gap-1 text-[11px] font-semibold text-prexi-green"><TrendingUp className="h-3 w-3" /> Nivel máx.</span>
                  ) : null}
                  {s.total_ejercicios === 0 ? (
                    <span className="text-[11px] italic text-muted">Sin ejercicios aún</span>
                  ) : !s.desbloqueado ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted"><Lock className="h-3 w-3" /> Bloqueado</span>
                  ) : (
                    <button onClick={() => onIniciar(s.id, s.total_ejercicios_nivel)} disabled={yendo === s.id}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-prexi-blue-deep hover:underline disabled:opacity-50">
                      {sCompleto ? <><RotateCcw className="h-3.5 w-3.5" /> Repasar</> : <>{yendo === s.id ? 'Abriendo…' : <>Practicar <ArrowRight className="h-3.5 w-3.5" /></>}</>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
