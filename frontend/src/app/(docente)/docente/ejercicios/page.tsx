'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DocenteEjercicio, TipoEjercicio, UnidadDocente, NivelDificultad, NIVEL_LABEL } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton, Modal, Field, Input, Textarea, Select, EmptyState } from '@/components/ui';
import { NivelBadge, nivelDesdeEstrellas, estrellasDesdeNivel, NIVELES } from '@/components/nivel-badge';
import { Plus, Edit, Trash2, Power, Filter, Code, Layers, ChevronUp, ChevronDown } from '@/components/icons';

const TIPOS: { value: TipoEjercicio; label: string }[] = [
  { value: 'opcion_multiple', label: 'Opción múltiple' },
  { value: 'predecir_salida', label: 'Predecir salida' },
  { value: 'completar_codigo', label: 'Completar código' },
  { value: 'ordenar_lineas', label: 'Ordenar líneas (Parsons)' },
];
const IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
const CON_OPCIONES: TipoEjercicio[] = ['opcion_multiple', 'predecir_salida', 'ordenar_lineas'];

/** Ubicación académica (Unidad → Tema → Subtema) de un ejercicio, resuelta desde /docente/unidades. */
interface Ubicacion {
  uId: number; uNum: number; uTit: string;
  parentTemaId: number; tNum: string; tTit: string; tOrden: number;
  esSub: boolean; sId?: number; sNum?: string; sTit?: string; sOrden?: number;
}

interface FormState {
  titulo: string; categoria: string;
  unidadId: string; temaId: string; subtemaId: string; // jerarquía (dropdowns dependientes)
  estrellas: number; tipo: TipoEjercicio;
  enunciado: string; codigoPython: string; opciones: { id: string; texto: string }[];
  respuestaCorrecta: string; xp: number; explicacionIa: string; activo: boolean;
}

const VACIO: FormState = {
  titulo: '', categoria: '', unidadId: '', temaId: '', subtemaId: '', estrellas: 3, tipo: 'opcion_multiple',
  enunciado: '', codigoPython: '', opciones: [{ id: 'A', texto: '' }, { id: 'B', texto: '' }, { id: 'C', texto: '' }, { id: 'D', texto: '' }],
  respuestaCorrecta: 'A', xp: 50, explicacionIa: '', activo: true,
};

type BancoDocente = 'practica' | 'examen';

