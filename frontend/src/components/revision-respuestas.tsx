'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { CodeBlock } from '@/components/code-block';
import { Skeleton, EmptyState } from '@/components/ui';
import { CheckCircle, X, ArrowLeft, ClipboardList, Bot } from '@/components/icons';

interface ItemRevision {
  numero: number;
  categoria: string;
  enunciado: string;
  codigoPython: string | null;
  opciones: { id: string; texto: string }[];
  opcion_dada: string | null;
  respuesta_correcta: string;
  explicacion: string | null;
  correcto: boolean;
}

type Filtro = 'todas' | 'correctas' | 'incorrectas';

/**
 * Revisión enumerada de un test (pretest/postest). Muestra por pregunta: el
 * enunciado, el código, la opción elegida, la respuesta correcta y la explicación
 * (explicacion_ia). Filtro correctas/incorrectas. Los datos vienen del backend.
 */
export function RevisionRespuestas({ endpoint, titulo, volverHref }: { endpoint: string; titulo: string; volverHref: string }) {
  const router = useRouter();
  const [items, setItems] = useState<ItemRevision[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  useEffect(() => {
    api.get<{ revision: ItemRevision[] }>(endpoint)
      .then((r) => setItems(r.revision))
      .catch(() => setItems([]));
  }, [endpoint]);

  const aciertos = useMemo(() => items?.filter((i) => i.correcto).length ?? 0, [items]);
  const visibles = useMemo(() => {
    if (!items) return [];
    if (filtro === 'correctas') return items.filter((i) => i.correcto);
    if (filtro === 'incorrectas') return items.filter((i) => !i.correcto);
    return items;
  }, [items, filtro]);

  return (
    <div className="mx-auto max-w-3xl animate-fade-up p-4 sm:p-6">
      <button onClick={() => router.push(volverHref)} className="btn-ghost mb-4 !px-2 text-sm"><ArrowLeft className="h-4 w-4" /> Volver</button>
      <h1 className="font-display text-2xl font-extrabold text-fg">{titulo}</h1>

      {items === null ? (
        <div className="mt-5 space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : items.length === 0 ? (
        <div className="mt-6"><EmptyState icon={<ClipboardList className="h-7 w-7" />} title="Sin respuestas para revisar" hint="Completa el examen para ver la revisión." /></div>
      ) : (
        <>
          <p className="mt-1 text-[15px] text-muted">Acertaste <b className="text-fg">{aciertos}</b> de <b className="text-fg">{items.length}</b> preguntas.</p>

          <div className="my-5 flex flex-wrap gap-2">
            {([['todas', `Todas (${items.length})`], ['correctas', `Correctas (${aciertos})`], ['incorrectas', `Incorrectas (${items.length - aciertos})`]] as [Filtro, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setFiltro(k)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${filtro === k ? 'border-prexi-blue bg-prexi-blue text-white' : 'border-line text-muted hover:bg-subtle'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {visibles.map((it) => {
              const opCorrecta = it.respuesta_correcta.trim().toUpperCase();
              const opDada = (it.opcion_dada ?? '').trim().toUpperCase();
              return (
                <div key={it.numero} className="card">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-prexi-blue-deep">#{it.numero} · {it.categoria}</span>
                      <h3 className="mt-1 font-semibold text-fg">{it.enunciado}</h3>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${it.correcto ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
                      {it.correcto ? <><CheckCircle className="h-3.5 w-3.5" /> Correcta</> : <><X className="h-3.5 w-3.5" /> Incorrecta</>}
                    </span>
                  </div>

                  {it.codigoPython && <div className="mb-3"><CodeBlock code={it.codigoPython} /></div>}

                  <div className="space-y-2">
                    {it.opciones.map((o) => {
                      const id = o.id.trim().toUpperCase();
                      const esCorrecta = id === opCorrecta;
                      const esElegida = id === opDada;
                      const cls = esCorrecta
                        ? 'border-emerald-400 bg-emerald-500/10'
                        : esElegida ? 'border-red-400 bg-red-500/10' : 'border-line';
                      return (
                        <div key={o.id} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${cls}`}>
                          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${esCorrecta ? 'bg-emerald-500 text-white' : esElegida ? 'bg-red-500 text-white' : 'bg-subtle text-muted'}`}>{o.id}</span>
                          <span className="whitespace-pre-line text-fg">{o.texto}</span>
                          {esCorrecta && <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400">Correcta</span>}
                          {esElegida && !esCorrecta && <span className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400">Tu respuesta</span>}
                        </div>
                      );
                    })}
                    {!it.opcion_dada && <p className="text-xs italic text-muted">No respondiste esta pregunta.</p>}
                  </div>

                  {it.explicacion && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-prexi-blue/20 bg-prexi-blue/10 p-3 text-sm text-fg">
                      <Bot className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" />
                      <p><b className="text-fg">Explicación:</b> {it.explicacion}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
