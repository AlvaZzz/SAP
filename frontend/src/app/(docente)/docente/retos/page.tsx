'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DocenteReto, OpcionTema, NIVEL_LABEL } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton, Select } from '@/components/ui';
import { Plus, Edit, Trash2, Eye, EyeOff, ClipboardList, CheckCircle, Lock } from '@/components/icons';
import { TIPOS_RETO, TipoReto, tipoDe } from '@/components/docente/retos/tipos';
import { FuentePractica } from '@/components/fuente-practica';

interface UnidadRetos { id: number; numero: number; titulo: string; temas: OpcionTema[] }

/**
 * Retos del docente, como el paso de ejercicios de Unidades: se elige el TIPO
 * («Encuentra el bug» / «Escribe tu código»), la UNIDAD y el TEMA, y se ven solo
 * los retos de ese tema. Antes todas las unidades y temas iban uno debajo de
 * otro y había que bajar por toda la página para encontrar uno.
 * La selección vive en la URL (?tipo=&unidad=&tema=) para volver al mismo lugar
 * después de editar un reto.
 */
export default function DocenteRetosPage() {
  const router = useRouter();
  const params = useSearchParams();
  const tipo: TipoReto = params.get('tipo') === 'codigo' ? 'codigo' : 'bug';
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

  const delTipo = useMemo(() => (retos ?? []).filter((r) => tipoDe(r) === tipo), [retos, tipo]);
  const cuenta = useMemo(() => ({
    bug: (retos ?? []).filter((r) => r.esBugHunt).length,
    codigo: (retos ?? []).filter((r) => !r.esBugHunt).length,
  }), [retos]);
  const porTema = useMemo(() => {
    const m = new Map<number | null, DocenteReto[]>();
    for (const r of delTipo) m.set(r.temaId ?? null, [...(m.get(r.temaId ?? null) ?? []), r]);
    return m;
  }, [delTipo]);
  const cuantos = (temaId: number | null) => porTema.get(temaId)?.length ?? 0;

  // Unidades con sus temas en orden de estudio (cada tema seguido de sus subtemas).
  const unidades = useMemo<UnidadRetos[]>(() => {
    const m = new Map<number, UnidadRetos>();
    for (const t of temas) {
      if (!m.has(t.unidad_id)) m.set(t.unidad_id, { id: t.unidad_id, numero: t.unidad_numero, titulo: t.unidad_titulo, temas: [] });
    }
    for (const u of m.values()) {
      const deU = temas.filter((t) => t.unidad_id === u.id);
      const padres = deU.filter((t) => t.padre_id === null).sort((a, b) => a.orden - b.orden);
      u.temas = padres.flatMap((p) => [p, ...deU.filter((s) => s.padre_id === p.id).sort((a, b) => a.orden - b.orden)]);
    }
    return [...m.values()].sort((a, b) => a.numero - b.numero);
  }, [temas]);
  const sinTema = porTema.get(null) ?? [];
  const totalUnidad = (u: UnidadRetos) => u.temas.reduce((s, t) => s + cuantos(t.id), 0);

  // Selección: la de la URL si es válida; si no, la primera unidad y el primer
  // tema que tengan retos de este tipo.
  const unidadSel = useMemo(() => {
    const pedida = unidades.find((u) => String(u.id) === params.get('unidad'));
    return pedida ?? unidades.find((u) => totalUnidad(u) > 0) ?? unidades[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades, params, porTema]);
  const verSinTema = params.get('tema') === 'sin' && sinTema.length > 0;
  const temaSel = useMemo(() => {
    if (!unidadSel || verSinTema) return null;
    const pedido = unidadSel.temas.find((t) => String(t.id) === params.get('tema'));
    return pedido ?? unidadSel.temas.find((t) => cuantos(t.id) > 0) ?? unidadSel.temas[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidadSel, params, porTema, verSinTema]);

  const ir = (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams({ tipo });
    if (unidadSel) q.set('unidad', String(unidadSel.id));
    if (temaSel) q.set('tema', String(temaSel.id));
    for (const [k, v] of Object.entries(cambios)) { if (v === null) q.delete(k); else q.set(k, v); }
    router.replace(`/docente/retos?${q.toString()}`, { scroll: false });
  };

  const info = TIPOS_RETO[tipo];
  const nuevo = (temaId?: number | null) => `/docente/retos/nuevo?tipo=${tipo}${temaId ? `&tema=${temaId}` : ''}`;
  const lista = verSinTema ? sinTema : temaSel ? porTema.get(temaSel.id) ?? [] : [];

  return (
    <div className="animate-fade-up">
      <PageHeader title="Retos" subtitle="Desafíos de programación para que tus estudiantes practiquen en el editor de código."
        action={<Link href={nuevo(temaSel?.id)} className="btn-primary"><Plus className="h-4 w-4" /> Nuevo reto</Link>} />

      {/* Interruptor del módulo, en una sola línea */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <p className="flex items-center gap-2.5 text-sm">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${activo ? 'bg-prexi-green/15 text-prexi-green' : 'bg-subtle text-muted'}`}>{activo ? <CheckCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}</span>
          <span><b className="text-fg">{activo ? 'Los estudiantes ven los retos' : 'Los retos están ocultos'}</b><span className="text-muted"> · cada uno ve los publicados de su nivel en cada tema</span></span>
        </p>
        <button onClick={alternarModulo} disabled={activo === null} role="switch" aria-checked={!!activo} className={`${activo ? 'btn-ghost' : 'btn-primary'} !py-1.5 text-sm`}>
          {activo ? 'Ocultar todos' : 'Mostrar los retos'}
        </button>
      </div>

      {/* 1) Tipo de reto */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Tipo de reto">
        {(Object.keys(TIPOS_RETO) as TipoReto[]).map((t) => {
          const d = TIPOS_RETO[t];
          const sel = t === tipo;
          return (
            <button key={t} role="tab" aria-selected={sel} onClick={() => router.replace(`/docente/retos?tipo=${t}${unidadSel ? `&unidad=${unidadSel.id}` : ''}`, { scroll: false })}
              className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${sel ? 'bg-card shadow-soft' : 'border-line bg-card opacity-70 hover:opacity-100'}`}
              style={sel ? { borderColor: d.color } : undefined}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ color: d.color, backgroundColor: `${d.color}1F` }}><d.Icono className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-display text-base font-bold text-fg">{d.nombre} <Badge tone="slate">{cuenta[t]}</Badge></span>
                <span className="block text-xs text-muted">{d.calificacion}</span>
              </span>
            </button>
          );
        })}
      </div>

      {retos === null ? <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div> : unidades.length === 0 ? (
        <Card><p className="text-sm text-muted">Primero crea una unidad con sus temas en <Link href="/docente/unidades" className="font-semibold text-prexi-blue-deep hover:underline">Unidades</Link>: los retos se organizan por tema.</p></Card>
      ) : (
        <>
          {/* 2) Unidad */}
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Unidad">
            {unidades.map((u) => {
              const sel = u.id === unidadSel?.id && !verSinTema;
              const n = totalUnidad(u);
              return (
                <button key={u.id} role="tab" aria-selected={sel} title={u.titulo} onClick={() => ir({ unidad: String(u.id), tema: null })}
                  className={`shrink-0 rounded-xl border px-3.5 py-2 text-left text-sm transition ${sel ? 'border-prexi-blue bg-prexi-blue/10 font-bold text-prexi-blue-deep' : 'border-line bg-card text-fg hover:bg-subtle'}`}>
                  Unidad {u.numero} <span className={`ml-1 rounded-md px-1.5 py-0.5 text-2xs font-bold ${n ? 'bg-prexi-blue/15 text-prexi-blue-deep' : 'bg-subtle text-muted'}`}>{n}</span>
                </button>
              );
            })}
            {sinTema.length > 0 && (
              <button role="tab" aria-selected={verSinTema} onClick={() => ir({ tema: 'sin' })}
                className={`shrink-0 rounded-xl border px-3.5 py-2 text-sm transition ${verSinTema ? 'border-prexi-amber bg-prexi-amber/10 font-bold text-prexi-amber' : 'border-line bg-card text-fg hover:bg-subtle'}`}>
                Sin tema <span className="ml-1 rounded-md bg-prexi-amber/15 px-1.5 py-0.5 text-2xs font-bold text-prexi-amber">{sinTema.length}</span>
              </button>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* 3) Tema: lista a la izquierda (desplegable en celular) */}
            {!verSinTema && unidadSel && (
              <>
                <div className="lg:hidden">
                  <Select aria-label="Tema" value={temaSel?.id ?? ''} onChange={(e) => ir({ tema: e.target.value })}>
                    {unidadSel.temas.map((t) => <option key={t.id} value={t.id}>{t.padre_id ? '— ' : ''}{t.numero} {t.titulo} ({cuantos(t.id)})</option>)}
                  </Select>
                </div>
                <nav aria-label="Temas de la unidad" className="hidden rounded-2xl border border-line bg-card p-2 lg:block lg:self-start">
                  <p className="px-2 pb-1.5 pt-1 text-xs font-bold uppercase tracking-wide text-muted">Unidad {unidadSel.numero} · elige un tema</p>
                  <ul className="max-h-[65vh] space-y-0.5 overflow-y-auto">
                    {unidadSel.temas.map((t) => {
                      const n = cuantos(t.id);
                      const sel = t.id === temaSel?.id;
                      return (
                        <li key={t.id}>
                          <button onClick={() => ir({ tema: String(t.id) })} aria-current={sel ? 'true' : undefined}
                            className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${t.padre_id ? 'ml-3 w-[calc(100%-0.75rem)]' : ''} ${sel ? 'bg-prexi-blue/10 ring-1 ring-prexi-blue' : 'hover:bg-subtle'}`}>
                            <span className={`min-w-0 flex-1 truncate text-sm ${n ? 'font-semibold text-fg' : 'text-muted'}`}>{t.numero} {t.titulo}</span>
                            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-bold ${n ? 'text-white' : 'bg-subtle text-muted'}`} style={n ? { backgroundColor: info.color } : undefined}>{n}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </>
            )}

            {/* Retos del tema elegido */}
            <Card className={`min-w-0 ${verSinTema ? 'lg:col-span-2' : ''}`}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: info.color }}>{info.nombre}</p>
                  <h2 className="font-display text-lg font-bold text-fg">{verSinTema ? 'Retos sin tema asignado' : temaSel ? `${temaSel.numero} ${temaSel.titulo}` : 'Esta unidad no tiene temas'}</h2>
                  <p className="text-sm text-muted">{verSinTema ? 'Edítalos para ubicarlos en un tema.' : `${lista.length} ${lista.length === 1 ? 'reto' : 'retos'} en este tema`}</p>
                </div>
                {temaSel && <Link href={nuevo(temaSel.id)} className="btn-ghost text-sm"><Plus className="h-4 w-4" /> Agregar en este tema</Link>}
              </div>

              {lista.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
                  <p className="text-sm text-muted">Este tema aún no tiene retos de «{info.nombre}».</p>
                  {temaSel && <Link href={nuevo(temaSel.id)} className="btn-primary mt-3 text-sm"><Plus className="h-4 w-4" /> Crear el primero</Link>}
                </div>
              ) : (
                <ul className="space-y-2">
                  {lista.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                      <div className="min-w-[200px] flex-1">
                        <p className="text-sm font-semibold text-fg">{r.titulo}</p>
                        <FuentePractica fuente={r.fuente_practica} className="my-1" />
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
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
