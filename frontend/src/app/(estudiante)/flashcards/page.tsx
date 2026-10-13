'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { claveMazo } from '@/lib/flashcards';
import { UnidadEstudiante, TemaEstudiante, colorUnidad, NIVEL_COLOR, NIVEL_LABEL } from '@/lib/types';
import { Skeleton, EmptyState } from '@/components/ui';
import { COLOR_FLASHCARD, IconoFlashcard } from '@/components/flashcards/boton-flashcards';
import { Lock, ArrowRight, Layers, ChevronDown, ChevronUp, CheckCircle, Play, RotateCcw } from '@/components/icons';

/**
 * FLASHCARDS — elegir qué repasar. Arriba, el mazo que quedó a medias para
 * seguir con un toque. Debajo, cada unidad se despliega en sus temas, y cada
 * tema muestra cuánto del mazo ya dominas. Es repaso libre: no puntúa.
 */

/** Lo que el mazo guarda en el navegador al avanzar. */
interface Guardado { idx: number; dominadas: number; total: number; t: number }

function leer(scope: string): Guardado | null {
  try {
    const raw = localStorage.getItem(claveMazo(scope));
    if (!raw) return null;
    const s = JSON.parse(raw) as { idx?: number; dominadas?: string[]; total?: number; t?: number };
    if (typeof s.idx !== 'number' || !s.total) return null;
    return { idx: s.idx, dominadas: Array.isArray(s.dominadas) ? s.dominadas.length : 0, total: s.total, t: s.t ?? 0 };
  } catch { return null; }
}

type Fila = TemaEstudiante & { esSubtema: boolean };

