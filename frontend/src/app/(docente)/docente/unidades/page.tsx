'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { UnidadDocente } from '@/lib/types';
import { PageHeader, Card, Skeleton, EmptyState } from '@/components/ui';
import { NIVELES } from '@/components/nivel-badge';
import { aplanar } from '@/components/docente/unidad/selector-tema';
import { Plus, Trash2, Layers, CheckCircle, ArrowRight, Circle } from '@/components/icons';

const META = 10;

/** Estado de los cuatro pasos de una unidad, para saber de un vistazo por dónde seguir. */
function pasosDe(u: UnidadDocente) {
  const temas = aplanar(u.temas).map((t) => t.tema);
  const n = temas.length;
  const conEjercicios = temas.filter((t) => NIVELES.every((k) => t.por_nivel[k] >= t.ejercicios_minimos)).length;
  const conFlashcards = temas.filter((t) => t.flashcards >= META).length;
  return [
    { nombre: 'Unidad y temas', detalle: n === 0 ? 'Sin temas todavía' : `${n} ${n === 1 ? 'tema' : 'temas'}`, listo: n > 0 },
    { nombre: 'Ejercicios', detalle: `${conEjercicios} de ${n} temas completos`, listo: n > 0 && conEjercicios === n },
    { nombre: 'Flashcards', detalle: `${conFlashcards} de ${n} temas completos`, listo: n > 0 && conFlashcards === n },
    { nombre: 'Examen', detalle: `${u.examen.integradoras} de ${u.examen.minimo} preguntas`, listo: u.examen.integradoras >= u.examen.minimo },
  ];
}

/**
 * Lista de unidades. Cada tarjeta resume los cuatro pasos y lleva al asistente
 * justo en el primero que falta.
 */
export default function DocenteUnidadesPage() {
  const [unidades, setUnidades] = useState<UnidadDocente[] | null>(null);

  const cargar = useCallback(async () => {
    const r = await api.get<{ unidades: UnidadDocente[] }>('/docente/unidades').catch(() => null);
    setUnidades(r?.unidades ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function eliminar(u: UnidadDocente) {
    if (!confirm(`¿Eliminar la Unidad ${u.numero}: ${u.titulo}?`)) return;
    try { await api.del(`/docente/unidades/${u.id}`); await cargar(); }
    catch (e) { alert(e instanceof ApiError ? e.message : 'No se pudo eliminar la unidad.'); }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Unidades" subtitle="El contenido de tu materia. Cada unidad se arma en cuatro pasos: temas, ejercicios, flashcards y examen."
        action={<Link href="/docente/unidades/nueva" className="btn-primary"><Plus className="h-4 w-4" /> Nueva unidad</Link>} />

      {unidades === null ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
        : unidades.length === 0 ? <EmptyState icon={<Layers className="h-7 w-7" />} title="Aún no hay unidades" hint="Crea la primera con «Nueva unidad»: el asistente te guía paso a paso." />
          : (
            <div className="space-y-4">
              {unidades.map((u) => {
                const pasos = pasosDe(u);
                const pendiente = pasos.findIndex((p) => !p.listo);
                const publicados = aplanar(u.temas).filter((t) => t.tema.publicado).length;
                return (
                  <Card key={u.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted">Unidad {u.numero}</p>
                        <h2 className="font-display text-lg font-bold text-fg">{u.titulo}</h2>
                        <p className="mt-0.5 text-sm text-muted">{publicados === 0 ? 'Ningún tema publicado: los estudiantes aún no la ven.' : `${publicados} ${publicados === 1 ? 'tema publicado' : 'temas publicados'}.`}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => eliminar(u)} title="Eliminar unidad" aria-label={`Eliminar unidad ${u.numero}`} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
                        <Link href={`/docente/unidades/${u.id}?paso=${pendiente === -1 ? 1 : pendiente + 1}`} className="btn-primary">
                          {pendiente === -1 ? 'Abrir' : `Continuar: ${pasos[pendiente].nombre.toLowerCase()}`} <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                    <ol className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {pasos.map((p, i) => (
                        <li key={p.nombre}>
                          <Link href={`/docente/unidades/${u.id}?paso=${i + 1}`} className="flex items-start gap-2 rounded-xl border border-line px-3 py-2.5 transition hover:bg-subtle">
                            {p.listo ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-prexi-green" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-fg">{i + 1}. {p.nombre}</span>
                              <span className={`block text-xs ${p.listo ? 'text-prexi-green' : 'text-muted'}`}>{p.detalle}</span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </Card>
                );
              })}
            </div>
          )}
    </div>
  );
}
