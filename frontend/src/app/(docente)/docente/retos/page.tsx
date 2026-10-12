'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DocenteReto, OpcionTema, NIVEL_LABEL } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton } from '@/components/ui';
import { Plus, Edit, Trash2, Eye, EyeOff, ClipboardList, CheckCircle, Lock } from '@/components/icons';
import { TIPOS_RETO, TipoReto, tipoDe } from '@/components/docente/retos/tipos';

interface Grupo { clave: string; titulo: string; unidadId: number | null; temas: { id: number | null; nombre: string; retos: DocenteReto[] }[] }

/**
 * Retos del docente, separados en sus dos tipos —«Encuentra el bug» y «Escribe
 * tu código»— y, dentro de cada uno, ordenados por unidad y tema. Crear o
 * editar un reto abre el asistente de tres pasos.
 */
export default function DocenteRetosPage() {
  const router = useRouter();
  const tipo: TipoReto = useSearchParams().get('tipo') === 'codigo' ? 'codigo' : 'bug';
  const [retos, setRetos] = useState<DocenteReto[] | null>(null);
  const [temas, setTemas] = useState<OpcionTema[]>([]);
  const [activo, setActivo] = useState<boolean | null>(null);

  const cargar = useCallback(async () => {
    const r = await api.get<{ retos: DocenteReto[] }>('/docente/retos').catch(() => null);
    setRetos(r?.retos ?? []);
  }, []);
  useEffect(() => {
    cargar();
    api.get<{ temas: OpcionTema[] }>('/docente/unidades/temas/opciones').then((r) => setTemas(r.temas)).catch(() => undefined);
    api.get<{ habilitado: boolean }>('/docente/retos/config').then((c) => setActivo(c.habilitado)).catch(() => undefined);
  }, [cargar]);

  async function alternarModulo() {
    if (activo === null) return;
    const nuevo = !activo;
    setActivo(nuevo);
    try { await api.put('/docente/retos/config', { habilitado: nuevo }); } catch { setActivo(!nuevo); }
  }
  async function alternar(r: DocenteReto) { await api.patch(`/docente/retos/${r.id}/activo`).catch(() => undefined); await cargar(); }
  async function eliminar(r: DocenteReto) {
    if (!confirm(`¿Eliminar el reto «${r.titulo}»? También se borran sus entregas.`)) return;
    await api.del(`/docente/retos/${r.id}`).catch(() => undefined); await cargar();
  }

  const cuenta = useMemo(() => ({
    bug: (retos ?? []).filter((r) => r.esBugHunt).length,
    codigo: (retos ?? []).filter((r) => !r.esBugHunt).length,
  }), [retos]);

  // Unidad → tema → retos del tipo elegido. Las unidades sin retos también
  // aparecen, para poder agregarles el primero.
  const grupos = useMemo<Grupo[]>(() => {
    const delTipo = (retos ?? []).filter((r) => tipoDe(r) === tipo);
    const porTema = new Map<number, OpcionTema>(temas.map((t) => [t.id, t]));
    const unidades = new Map<number, Grupo>();
    for (const t of temas) {
      if (!unidades.has(t.unidad_id)) unidades.set(t.unidad_id, { clave: `u${t.unidad_id}`, titulo: `Unidad ${t.unidad_numero}: ${t.unidad_titulo}`, unidadId: t.unidad_id, temas: [] });
    }
    const sinTema: DocenteReto[] = [];
    for (const r of delTipo) {
      const t = r.temaId != null ? porTema.get(r.temaId) : undefined;
      if (!t) { sinTema.push(r); continue; }
      const g = unidades.get(t.unidad_id)!;
      let fila = g.temas.find((x) => x.id === t.id);
      if (!fila) { fila = { id: t.id, nombre: `${t.numero} ${t.titulo}`, retos: [] }; g.temas.push(fila); }
      fila.retos.push(r);
    }
    const orden = new Map(temas.map((t, i) => [t.id, i]));
    const lista = [...unidades.values()];
    lista.forEach((g) => g.temas.sort((a, b) => (orden.get(a.id ?? -1) ?? 0) - (orden.get(b.id ?? -1) ?? 0)));
    if (sinTema.length) lista.push({ clave: 'sin', titulo: 'Sin tema asignado', unidadId: null, temas: [{ id: null, nombre: 'Edítalos para ubicarlos en un tema', retos: sinTema }] });
    return lista;
  }, [retos, temas, tipo]);

  const info = TIPOS_RETO[tipo];
  const nuevo = (temaId?: number | null) => `/docente/retos/nuevo?tipo=${tipo}${temaId ? `&tema=${temaId}` : ''}`;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Retos" subtitle="Desafíos de programación para que tus estudiantes practiquen en el editor de código."
        action={<Link href={nuevo()} className="btn-primary"><Plus className="h-4 w-4" /> Nuevo reto</Link>} />

      {/* Interruptor del módulo */}
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${activo ? 'bg-prexi-green/15 text-prexi-green' : 'bg-subtle text-muted'}`}>{activo ? <CheckCircle className="h-5 w-5" /> : <Lock className="h-5 w-5" />}</div>
          <div>
            <p className="font-semibold text-fg">{activo ? 'Los estudiantes pueden ver los retos' : 'Los retos están ocultos para los estudiantes'}</p>
            <p className="mt-0.5 max-w-xl text-sm text-muted">Cada estudiante ve los retos publicados de su nivel en cada tema. Con esto apagado no ve ninguno.</p>
          </div>
        </div>
        <button onClick={alternarModulo} disabled={activo === null} role="switch" aria-checked={!!activo} className={activo ? 'btn-ghost' : 'btn-primary'}>
          {activo ? 'Ocultar todos los retos' : 'Mostrar los retos'}
        </button>
      </Card>

      {/* Los dos tipos de reto */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2" role="tablist" aria-label="Tipo de reto">
        {(Object.keys(TIPOS_RETO) as TipoReto[]).map((t) => {
          const d = TIPOS_RETO[t];
          const sel = t === tipo;
          return (
            <button key={t} role="tab" aria-selected={sel} onClick={() => router.replace(`/docente/retos?tipo=${t}`)}
              className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${sel ? 'bg-card shadow-soft' : 'border-line bg-card opacity-70 hover:opacity-100'}`}
              style={sel ? { borderColor: d.color } : undefined}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ color: d.color, backgroundColor: `${d.color}1F` }}><d.Icono className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-display text-lg font-bold text-fg">{d.nombre} <Badge tone="slate">{cuenta[t]}</Badge></span>
                <span className="mt-0.5 block text-sm text-muted">{d.resumen}</span>
                <span className="mt-1 block text-xs font-medium text-muted">{d.calificacion}</span>
              </span>
            </button>
          );
        })}
      </div>

      {retos === null ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div> : (
        <div className="space-y-4">
          {grupos.length === 0 && (
            <Card><p className="text-sm text-muted">Primero crea una unidad con sus temas en <Link href="/docente/unidades" className="font-semibold text-prexi-blue-deep hover:underline">Unidades</Link>: los retos se organizan por tema.</p></Card>
          )}
          {grupos.map((g) => (
            <Card key={g.clave}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-fg">{g.titulo}</h2>
                {g.unidadId !== null && (
                  <Link href={`/docente/retos/nuevo?tipo=${tipo}&unidad=${g.unidadId}`} className="btn-ghost text-sm"><Plus className="h-4 w-4" /> Agregar reto en esta unidad</Link>
                )}
              </div>
              {g.temas.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Esta unidad aún no tiene retos de «{info.nombre}».</p>
              ) : (
                <div className="mt-3 space-y-4">
                  {g.temas.map((t) => (
                    <section key={t.id ?? 'sin'}>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-fg">{t.nombre} <span className="font-normal text-muted">· {t.retos.length} {t.retos.length === 1 ? 'reto' : 'retos'}</span></h3>
                        {t.id !== null && <Link href={nuevo(t.id)} className="text-xs font-semibold text-prexi-blue-deep hover:underline">+ Agregar en este tema</Link>}
                      </div>
                      <ul className="space-y-2">
                        {t.retos.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                            <div className="min-w-[200px] flex-1">
                              <p className="text-sm font-semibold text-fg">{r.titulo}</p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                                <Badge tone="slate">{NIVEL_LABEL[r.nivel_dificultad]}</Badge>
                                {r.activo ? <Badge tone="green">Publicado</Badge> : <Badge tone="slate">Borrador</Badge>}
                                <span>{r.resueltos} {r.resueltos === 1 ? 'estudiante lo resolvió' : 'estudiantes lo resolvieron'}</span>
                              </p>
                            </div>
                            {r.pendientes > 0 && (
                              <Link href="/docente/revisiones" className="inline-flex items-center gap-1 rounded-full bg-prexi-amber/15 px-2.5 py-1 text-xs font-bold text-prexi-amber hover:underline">
                                <ClipboardList className="h-3.5 w-3.5" /> {r.pendientes} por revisar
                              </Link>
                            )}
                            <div className="flex items-center gap-1">
                              <Link href={`/docente/retos/${r.id}`} className="btn-ghost !px-2.5 !py-1 text-xs"><Edit className="h-3.5 w-3.5" /> Editar</Link>
                              <button onClick={() => alternar(r)} className="btn-ghost !px-2.5 !py-1 text-xs">{r.activo ? <><EyeOff className="h-3.5 w-3.5" /> Despublicar</> : <><Eye className="h-3.5 w-3.5" /> Publicar</>}</button>
                              <button onClick={() => eliminar(r)} title="Eliminar" aria-label={`Eliminar ${r.titulo}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