export default function FlashcardsPage() {
  const [unidades, setUnidades] = useState<UnidadEstudiante[] | null>(null);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [guardados, setGuardados] = useState<Map<number, Guardado>>(new Map());

  useEffect(() => {
    api.get<{ unidades: UnidadEstudiante[] }>('/unidades').then((r) => {
      const us = r.unidades ?? [];
      setUnidades(us);
      // Progreso de cada mazo, guardado en este navegador.
      const m = new Map<number, Guardado>();
      for (const u of us) for (const t of u.temas) for (const x of [t, ...(t.subtemas ?? [])]) { const g = leer(`tema-${x.id}`); if (g) m.set(x.id, g); }
      setGuardados(m);
      // Se abre la última unidad desbloqueada: es donde está estudiando.
      setAbierta([...us].reverse().find((u) => u.desbloqueada)?.id ?? us[0]?.id ?? null);
    }).catch(() => setUnidades([]));
  }, []);

  const filasDe = (u: UnidadEstudiante): Fila[] => u.temas.flatMap((t) => [{ ...t, esSubtema: false }, ...(t.subtemas ?? []).map((s) => ({ ...s, esSubtema: true }))]);

  // Mazo a medias más reciente: el atajo de "seguir donde lo dejé".
  const pendiente = useMemo(() => {
    let mejor: { tema: Fila; unidad: UnidadEstudiante; g: Guardado } | null = null;
    for (const u of unidades ?? []) for (const t of filasDe(u)) {
      const g = guardados.get(t.id);
      if (g && g.idx > 0 && g.idx < g.total && (!mejor || g.t > mejor.g.t)) mejor = { tema: t, unidad: u, g };
    }
    return mejor;
  }, [unidades, guardados]);

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-lift" style={{ backgroundColor: COLOR_FLASHCARD }}><IconoFlashcard className="h-8 w-8" /></span>
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Flashcards</h1>
          <p className="mt-0.5 max-w-2xl text-base text-muted">Tarjetas de pregunta y respuesta para repasar antes de un tema o de un examen. Vienen <b className="text-fg">a tu nivel</b> en cada tema y no afectan tu nota.</p>
        </div>
      </div>

      {unidades === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : unidades.length === 0 ? (
        <EmptyState icon={<Layers className="h-7 w-7" />} title="Aún no hay unidades" hint="Cuando tu docente publique contenido, aquí verás los mazos." />
      ) : (
        <>
          {pendiente && (
            <Link href={`/flashcards/tema/${pendiente.tema.id}?volver=/flashcards`}
              className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
              style={{ borderColor: `${COLOR_FLASHCARD}80`, backgroundColor: `${COLOR_FLASHCARD}12` }}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: COLOR_FLASHCARD }}><Play className="h-5 w-5" /></span>
              <span className="min-w-[200px] flex-1">
                <span className="block text-xs font-bold uppercase tracking-wide" style={{ color: COLOR_FLASHCARD }}>Sigue donde lo dejaste</span>
                <span className="block font-display text-lg font-bold text-fg">{pendiente.tema.numero} {pendiente.tema.titulo}</span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full" style={{ width: `${(pendiente.g.idx / pendiente.g.total) * 100}%`, backgroundColor: COLOR_FLASHCARD }} /></span>
                  <span className="shrink-0 text-xs font-semibold text-muted">{pendiente.g.idx} de {pendiente.g.total} tarjetas</span>
                </span>
              </span>
              <span className="btn-primary pointer-events-none">Continuar <ArrowRight className="h-4 w-4" /></span>
            </Link>
          )}

          <div className="space-y-3">
            {unidades.map((u) => {
              const color = colorUnidad(u.numero);
              const filas = filasDe(u);
              const abiertaAhora = abierta === u.id && u.desbloqueada;
              const dominados = filas.filter((t) => { const g = guardados.get(t.id); return g && g.dominadas >= g.total; }).length;
              return (
                <section key={u.id} className="card !p-0" style={{ borderLeft: `4px solid ${u.desbloqueada ? color : 'rgb(var(--line))'}` }}>
                  <button type="button" disabled={!u.desbloqueada} onClick={() => setAbierta(abiertaAhora ? null : u.id)} aria-expanded={abiertaAhora}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left disabled:cursor-not-allowed disabled:opacity-60">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-lg font-extrabold" style={{ color, backgroundColor: `${color}22` }}>{u.numero}</span>
                    <span className="min-w-[180px] flex-1">
                      <span className="block font-display text-lg font-bold text-fg">{u.titulo}</span>
                      <span className="block text-xs text-muted">
                        {u.desbloqueada ? `${filas.length} mazos${dominados > 0 ? ` · ${dominados} dominados` : ''}` : 'Se abre al aprobar el examen de la unidad anterior'}
                      </span>
                    </span>
                    {u.desbloqueada ? (abiertaAhora ? <ChevronUp className="h-5 w-5 text-muted" /> : <ChevronDown className="h-5 w-5 text-muted" />) : <Lock className="h-5 w-5 text-muted" />}
                  </button>

                  {abiertaAhora && (
                    <div className="border-t border-line">
                      <ul className="divide-y divide-line">
                        {filas.map((t) => {
                          const g = guardados.get(t.id);
                          const completo = !!g && g.idx >= g.total;
                          const aMedias = !!g && g.idx > 0 && !completo;
                          const todoDominado = !!g && g.dominadas >= g.total;
                          return (
                            <li key={t.id}>
                              {t.desbloqueado ? (
                                <Link href={`/flashcards/tema/${t.id}?volver=/flashcards`} className={`group flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-subtle ${t.esSubtema ? 'pl-10' : ''}`}>
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={todoDominado ? { color: '#22C55E', backgroundColor: '#22C55E22' } : { color: COLOR_FLASHCARD, backgroundColor: `${COLOR_FLASHCARD}1F` }}>
                                    {todoDominado ? <CheckCircle className="h-5 w-5" /> : <IconoFlashcard className="h-5 w-5" />}
                                  </span>
                                  <span className="min-w-[180px] flex-1">
                                    <span className="block font-semibold text-fg group-hover:text-prexi-blue-deep">{t.numero} {t.titulo}</span>
                                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                                      <span className="font-bold" style={{ color: NIVEL_COLOR[t.nivel_actual] }}>Nivel {NIVEL_LABEL[t.nivel_actual]}</span>
                                      {g
                                        ? <span className="text-muted">{todoDominado ? 'Dominas todo el mazo' : `Dominas ${g.dominadas} de ${g.total} tarjetas`}</span>
                                        : <span className="text-muted">Aún no lo repasaste</span>}
                                    </span>
                                    {g && !todoDominado && (
                                      <span className="mt-1.5 block h-1.5 max-w-xs overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full bg-[#22C55E]" style={{ width: `${(g.dominadas / g.total) * 100}%` }} /></span>
                                    )}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-prexi-blue-deep">
                                    {aMedias ? 'Continuar' : completo ? <><RotateCcw className="h-3.5 w-3.5" /> Repetir</> : 'Repasar'} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                                  </span>
                                </Link>
                              ) : (
                                <div className={`flex items-center gap-3 px-4 py-3 opacity-60 ${t.esSubtema ? 'pl-10' : ''}`}>
                                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-subtle text-muted"><Lock className="h-4 w-4" /></span>
                                  <span className="flex-1"><span className="block font-semibold text-fg">{t.numero} {t.titulo}</span><span className="text-xs text-muted">Completa el tema anterior para abrirlo</span></span>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle/50 px-4 py-3">
                        <span className="text-sm text-muted">¿Viene el examen? Repasa todos los temas de la unidad de una vez.</span>
                        <Link href={`/flashcards/unidad/${u.id}?volver=/flashcards`} className="btn-primary !py-2 text-sm"><IconoFlashcard className="h-4 w-4" /> Repasar toda la unidad</Link>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
