'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { UnidadEstudiante, colorUnidad, NIVEL_COLOR, NIVEL_LABEL } from '@/lib/types';
import { Card, Skeleton, EmptyState } from '@/components/ui';
import { Sparkles, Lock, ArrowRight, Layers } from '@/components/icons';

/**
 * Selector de mazos de flashcards por unidad/tema (acceso desde el menú lateral).
 * Repaso libre de apoyo: no puntúa, no cronometra, no afecta al θ (IRT).
 */
export default function FlashcardsSelectorPage() {
  const [unidades, setUnidades] = useState<UnidadEstudiante[] | null>(null);
  const [unidadesExpandidas, setUnidadesExpandidas] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.get<{ unidades: UnidadEstudiante[] }>('/unidades').then((r) => setUnidades(r.unidades ?? [])).catch(() => setUnidades([]));
  }, []);

  return (
    <div className="animate-fade-up">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-prexi-blue-deep" />
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">Flashcards</h1>
      </div>
      <p className="mb-6 text-[15px] text-muted">Tarjetas para repasar antes de un tema o de un examen. Cada mazo viene <b className="text-fg">a tu nivel actual</b> en ese tema y cambia cuando subes. Es repaso libre: no puntúa.</p>

      {unidades === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : unidades.length === 0 ? (
        <EmptyState icon={<Layers className="h-7 w-7" />} title="Aún no hay unidades" hint="Cuando tu docente publique contenido, aquí verás los mazos." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {unidades.map((u) => {
            const color = colorUnidad(u.numero);
            const bloqueada = !u.desbloqueada;
            const expandida = unidadesExpandidas.has(u.id);
            const contenidos = u.temas.flatMap((tema) => [
              { ...tema, tipo: 'Tema' },
              ...(tema.subtemas ?? []).map((subtema) => ({ ...subtema, tipo: 'Subtema' })),
            ]);
            return (
              <Card key={u.id} className="flex flex-col" style={{ borderTop: `3px solid ${color}` }}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color, backgroundColor: `${color}22` }}>Unidad {u.numero}</span>
                  {bloqueada && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted"><Lock className="h-3 w-3" /> Bloqueada</span>}
                </div>
                <h2 className="font-display text-lg font-bold text-fg">{u.titulo}</h2>

                {!bloqueada && (
                  <>
                    <div className="mt-4 rounded-xl border border-line bg-subtle/40 p-3 sm:p-3.5">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-fg">Elige qué repasar</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">Toca un tema o subtema para abrir sus flashcards.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {contenidos.map((t, indice) => (
                        <Link key={t.id} href={`/flashcards/tema/${t.id}?volver=/flashcards`}
                          aria-label={`Repasar ${t.tipo.toLowerCase()} ${t.numero}: ${t.titulo}`}
                          className={`group min-h-12 min-w-0 items-center gap-2.5 rounded-lg border border-line bg-card px-3 py-2.5 text-left transition hover:border-prexi-blue/50 hover:bg-prexi-blue/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-prexi-blue/70 ${indice >= 4 && !expandida ? 'hidden sm:flex' : 'flex'}`}>
                          <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ color, backgroundColor: `${color}1F` }}>
                            <span className="sm:hidden">{t.numero}</span><span className="hidden sm:inline">{t.tipo} {t.numero}</span>
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-fg group-hover:text-prexi-blue-deep line-clamp-2 sm:truncate">{t.titulo}</span>
                          <span className="hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold lg:inline" style={{ color: NIVEL_COLOR[t.nivel_actual], backgroundColor: `${NIVEL_COLOR[t.nivel_actual]}22` }}>{NIVEL_LABEL[t.nivel_actual]}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-prexi-blue-deep" />
                        </Link>
                      ))}
                      </div>
                      {contenidos.length > 4 && (
                        <button type="button" onClick={() => setUnidadesExpandidas((actual) => {
                          const siguiente = new Set(actual);
                          if (siguiente.has(u.id)) siguiente.delete(u.id); else siguiente.add(u.id);
                          return siguiente;
                        })} className="mt-3 text-sm font-semibold text-prexi-blue-deep underline-offset-4 hover:underline sm:hidden">
                          {expandida ? 'Mostrar menos' : `Ver ${contenidos.length - 4} tema${contenidos.length - 4 === 1 ? '' : 's'} más`}
                        </button>
                      )}
                    </div>
                    <Link href={`/flashcards/unidad/${u.id}?volver=/flashcards`} className="btn-primary mt-4 w-full justify-center !py-2.5 sm:w-auto">
                      Repasar la unidad <ArrowRight className="h-4 w-4" />
                    </Link>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
