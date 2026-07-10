'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DocenteReto } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton, Modal, Field, Input, Textarea, Select, EmptyState } from '@/components/ui';
import { Plus, Edit, Trash2, Power, Target, ClipboardList, Clock } from '@/components/icons';

interface FormState {
  titulo: string; categoria: string; nivel: string; estrellas: number; enunciado: string;
  codigoInicial: string; ejemploEntrada: string; ejemploSalida: string; xp: number; fechaLimite: string; activo: boolean;
}
const VACIO: FormState = {
  titulo: '', categoria: '', nivel: '', estrellas: 3, enunciado: '',
  codigoInicial: '', ejemploEntrada: '', ejemploSalida: '', xp: 60, fechaLimite: '', activo: true,
};

export default function DocenteRetosPage() {
  const [items, setItems] = useState<DocenteReto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [apiError, setApiError] = useState('');

  async function cargar() {
    setCargando(true);
    try { const r = await api.get<{ retos: DocenteReto[] }>('/docente/retos'); setItems(r.retos); }
    catch { /* noop */ } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);

  function abrirCrear() { setEditId(null); setForm(VACIO); setErrores({}); setApiError(''); setModal(true); }
  function abrirEditar(r: DocenteReto) {
    setEditId(r.id); setErrores({}); setApiError('');
    setForm({
      titulo: r.titulo, categoria: r.categoria, nivel: r.nivel ? String(r.nivel) : '', estrellas: r.estrellas,
      enunciado: r.enunciado, codigoInicial: r.codigoInicial ?? '', ejemploEntrada: r.ejemploEntrada ?? '',
      ejemploSalida: r.ejemploSalida ?? '', xp: r.xp, fechaLimite: r.fechaLimite ? r.fechaLimite.slice(0, 10) : '', activo: r.activo,
    });
    setModal(true);
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (form.titulo.trim().length < 3) e.titulo = 'Mínimo 3 caracteres.';
    if (form.categoria.trim().length < 2) e.categoria = 'Indica una categoría.';
    if (form.enunciado.trim().length < 3) e.enunciado = 'Escribe el enunciado.';
    if (form.xp < 5 || form.xp > 500) e.xp = 'XP entre 5 y 500.';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true); setApiError('');
    const payload = {
      titulo: form.titulo.trim(), categoria: form.categoria.trim(),
      nivel: form.nivel ? Number(form.nivel) : undefined, estrellas: form.estrellas,
      enunciado: form.enunciado.trim(), codigoInicial: form.codigoInicial.trim() || undefined,
      ejemploEntrada: form.ejemploEntrada.trim() || undefined, ejemploSalida: form.ejemploSalida.trim() || undefined,
      xp: form.xp, fechaLimite: form.fechaLimite ? new Date(form.fechaLimite + 'T23:59:59').toISOString() : undefined,
      activo: form.activo,
    };
    try {
      if (editId) await api.put(`/docente/retos/${editId}`, payload);
      else await api.post('/docente/retos', payload);
      setModal(false); await cargar();
    } catch (err) { setApiError(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  async function alternar(r: DocenteReto) { await api.patch(`/docente/retos/${r.id}/activo`).catch(() => undefined); await cargar(); }
  async function eliminar(r: DocenteReto) {
    if (!confirm(`¿Eliminar el reto "${r.titulo}"?`)) return;
    await api.del(`/docente/retos/${r.id}`).catch(() => undefined); await cargar();
  }

  const fecha = (f: string) => new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="animate-fade-up">
      <PageHeader title="Gestión de retos" subtitle="Retos extra que el estudiante resuelve en la Zona de Práctica. Las entregas se califican en Revisiones."
        action={<button onClick={abrirCrear} className="btn-primary"><Plus className="h-4 w-4" /> Nuevo reto</button>} />

      {cargando ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
        : items.length === 0 ? <EmptyState icon={<Target className="h-7 w-7" />} title="Aún no hay retos" hint="Crea un reto para que aparezca en la Zona de Práctica del estudiante." />
          : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {items.map((r) => (
                <Card key={r.id} className="flex flex-col">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-prexi-blue/10 text-prexi-blue-deep"><Target className="h-5 w-5" /></div>
                    <div className="flex flex-col items-end gap-1">
                      {r.activo ? <Badge tone="green">Publicado</Badge> : <Badge tone="slate">Borrador</Badge>}
                      {r.pendientes > 0 && <Badge tone="amber"><ClipboardList className="h-3 w-3" /> {r.pendientes} por revisar</Badge>}
                    </div>
                  </div>
                  <p className="font-display font-bold text-fg">{r.titulo}</p>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-prexi-blue-deep">
                    {r.categoria}{r.nivel ? ` · Nivel ${r.nivel}` : ''} · {'★'.repeat(r.estrellas)}
                  </p>
                  <p className="mb-3 line-clamp-2 flex-1 text-sm text-muted">{r.enunciado}</p>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted">
                    <span>{r.xp} XP · {r.resueltos} aprobados</span>
                    <span>{fecha(r.creadoEn)}</span>
                  </div>
                  {r.fechaLimite && <p className="mb-3 flex items-center gap-1 text-xs text-prexi-amber"><Clock className="h-3 w-3" /> Límite: {fecha(r.fechaLimite)}</p>}
                  <div className="mt-auto flex gap-2 border-t border-line pt-3">
                    <button onClick={() => alternar(r)} className="btn-ghost flex-1 !py-2 text-sm"><Power className="h-4 w-4" /> {r.activo ? 'Despublicar' : 'Publicar'}</button>
                    <button onClick={() => abrirEditar(r)} className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:bg-subtle hover:text-prexi-blue-deep"><Edit className="h-4 w-4" /></button>
                    <button onClick={() => eliminar(r)} className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted transition hover:bg-subtle hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Card>
              ))}
            </div>
          )}

      <Modal open={modal} onClose={() => setModal(false)} size="lg" title={editId ? 'Editar reto' : 'Nuevo reto'}
        footer={<>
          <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Guardar'}</button>
        </>}>
        {apiError && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{apiError}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Título" error={errores.titulo}><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej: FizzBuzz" /></Field></div>
          <Field label="Categoría" error={errores.categoria}><Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Bucles, Cadenas…" /></Field>
          <Field label="Nivel asociado (opcional)"><Select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value })}><option value="">Sin nivel</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Nivel {n}</option>)}</Select></Field>
          <Field label="Dificultad (estrellas)"><Select value={form.estrellas} onChange={(e) => setForm({ ...form, estrellas: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}</Select></Field>
          <Field label="XP máximo" error={errores.xp}><Input type="number" min={5} max={500} value={form.xp} onChange={(e) => setForm({ ...form, xp: Number(e.target.value) })} /></Field>
          <div className="sm:col-span-2"><Field label="Enunciado / descripción del problema" error={errores.enunciado}><Textarea value={form.enunciado} onChange={(e) => setForm({ ...form, enunciado: e.target.value })} placeholder="Describe el reto de programación." /></Field></div>
          <Field label="Ejemplo de entrada (opcional)"><Textarea value={form.ejemploEntrada} onChange={(e) => setForm({ ...form, ejemploEntrada: e.target.value })} className="font-mono text-sm" placeholder="n = 5" /></Field>
          <Field label="Salida esperada (opcional)"><Textarea value={form.ejemploSalida} onChange={(e) => setForm({ ...form, ejemploSalida: e.target.value })} className="font-mono text-sm" placeholder="15" /></Field>
          <div className="sm:col-span-2"><Field label="Código base (opcional)" hint="Se precarga en el editor del estudiante."><Textarea value={form.codigoInicial} onChange={(e) => setForm({ ...form, codigoInicial: e.target.value })} className="font-mono text-sm" placeholder={'def solucion():\n    pass'} /></Field></div>
          <Field label="Fecha límite (opcional)"><Input type="date" value={form.fechaLimite} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} /></Field>
          <label className="flex items-center gap-2 self-end pb-2.5">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 accent-prexi-blue" />
            <span className="text-sm font-medium text-fg">Publicado (visible para estudiantes)</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