export default function DocenteEjerciciosPage() {
  const [banco, setBanco] = useState<BancoDocente>('practica');
  const [items, setItems] = useState<DocenteEjercicio[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<UnidadDocente[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros por jerarquía real (reemplazan al filtro de "nivel").
  const [fUnidad, setFUnidad] = useState('');
  const [fTema, setFTema] = useState('');
  const [fSubtema, setFSubtema] = useState('');
  const [fCategoria, setFCategoria] = useState('');
  const [fDificultad, setFDificultad] = useState('');

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [apiError, setApiError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      // Trae el banco seleccionado (práctica o examen) y agrupa/filtra en el cliente.
      const r = await api.get<{ ejercicios: DocenteEjercicio[] }>(`/docente/ejercicios?banco=${banco}`);
      setItems(r.ejercicios ?? []);
    } catch { /* noop */ } finally { setCargando(false); }
  }, [banco]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { api.get<{ categorias: string[] }>(`/docente/ejercicios/categorias?banco=${banco}`).then((r) => setCategorias(r.categorias)).catch(() => undefined); }, [items.length, banco]);
  useEffect(() => { api.get<{ unidades: UnidadDocente[] }>('/docente/unidades').then((r) => setUnidades(r.unidades ?? [])).catch(() => undefined); }, []);

  // Índice temaId → ubicación (mapea IDs de tema Y de subtema, porque un ejercicio
  // se ata a cualquiera de los dos). Robusto ante subtemas ausentes.
  const loc = useMemo(() => {
    const m = new Map<number, Ubicacion>();
    unidades.forEach((u) => {
      (u.temas ?? []).forEach((t, ti) => {
        m.set(t.id, { uId: u.id, uNum: u.numero, uTit: u.titulo, parentTemaId: t.id, tNum: t.numero, tTit: t.titulo, tOrden: ti, esSub: false });
        (t.subtemas ?? []).forEach((s, si) => {
          m.set(s.id, { uId: u.id, uNum: u.numero, uTit: u.titulo, parentTemaId: t.id, tNum: t.numero, tTit: t.titulo, tOrden: ti, esSub: true, sId: s.id, sNum: s.numero, sTit: s.titulo, sOrden: si });
        });
      });
    });
    return m;
  }, [unidades]);

  // Aplica los filtros (unidad/tema/subtema/categoría/dificultad) en el cliente.
  const filtrados = useMemo(() => items.filter((e) => {
    const l = e.temaId != null ? loc.get(e.temaId) : undefined;
    if (fUnidad && (!l || l.uId !== Number(fUnidad))) return false;
    if (fTema && (!l || l.parentTemaId !== Number(fTema))) return false;
    if (fSubtema && e.temaId !== Number(fSubtema)) return false;
    if (fCategoria && e.categoria !== fCategoria) return false;
    if (fDificultad && nivelDesdeEstrellas(e.estrellas) !== fDificultad) return false;
    return true;
  }), [items, loc, fUnidad, fTema, fSubtema, fCategoria, fDificultad]);

  // Agrupa por Unidad → línea de tema/subtema, ordenado.
  const grupos = useMemo(() => {
    const porUnidad = new Map<number, Map<number, { etiqueta: string; esSub: boolean; orden: number; ejercicios: DocenteEjercicio[] }>>();
    const sinAsignar: DocenteEjercicio[] = [];
    for (const e of filtrados) {
      const l = e.temaId != null ? loc.get(e.temaId) : undefined;
      if (!l || e.temaId == null) { sinAsignar.push(e); continue; }
      const um = porUnidad.get(l.uNum) ?? new Map();
      porUnidad.set(l.uNum, um);
      const etiqueta = l.esSub ? `${l.tNum} ${l.tTit} › ${l.sNum} ${l.sTit}` : `${l.tNum} ${l.tTit}`;
      const orden = l.esSub ? l.tOrden * 100 + (l.sOrden! + 1) : l.tOrden * 100;
      const bucket = um.get(e.temaId) ?? { etiqueta, esSub: l.esSub, orden, ejercicios: [] };
      bucket.ejercicios.push(e);
      um.set(e.temaId, bucket);
    }
    const unidadesOrd = [...porUnidad.keys()].sort((a, b) => a - b).map((uNum) => {
      const info = unidades.find((u) => u.numero === uNum);
      const lineas = [...porUnidad.get(uNum)!.entries()]
        .map(([temaId, v]) => ({ temaId, ...v }))
        .sort((a, b) => a.orden - b.orden);
      return { uNum, uTit: info?.titulo ?? '', total: lineas.reduce((s, l) => s + l.ejercicios.length, 0), lineas };
    });
    return { unidadesOrd, sinAsignar };
  }, [filtrados, loc, unidades]);

  function abrirCrear() { setEditId(null); setForm(VACIO); setErrores({}); setApiError(''); setModal(true); }
  function abrirEditar(e: DocenteEjercicio) {
    setEditId(e.id); setErrores({}); setApiError('');
    const l = e.temaId != null ? loc.get(e.temaId) : undefined;
    const ubic = l
      ? { unidadId: String(l.uId), temaId: String(l.parentTemaId), subtemaId: l.esSub ? String(e.temaId) : '' }
      : { unidadId: '', temaId: '', subtemaId: '' };
    const ops = Array.isArray(e.opciones) && e.opciones.length ? e.opciones.map((o) => ({ id: o.id, texto: o.texto })) : VACIO.opciones;
    setForm({
      titulo: e.titulo, categoria: e.categoria, ...ubic, estrellas: e.estrellas, tipo: e.tipo,
      enunciado: e.enunciado, codigoPython: e.codigoPython ?? '', opciones: ops,
      respuestaCorrecta: e.respuestaCorrecta, xp: e.xp, explicacionIa: e.explicacionIa ?? '', activo: e.activo,
    });
    setModal(true);
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (form.titulo.trim().length < 3) e.titulo = 'Mínimo 3 caracteres.';
    if (!form.unidadId) e.unidadId = 'Elige la unidad.';
    if (!form.temaId) e.temaId = 'Elige el tema.';
    if (form.categoria.trim().length < 2) e.categoria = 'Indica una categoría.';
    if (form.enunciado.trim().length < 3) e.enunciado = 'Escribe el enunciado.';
    if (form.xp < 5 || form.xp > 500) e.xp = 'XP entre 5 y 500.';
    if (CON_OPCIONES.includes(form.tipo)) {
      if (form.opciones.some((o) => !o.texto.trim())) e.opciones = 'Todas las opciones deben tener texto.';
      if (form.tipo === 'ordenar_lineas' && form.opciones.length < 2) e.opciones = 'Agrega al menos 2 líneas.';
      if (form.tipo !== 'ordenar_lineas' && !form.opciones.some((o) => o.id === form.respuestaCorrecta)) e.respuestaCorrecta = 'Marca la respuesta correcta.';
    } else if (!form.respuestaCorrecta.trim()) {
      e.respuestaCorrecta = 'Escribe la respuesta esperada.';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true); setApiError('');
    const respuestaCorrecta = form.tipo === 'ordenar_lineas' ? form.opciones.map((o) => o.id).join(',') : form.respuestaCorrecta;
    // El tema efectivo es el subtema si se eligió; si no, el tema. El nivel de
    // gamificación se DERIVA de la unidad (Unidad N ↔ Nivel N): sin campo suelto.
    const temaIdFinal = form.subtemaId ? Number(form.subtemaId) : Number(form.temaId);
    const payload = {
      titulo: form.titulo.trim(), categoria: form.categoria.trim(),
      temaId: temaIdFinal, estrellas: form.estrellas, banco,
      tipo: form.tipo, enunciado: form.enunciado.trim(), codigoPython: form.codigoPython.trim() || undefined,
      opciones: CON_OPCIONES.includes(form.tipo) ? form.opciones.map((o) => ({ id: o.id, texto: o.texto.trim() })) : [],
      respuestaCorrecta, xp: form.xp, explicacionIa: form.explicacionIa.trim() || undefined, activo: form.activo,
    };
    try {
      if (editId) await api.put(`/docente/ejercicios/${editId}`, payload);
      else await api.post('/docente/ejercicios', payload);
      setModal(false);
      await cargar();
    } catch (err) { setApiError(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  async function alternar(e: DocenteEjercicio) { await api.patch(`/docente/ejercicios/${e.id}/activo`).catch(() => undefined); await cargar(); }
  async function eliminar(e: DocenteEjercicio) {
    if (!confirm(`¿Eliminar "${e.titulo}"? Esta acción no se puede deshacer.`)) return;
    await api.del(`/docente/ejercicios/${e.id}`).catch(() => undefined); await cargar();
  }

  const setOpcion = (i: number, texto: string) => setForm((f) => ({ ...f, opciones: f.opciones.map((o, j) => (j === i ? { ...o, texto } : o)) }));
  const addOpcion = () => setForm((f) => f.opciones.length >= 6 ? f : ({ ...f, opciones: [...f.opciones, { id: IDS[f.opciones.length], texto: '' }] }));
  const delOpcion = (i: number) => setForm((f) => {
    if (f.opciones.length <= 2) return f;
    const nuevas = f.opciones.filter((_, j) => j !== i).map((o, j) => ({ id: IDS[j], texto: o.texto }));
    const correcta = nuevas.some((o) => o.id === f.respuestaCorrecta) ? f.respuestaCorrecta : nuevas[0].id;
    return { ...f, opciones: nuevas, respuestaCorrecta: correcta };
  });
  const moverOpcion = (i: number, dir: -1 | 1) => setForm((f) => {
    const j = i + dir;
    if (j < 0 || j >= f.opciones.length) return f;
    const nuevas = [...f.opciones];
    [nuevas[i], nuevas[j]] = [nuevas[j], nuevas[i]];
    return { ...f, opciones: nuevas };
  });

  const totalActivos = useMemo(() => items.filter((e) => e.activo).length, [items]);
  // Derivados para los dropdowns dependientes del formulario y de los filtros.
  const unidadSel = unidades.find((u) => String(u.id) === form.unidadId);
  const temaSel = unidadSel?.temas.find((t) => String(t.id) === form.temaId);
  const fUnidadSel = unidades.find((u) => String(u.id) === fUnidad);
  const fTemaSel = fUnidadSel?.temas.find((t) => String(t.id) === fTema);
  const hayFiltro = fUnidad || fTema || fSubtema || fCategoria || fDificultad;

  function ubicacionCorta(e: DocenteEjercicio): string {
    const l = e.temaId != null ? loc.get(e.temaId) : undefined;
    if (!l) return 'Sin asignar';
    return l.esSub ? `U${l.uNum} · ${l.sNum} ${l.sTit}` : `U${l.uNum} · ${l.tNum} ${l.tTit}`;
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Gestión de ejercicios" subtitle={`${items.length} ${banco === 'examen' ? 'preguntas de examen' : 'ejercicios de práctica'} · ${totalActivos} activos · organizados por unidad`}
        action={<button onClick={abrirCrear} className="btn-primary"><Plus className="h-4 w-4" /> {banco === 'examen' ? 'Nueva pregunta' : 'Nuevo ejercicio'}</button>} />

      {/* Selector de BANCO: práctica (ruta del estudiante) o examen de fin de unidad */}
      <div className="mb-5 inline-flex rounded-xl border border-line bg-card p-1">
        {([['practica', 'Práctica (ruta)'], ['examen', 'Examen de unidad']] as [BancoDocente, string][]).map(([b, label]) => (
          <button key={b} onClick={() => setBanco(b)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${banco === b ? 'bg-prexi-blue text-white' : 'text-muted hover:text-fg'}`}>
            {label}
          </button>
        ))}
      </div>
      {banco === 'examen' && (
        <p className="mb-5 flex items-start gap-2 rounded-xl bg-prexi-blue/10 px-3.5 py-2.5 text-sm text-fg">
          <Filter className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" />
          <span>Estas preguntas forman el <b>examen de fin de unidad</b> (gate de avance). Son distintas del banco de práctica; el estudiante las rinde tras el repaso de la unidad.</span>
        </p>
      )}

      {/* Filtros por jerarquía real: Unidad → Tema → Subtema, categoría y dificultad */}
      <Card className="mb-6 flex flex-wrap items-center gap-3 !py-4">
        <span className="flex items-center gap-2 text-sm font-medium text-muted"><Filter className="h-4 w-4" /> Filtros</span>
        <Select value={fUnidad} onChange={(e) => { setFUnidad(e.target.value); setFTema(''); setFSubtema(''); }} className="!w-auto">
          <option value="">Todas las unidades</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>Unidad {u.numero}: {u.titulo}</option>)}
        </Select>
        <Select value={fTema} disabled={!fUnidad} onChange={(e) => { setFTema(e.target.value); setFSubtema(''); }} className="!w-auto">
          <option value="">{fUnidad ? 'Todos los temas' : 'Tema'}</option>
          {fUnidadSel?.temas.map((t) => <option key={t.id} value={t.id}>{t.numero} {t.titulo}</option>)}
        </Select>
        <Select value={fSubtema} disabled={!fTema || !fTemaSel?.subtemas.length} onChange={(e) => setFSubtema(e.target.value)} className="!w-auto">
          <option value="">{fTemaSel?.subtemas.length ? 'Todos los subtemas' : 'Subtema'}</option>
          {fTemaSel?.subtemas.map((s) => <option key={s.id} value={s.id}>{s.numero} {s.titulo}</option>)}
        </Select>
        <Select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className="!w-auto">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={fDificultad} onChange={(e) => setFDificultad(e.target.value)} className="!w-auto">
          <option value="">Todo nivel</option>
          {NIVELES.map((n) => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
        </Select>
        {hayFiltro && <button onClick={() => { setFUnidad(''); setFTema(''); setFSubtema(''); setFCategoria(''); setFDificultad(''); }} className="text-sm font-semibold text-prexi-blue-deep hover:underline">Limpiar</button>}
      </Card>

      {cargando ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtrados.length === 0 ? (
        <EmptyState icon={<Code className="h-7 w-7" />} title="No hay ejercicios" hint={hayFiltro ? 'Ajusta o limpia los filtros.' : 'Crea el primero con “Nuevo ejercicio”.'} />
      ) : (
        <div className="space-y-6">
          {grupos.unidadesOrd.map((u) => (
            <div key={u.uNum}>
              {/* Encabezado de UNIDAD */}
              <div className="mb-2 flex items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-prexi-navy/10 font-display text-sm font-extrabold text-prexi-navy dark:bg-white/10 dark:text-blue-200">{u.uNum}</div>
                <h2 className="font-display text-lg font-bold text-fg">Unidad {u.uNum}: {u.uTit}</h2>
                <span className="text-xs font-semibold text-muted">{u.total} ejercicios</span>
              </div>
              <Card className="!p-0">
                {u.lineas.map((linea, idx) => (
                  <div key={linea.temaId} className={idx > 0 ? 'border-t border-line' : ''}>
                    {/* Encabezado de TEMA / SUBTEMA */}
                    <div className={`flex items-center gap-2 px-5 py-2.5 ${linea.esSub ? 'bg-subtle/40' : 'bg-subtle/70'}`}>
                      <Layers className="h-3.5 w-3.5 text-muted" />
                      <span className={`text-sm font-semibold ${linea.esSub ? 'text-muted' : 'text-fg'}`}>{linea.esSub ? '↳ ' : ''}{linea.etiqueta}</span>
                      <span className="text-xs text-muted">· {linea.ejercicios.length}</span>
                    </div>
                    {/* Ejercicios del tema/subtema */}
                    <div className="divide-y divide-line">
                      {linea.ejercicios.map((e) => (
                        <div key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3 transition hover:bg-subtle">
                          <div className="min-w-[200px] flex-1">
                            <p className="font-semibold text-fg">{e.titulo}</p>
                            <p className="text-xs text-muted">{e.categoria} · {TIPOS.find((t) => t.value === e.tipo)?.label ?? e.tipo}</p>
                          </div>
                          <NivelBadge estrellas={e.estrellas} size="sm" />
                          <span className="w-14 text-right text-xs text-muted">{e.xp} XP</span>
                          <span className="w-16 text-right text-xs text-muted">{e.intentos} int.</span>
                          {e.activo ? <Badge tone="green">Activo</Badge> : <Badge tone="slate">Inactivo</Badge>}
                          <div className="flex items-center gap-1">
                            <button onClick={() => alternar(e)} title={e.activo ? 'Desactivar' : 'Activar'} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-blue-deep"><Power className="h-4 w-4" /></button>
                            <button onClick={() => abrirEditar(e)} title="Editar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-blue-deep"><Edit className="h-4 w-4" /></button>
                            <button onClick={() => eliminar(e)} title="Eliminar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}

          {/* Ejercicios sin unidad/tema asignado (legado) */}
          {grupos.sinAsignar.length > 0 && (
            <div>
              <h2 className="mb-2 font-display text-lg font-bold text-muted">Sin unidad asignada</h2>
              <Card className="!p-0"><div className="divide-y divide-line">
                {grupos.sinAsignar.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3 transition hover:bg-subtle">
                    <div className="min-w-[200px] flex-1"><p className="font-semibold text-fg">{e.titulo}</p><p className="text-xs text-muted">{e.categoria} · {ubicacionCorta(e)}</p></div>
                    <NivelBadge estrellas={e.estrellas} size="sm" />
                    {e.activo ? <Badge tone="green">Activo</Badge> : <Badge tone="slate">Inactivo</Badge>}
                    <div className="flex items-center gap-1">
                      <button onClick={() => alternar(e)} title={e.activo ? 'Desactivar' : 'Activar'} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-blue-deep"><Power className="h-4 w-4" /></button>
                      <button onClick={() => abrirEditar(e)} title="Editar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-blue-deep"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => eliminar(e)} title="Eliminar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div></Card>
            </div>
          )}
        </div>
      )}

      {/* ── Modal crear/editar ── */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar ejercicio' : 'Nuevo ejercicio'} size="lg"
        footer={<>
          <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-60">{guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear ejercicio'}</button>
        </>}>
        {apiError && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{apiError}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Título" error={errores.titulo}><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej.: Suma de dos números" /></Field></div>

          {/* Ubicación académica: Unidad → Tema → Subtema (fuente del nivel) */}
          <div className="sm:col-span-2 grid gap-4 rounded-xl border border-line bg-subtle/40 p-3 sm:grid-cols-3">
            <Field label="Unidad" error={errores.unidadId} hint={unidades.length === 0 ? 'Crea unidades en “Unidades y temas”.' : undefined}>
              <Select value={form.unidadId} onChange={(e) => setForm({ ...form, unidadId: e.target.value, temaId: '', subtemaId: '' })}>
                <option value="">Selecciona…</option>
                {unidades.map((u) => <option key={u.id} value={u.id}>Unidad {u.numero}: {u.titulo}</option>)}
              </Select>
            </Field>
            <Field label="Tema (nivel)" error={errores.temaId}>
              <Select value={form.temaId} disabled={!form.unidadId} onChange={(e) => setForm({ ...form, temaId: e.target.value, subtemaId: '' })}>
                <option value="">{form.unidadId ? 'Selecciona…' : '—'}</option>
                {unidadSel?.temas.map((t) => <option key={t.id} value={t.id}>{t.numero} {t.titulo} ({t.ejercicios_activos}/{t.ejercicios_minimos})</option>)}
              </Select>
            </Field>
            <Field label="Subtema (opcional)">
              <Select value={form.subtemaId} disabled={!form.temaId || !temaSel?.subtemas.length} onChange={(e) => setForm({ ...form, subtemaId: e.target.value })}>
                <option value="">{temaSel?.subtemas.length ? 'Ninguno (tema directo)' : '—'}</option>
                {temaSel?.subtemas.map((s) => <option key={s.id} value={s.id}>{s.numero} {s.titulo} ({s.ejercicios_activos}/{s.ejercicios_minimos})</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Categoría" error={errores.categoria}>
            <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Variables, Bucles…" list="cats" />
            <datalist id="cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Nivel de dificultad"><Select value={nivelDesdeEstrellas(form.estrellas)} onChange={(e) => setForm({ ...form, estrellas: estrellasDesdeNivel(e.target.value as NivelDificultad) })}>{NIVELES.map((n) => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}</Select></Field>

          <div className="sm:col-span-2"><Field label="Tipo de pregunta"><Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoEjercicio })}>{TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field></div>

          <div className="sm:col-span-2"><Field label="Enunciado" error={errores.enunciado}><Textarea value={form.enunciado} onChange={(e) => setForm({ ...form, enunciado: e.target.value })} placeholder="¿Qué debe resolver el estudiante?" /></Field></div>
          <div className="sm:col-span-2"><Field label="Código Python (opcional)" hint="Se muestra como bloque de código en el ejercicio."><Textarea value={form.codigoPython} onChange={(e) => setForm({ ...form, codigoPython: e.target.value })} className="font-mono text-sm" placeholder={'print(2 + 3)'} /></Field></div>

          {form.tipo === 'completar_codigo' ? (
            <div className="sm:col-span-2">
              <Field label="Respuesta esperada" error={errores.respuestaCorrecta} hint='Admite variantes equivalentes separadas por "|", ej.: for i in range(10)|for i in range(0,10)'>
                <Input value={form.respuestaCorrecta} onChange={(e) => setForm({ ...form, respuestaCorrecta: e.target.value })} placeholder="Ej.: for i in range(10)" />
              </Field>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-fg">{form.tipo === 'ordenar_lineas' ? 'Líneas de código (en el orden CORRECTO)' : 'Opciones de respuesta'}</span>
                {form.opciones.length < 6 && <button type="button" onClick={addOpcion} className="text-xs font-semibold text-prexi-blue-deep hover:underline">+ Agregar {form.tipo === 'ordenar_lineas' ? 'línea' : 'opción'}</button>}
              </div>
              {errores.opciones && <p className="mb-2 text-xs text-prexi-red">{errores.opciones}</p>}
              {errores.respuestaCorrecta && <p className="mb-2 text-xs text-prexi-red">{errores.respuestaCorrecta}</p>}
              <div className="space-y-2">
                {form.opciones.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    {form.tipo === 'ordenar_lineas' ? (
                      <div className="flex shrink-0 flex-col">
                        <button type="button" disabled={i === 0} onClick={() => moverOpcion(i, -1)} className="grid h-4 w-7 place-items-center text-muted disabled:opacity-20 hover:text-prexi-blue-deep"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={i === form.opciones.length - 1} onClick={() => moverOpcion(i, 1)} className="grid h-4 w-7 place-items-center text-muted disabled:opacity-20 hover:text-prexi-blue-deep"><ChevronDown className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-1.5" title="Marcar como correcta">
                        <input type="radio" name="correcta" checked={form.respuestaCorrecta === o.id} onChange={() => setForm({ ...form, respuestaCorrecta: o.id })} className="h-4 w-4 accent-prexi-blue" />
                      </label>
                    )}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subtle text-sm font-bold text-muted">{i + 1}</span>
                    <Input value={o.texto} onChange={(e) => setOpcion(i, e.target.value)} placeholder={form.tipo === 'ordenar_lineas' ? `Línea ${i + 1}` : `Opción ${o.id}`} className={form.tipo === 'ordenar_lineas' ? 'font-mono text-sm' : ''} />
                    {form.opciones.length > 2 && <button type="button" onClick={() => delOpcion(i)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">{form.tipo === 'ordenar_lineas' ? 'Escribe las líneas en el orden correcto: al estudiante se le mostrarán desordenadas.' : 'Marca el círculo de la opción correcta.'}</p>
            </div>
          )}

          <Field label="XP" error={errores.xp}><Input type="number" min={5} max={25} value={form.xp} onChange={(e) => setForm({ ...form, xp: Number(e.target.value) })} /></Field>
          <label className="flex items-center gap-2 self-end pb-2.5">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 accent-prexi-blue" />
            <span className="text-sm font-medium text-fg">Activo (visible para estudiantes)</span>
          </label>
          <div className="sm:col-span-2"><Field label="Explicación para PREXI (opcional)" hint="Respaldo cuando el tutor PREXI da retroalimentación."><Textarea value={form.explicacionIa} onChange={(e) => setForm({ ...form, explicacionIa: e.target.value })} /></Field></div>
        </div>
      </Modal>
    </div>
  );
}
