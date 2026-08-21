'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { PageHeader, Badge, Skeleton, Modal, Field, Input, Select, EmptyState, ResponsiveTable } from '@/components/ui';
import { Plus, Edit, Search, Power, KeyRound, CheckCircle, X } from '@/components/icons';

type Rol = 'estudiante' | 'docente' | 'investigador' | 'admin';
interface Usuario {
  id: number; nombre: string; email: string; cedula: string; rol: Rol;
  carrera: string | null; institucion: string | null; grupo: string; activo: boolean; creadoEn: string;
}
interface FormState { nombre: string; email: string; cedula: string; rol: Rol; password: string; carrera: string; institucion: string }
const VACIO: FormState = { nombre: '', email: '', cedula: '', rol: 'docente', password: '', carrera: '', institucion: '' };
const ROLES: Rol[] = ['estudiante', 'docente', 'investigador', 'admin'];
const ROL_TONE: Record<Rol, 'blue' | 'green' | 'amber' | 'slate'> = { estudiante: 'slate', docente: 'blue', investigador: 'green', admin: 'amber' };

export default function AdminUsuariosPage() {
  const { usuario: yo } = useAuth();
  const [items, setItems] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fRol, setFRol] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [q, setQ] = useState('');

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [apiError, setApiError] = useState('');
  const [temporal, setTemporal] = useState<{ nombre: string; pass: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (fRol) params.set('rol', fRol);
      if (fEstado) params.set('estado', fEstado);
      if (q.trim()) params.set('q', q.trim());
      const r = await api.get<{ usuarios: Usuario[] }>(`/admin/usuarios?${params.toString()}`);
      setItems(r.usuarios);
    } catch { /* noop */ } finally { setCargando(false); }
  }, [fRol, fEstado, q]);

  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

  function abrirCrear() { setEditId(null); setForm(VACIO); setErrores({}); setApiError(''); setModal(true); }
  function abrirEditar(u: Usuario) {
    setEditId(u.id); setErrores({}); setApiError('');
    setForm({ nombre: u.nombre, email: u.email, cedula: u.cedula, rol: u.rol, password: '', carrera: u.carrera ?? '', institucion: u.institucion ?? '' });
    setModal(true);
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (form.nombre.trim().length < 2) e.nombre = 'Nombre inválido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Correo inválido.';
    if (form.cedula.trim().length < 4) e.cedula = 'Cédula inválida.';
    if (!editId && form.password.length < 6) e.password = 'Mínimo 6 caracteres.';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true); setApiError('');
    try {
      if (editId) {
        await api.put(`/admin/usuarios/${editId}`, {
          nombre: form.nombre.trim(), email: form.email.trim(), cedula: form.cedula.trim(),
          rol: form.rol, carrera: form.carrera.trim() || undefined, institucion: form.institucion.trim() || undefined,
        });
      } else {
        await api.post('/admin/usuarios', {
          nombre: form.nombre.trim(), email: form.email.trim(), cedula: form.cedula.trim(), rol: form.rol,
          password: form.password, carrera: form.carrera.trim() || undefined, institucion: form.institucion.trim() || undefined,
        });
      }
      setModal(false); await cargar();
    } catch (err) { setApiError(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  async function alternar(u: Usuario) {
    if (!confirm(`¿${u.activo ? 'Desactivar' : 'Activar'} la cuenta de ${u.nombre}?${u.activo ? ' No podrá iniciar sesión.' : ''}`)) return;
    await api.patch(`/admin/usuarios/${u.id}/estado`).catch((e) => setApiError(e instanceof ApiError ? e.message : ''));
    await cargar();
  }

  async function reset(u: Usuario) {
    if (!confirm(`¿Restablecer la contraseña de ${u.nombre}? Se generará una temporal.`)) return;
    try {
      const r = await api.post<{ temporal: string }>(`/admin/usuarios/${u.id}/reset-password`);
      setTemporal({ nombre: u.nombre, pass: r.temporal });
    } catch (e) { alert(e instanceof ApiError ? e.message : 'No se pudo restablecer'); }
  }

  const fecha = (f: string) => new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="animate-fade-up">
      <PageHeader title="Gestión de usuarios" subtitle="Crea y administra cuentas de todos los roles. El registro público es solo para estudiantes."
        action={<button onClick={abrirCrear} className="btn-primary"><Plus className="h-4 w-4" /> Nuevo usuario</button>} />

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo…" className="input !pl-10" />
        </div>
        <Select value={fRol} onChange={(e) => setFRol(e.target.value)} className="!w-auto"><option value="">Todos los roles</option>{ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}</Select>
        <Select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="!w-auto"><option value="">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></Select>
      </div>

      {apiError && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{apiError}</p>}

      {cargando ? <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        : items.length === 0 ? <EmptyState icon={<Search className="h-7 w-7" />} title="Sin usuarios" hint="Ajusta los filtros o crea un nuevo usuario." />
          : (
            <ResponsiveTable
              rows={items}
              rowKey={(u) => u.id}
              cols={[
                { header: 'Usuario', cell: (u) => <div className={u.activo ? '' : 'opacity-60'}><p className="font-medium text-fg">{u.nombre}</p><p className="text-xs text-muted">{u.email}</p></div> },
                { header: 'Rol', cell: (u) => <Badge tone={ROL_TONE[u.rol]}>{u.rol}</Badge> },
                { header: 'Institución', cell: (u) => <span className="text-muted">{u.institucion ?? '—'}</span> },
                { header: 'Estado', cell: (u) => u.activo ? <Badge tone="green"><CheckCircle className="h-3 w-3" /> Activo</Badge> : <Badge tone="red"><X className="h-3 w-3" /> Inactivo</Badge> },
                { header: 'Alta', cell: (u) => <span className="text-muted">{fecha(u.creadoEn)}</span> },
                { header: 'Acciones', align: 'right', cardHidden: true, cell: (u) => <AccionesUsuario u={u} deshabilitado={u.id === yo?.id} onEditar={abrirEditar} onReset={reset} onAlternar={alternar} /> },
              ]}
              card={(u) => (
                <div className={`space-y-3 ${u.activo ? '' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="font-medium text-fg">{u.nombre}</p><p className="truncate text-xs text-muted">{u.email}</p></div>
                    <Badge tone={ROL_TONE[u.rol]}>{u.rol}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {u.activo ? <Badge tone="green"><CheckCircle className="h-3 w-3" /> Activo</Badge> : <Badge tone="red"><X className="h-3 w-3" /> Inactivo</Badge>}
                    <span>{u.institucion ?? 'Sin institución'}</span>
                    <span>· Alta: {fecha(u.creadoEn)}</span>
                  </div>
                  <AccionesUsuario u={u} deshabilitado={u.id === yo?.id} onEditar={abrirEditar} onReset={reset} onAlternar={alternar} grandes />
                </div>
              )}
            />
          )}

      {/* Modal crear/editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar usuario' : 'Nuevo usuario'}
        footer={<>
          <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Guardar'}</button>
        </>}>
        {apiError && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{apiError}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Nombre completo" error={errores.nombre}><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field></div>
          <Field label="Correo" error={errores.email}><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Cédula" error={errores.cedula}><Input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} /></Field>
          <Field label="Rol"><Select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}>{ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}</Select></Field>
          {!editId && <Field label="Contraseña inicial" error={errores.password}><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mín. 6 caracteres" /></Field>}
          <Field label="Carrera (opcional)"><Input value={form.carrera} onChange={(e) => setForm({ ...form, carrera: e.target.value })} /></Field>
          <Field label="Institución (opcional)"><Input value={form.institucion} onChange={(e) => setForm({ ...form, institucion: e.target.value })} placeholder="UPEA, EMI…" /></Field>
        </div>
      </Modal>

      {/* Contraseña temporal generada */}
      <Modal open={!!temporal} onClose={() => setTemporal(null)} title="Contraseña temporal generada"
        footer={<button onClick={() => setTemporal(null)} className="btn-primary">Entendido</button>}>
        {temporal && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Comparte esta contraseña con <b className="text-fg">{temporal.nombre}</b>. Se le pedirá cambiarla en su próximo ingreso. No se volverá a mostrar.</p>
            <div className="flex items-center justify-between rounded-xl border border-line bg-subtle px-4 py-3">
              <code className="font-mono text-lg font-bold text-fg">{temporal.pass}</code>
              <button onClick={() => navigator.clipboard?.writeText(temporal.pass)} className="text-xs font-semibold text-prexi-blue-deep hover:underline">Copiar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Botonera de acciones de un usuario. `grandes` = áreas táctiles ≥44px (móvil). */
function AccionesUsuario({ u, deshabilitado, onEditar, onReset, onAlternar, grandes = false }: {
  u: Usuario; deshabilitado: boolean;
  onEditar: (u: Usuario) => void; onReset: (u: Usuario) => void; onAlternar: (u: Usuario) => void;
  grandes?: boolean;
}) {
  const s = grandes ? 'h-10 w-10' : 'h-8 w-8';
  return (
    <div className={`flex items-center gap-1.5 ${grandes ? '' : 'justify-end'}`}>
      <button onClick={() => onEditar(u)} title="Editar" aria-label={`Editar a ${u.nombre}`} className={`grid ${s} place-items-center rounded-lg border border-line text-muted transition hover:bg-subtle hover:text-prexi-blue-deep`}><Edit className="h-4 w-4" /></button>
      <button onClick={() => onReset(u)} title="Restablecer contraseña" aria-label={`Restablecer contraseña de ${u.nombre}`} className={`grid ${s} place-items-center rounded-lg border border-line text-muted transition hover:bg-subtle hover:text-prexi-amber`}><KeyRound className="h-4 w-4" /></button>
      <button onClick={() => onAlternar(u)} disabled={deshabilitado} title={deshabilitado ? 'No puedes desactivarte' : (u.activo ? 'Desactivar' : 'Activar')} aria-label={`${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}`} className={`grid ${s} place-items-center rounded-lg border border-line text-muted transition hover:bg-subtle enabled:hover:text-prexi-red disabled:opacity-40`}><Power className="h-4 w-4" /></button>
    </div>
  );
}
