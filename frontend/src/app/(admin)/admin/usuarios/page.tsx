'use client';

/**
 * USUARIOS (administrador). Pestañas por rol con su cantidad, filtros de estado
 * y una búsqueda que entiende nombre, correo, CI, RU o el usuario de un
 * estudiante (Alvaro_12929098). Crear una cuenta es un asistente de dos pasos:
 * primero el rol (con lo que puede hacer cada uno) y luego sus datos.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { usuarioDeAcceso } from '@/lib/usuario-acceso';
import { Recuperaciones } from '@/components/recuperaciones';
import { PageHeader, Badge, Skeleton, Modal, Field, Input, EmptyState, ResponsiveTable } from '@/components/ui';
import {
  Plus, Edit, Search, Power, KeyRound, CheckCircle, X, GraduationCap, BookOpen, FlaskConical, ShieldCheck, Lock, ArrowRight, ChevronLeft,
} from '@/components/icons';

type Rol = 'estudiante' | 'docente' | 'investigador' | 'admin';
interface Usuario {
  id: number; nombre: string; apellidoPaterno: string | null; apellidoMaterno: string | null; nombres: string | null; usuario: string | null;
  email: string | null; cedula: string | null; ru: string | null; rol: Rol;
  carrera: string | null; institucion: string | null; activo: boolean; creadoEn: string; mustChangePassword: boolean;
  bloqueado: boolean; estadoInscripcion: 'aprobada' | 'pendiente' | 'rechazada'; curso: string | null; paralelos_a_cargo: number;
}
interface FormState { apellidoPaterno: string; apellidoMaterno: string; nombres: string; cedula: string; rol: Rol; password: string; carrera: string; institucion: string }
const VACIO: FormState = { apellidoPaterno: '', apellidoMaterno: '', nombres: '', cedula: '', rol: 'docente', password: '', carrera: '', institucion: '' };

const ROLES: { id: Rol; nombre: string; plural: string; color: string; icon: typeof BookOpen; resumen: string; puede: string[] }[] = [
  { id: 'docente', nombre: 'Docente', plural: 'Docentes', color: '#10B981', icon: BookOpen, resumen: 'Dicta un curso y sigue a sus estudiantes.',
    puede: ['Registra estudiantes y acepta solicitudes', 'Arma unidades, ejercicios, retos y exámenes', 'Ve el avance de su curso'] },
  { id: 'investigador', nombre: 'Investigador', plural: 'Investigadores', color: '#8B5CF6', icon: FlaskConical, resumen: 'Analiza los datos del estudio.',
    puede: ['Ve resultados e instrumentos', 'Exporta los datos anónimos', 'No modifica cuentas ni contenido'] },
  { id: 'admin', nombre: 'Administrador', plural: 'Administradores', color: '#F59E0B', icon: ShieldCheck, resumen: 'Gestiona todo el sistema.',
    puede: ['Crea cuentas y asigna roles', 'Asigna docentes a los paralelos', 'Configura el sistema y revisa la auditoría'] },
  { id: 'estudiante', nombre: 'Estudiante', plural: 'Estudiantes', color: '#3B82F6', icon: GraduationCap, resumen: 'Aprende y practica en PREXI.',
    puede: ['Lo habitual es que lo registre su docente', 'O que se registre solo y su docente lo acepte'] },
];
const rolDe = (id: Rol) => ROLES.find((r) => r.id === id)!;
const ESTADOS = [
  { id: '', nombre: 'Todos' }, { id: 'activo', nombre: 'Activos' }, { id: 'inactivo', nombre: 'Desactivados' },
  { id: 'bloqueado', nombre: 'Bloqueados' }, { id: 'temporal', nombre: 'Contraseña inicial' },
];

/** Contraseña inicial legible: 4 letras + 4 números + un signo (ej. Prex7316#). */
function generarClave() {
  const l = 'abcdefghijkmnpqrstuvwxyz', n = '23456789';
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const letras = Array.from({ length: 4 }, () => pick(l)).join('');
  return letras.charAt(0).toUpperCase() + letras.slice(1) + Array.from({ length: 4 }, () => pick(n)).join('') + pick('#$%&*');
}

export default function AdminUsuariosPage() {
  const { usuario: yo } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const fRol = (params.get('rol') ?? '') as Rol | '';
  const fEstado = params.get('estado') ?? '';
  const [items, setItems] = useState<Usuario[]>([]);
  const [conteos, setConteos] = useState<Record<Rol, number> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');

  const [modal, setModal] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [apiError, setApiError] = useState('');
  const [aviso, setAviso] = useState('');
  const [temporal, setTemporal] = useState<{ nombre: string; usuario: string; pass: string; titulo: string } | null>(null);

  const filtrar = (cambios: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) { if (v) p.set(k, v); else p.delete(k); }
    router.replace(`/admin/usuarios${p.toString() ? `?${p}` : ''}`, { scroll: false });
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const p = new URLSearchParams();
      if (fRol) p.set('rol', fRol);
      if (fEstado) p.set('estado', fEstado);
      if (q.trim()) p.set('q', q.trim());
      const r = await api.get<{ usuarios: Usuario[]; conteos: Record<Rol, number> }>(`/admin/usuarios?${p.toString()}`);
      setItems(r.usuarios); setConteos(r.conteos);
    } catch { /* se queda con lo que había */ } finally { setCargando(false); }
  }, [fRol, fEstado, q]);
  useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

  // ?nuevo=1 (desde el panel) abre directamente el asistente.
  useEffect(() => {
    if (params.get('nuevo') === '1') { abrirCrear(); filtrar({ nuevo: '' }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function abrirCrear() { setEditId(null); setForm({ ...VACIO, password: generarClave() }); setErrores({}); setApiError(''); setPaso(1); setModal(true); }
  function abrirEditar(u: Usuario) {
    setEditId(u.id); setErrores({}); setApiError(''); setPaso(2);
    // Cuentas antiguas sin apellidos separados: el nombre completo queda en «Nombres» para corregirlo.
    setForm({ apellidoPaterno: u.apellidoPaterno ?? '', apellidoMaterno: u.apellidoMaterno ?? '', nombres: u.nombres ?? (u.apellidoPaterno ? '' : u.nombre), cedula: u.cedula ?? '', rol: u.rol, password: '', carrera: u.carrera ?? '', institucion: u.institucion ?? '' });
    setModal(true);
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (form.apellidoPaterno.trim().length < 2) e.apellidoPaterno = 'Escribe el apellido paterno.';
    if (form.nombres.trim().length < 2) e.nombres = 'Escribe los nombres.';
    if (!/^\d{5,10}$/.test(form.cedula.trim())) e.cedula = 'Solo los números del CI (5 a 10 dígitos).';
    if (!editId && form.password.length < 6) e.password = 'Mínimo 6 caracteres.';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true); setApiError('');
    const datos = {
      apellidoPaterno: form.apellidoPaterno.trim(), apellidoMaterno: form.apellidoMaterno.trim(), nombres: form.nombres.trim(), cedula: form.cedula.trim(), rol: form.rol,
      carrera: form.carrera.trim() || undefined, institucion: form.institucion.trim() || undefined,
    };
    try {
      if (editId) {
        await api.put(`/admin/usuarios/${editId}`, datos);
        setAviso(`Se guardaron los cambios de ${datos.nombres} ${datos.apellidoPaterno}.`);
      } else {
        const r = await api.post<{ usuario: string }>('/admin/usuarios', { ...datos, password: form.password });
        setTemporal({ titulo: 'Cuenta creada', nombre: `${datos.nombres} ${datos.apellidoPaterno}`, usuario: r.usuario, pass: form.password });
      }
      setModal(false); await cargar();
    } catch (err) { setApiError(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  async function alternar(u: Usuario) {
    if (!confirm(u.activo
      ? `¿Desactivar la cuenta de ${u.nombre}? No podrá iniciar sesión, pero se conserva todo su historial.`
      : `¿Volver a activar la cuenta de ${u.nombre}?`)) return;
    try { await api.patch(`/admin/usuarios/${u.id}/estado`); setAviso(`${u.nombre}: cuenta ${u.activo ? 'desactivada' : 'activada'}.`); }
    catch (e) { setAviso(e instanceof ApiError ? e.message : 'No se pudo cambiar el estado.'); }
    await cargar();
  }

  async function reset(u: Usuario) {
    if (!confirm(`¿Restablecer la contraseña de ${u.nombre}? Se genera una temporal, se desbloquea la cuenta y deberá cambiarla al entrar.`)) return;
    try {
      const r = await api.post<{ temporal: string }>(`/admin/usuarios/${u.id}/reset-password`);
      setTemporal({ titulo: 'Contraseña restablecida', nombre: u.nombre, usuario: u.usuario ?? '', pass: r.temporal });
      await cargar();
    } catch (e) { setAviso(e instanceof ApiError ? e.message : 'No se pudo restablecer.'); }
  }

  const total = conteos ? Object.values(conteos).reduce((a, b) => a + b, 0) : 0;
  const fecha = (f: string) => new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
  const rolElegido = useMemo(() => rolDe(form.rol), [form.rol]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Usuarios" subtitle="Todas las cuentas del sistema. Todos entran con su usuario (primer nombre y CI). Crea docentes, investigadores y administradores; los estudiantes los registra su docente."
        action={<button onClick={abrirCrear} className="btn-primary"><Plus className="h-4 w-4" /> Nuevo usuario</button>} />

      {/* Contraseñas olvidadas: el admin aprueba las de docentes y las de estudiantes sin docente (o cualquiera). */}
      <Recuperaciones ocultarVacio />

      {/* Pestañas por rol */}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Rol">
        {[{ id: '' as const, plural: 'Todos', color: '#64748B' }, ...ROLES].map((r) => {
          const sel = fRol === r.id;
          const n = r.id ? conteos?.[r.id] ?? 0 : total;
          return (
            <button key={r.id || 'todos'} role="tab" aria-selected={sel} onClick={() => filtrar({ rol: r.id })}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition ${sel ? 'border-prexi-blue bg-prexi-blue/10 font-bold text-prexi-blue-deep' : 'border-line bg-card text-fg hover:bg-subtle'}`}>
              {r.id && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color }} />}
              {r.plural} <span className="rounded-md bg-subtle px-1.5 py-0.5 text-2xs font-bold text-muted">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Búsqueda y estado */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre, usuario (Alvaro_12929098), CI o RU" className="input !pl-10" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map((e) => (
            <button key={e.id || 'todos'} onClick={() => filtrar({ estado: e.id })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${fEstado === e.id ? 'bg-fg text-card' : 'bg-subtle text-muted hover:text-fg'}`}>{e.nombre}</button>
          ))}
        </div>
      </div>

      {aviso && (
        <p className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-prexi-blue/30 bg-prexi-blue/10 px-3 py-2 text-sm text-fg">
          <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-prexi-blue-deep" /> {aviso}</span>
          <button onClick={() => setAviso('')} aria-label="Cerrar aviso" className="text-muted hover:text-fg"><X className="h-4 w-4" /></button>
        </p>
      )}
      {fRol === 'estudiante' && (
        <p className="mb-4 rounded-xl bg-subtle px-3 py-2.5 text-sm text-muted">
          Los estudiantes los registra su docente desde <Link href="/docente/estudiantes/registro" className="font-semibold text-prexi-blue-deep hover:underline">Registro de estudiantes</Link>, o se registran solos y el docente los acepta.
        </p>
      )}

      {cargando ? <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        : items.length === 0 ? <EmptyState icon={<Search className="h-7 w-7" />} title="No hay cuentas con esos filtros" hint="Prueba con otra búsqueda o vuelve a «Todos»." />
          : (
            <ResponsiveTable
              rows={items}
              rowKey={(u) => u.id}
              cols={[
                { header: 'Persona', cell: (u) => <Persona u={u} /> },
                { header: 'Rol', cell: (u) => <RolChip rol={u.rol} /> },
                { header: 'Detalle', cell: (u) => <span className="text-sm text-muted">{detalle(u)}</span> },
                { header: 'Estado', cell: (u) => <Estados u={u} /> },
                { header: 'Alta', cell: (u) => <span className="text-sm text-muted">{fecha(u.creadoEn)}</span> },
                { header: 'Acciones', align: 'right', cardHidden: true, cell: (u) => <AccionesUsuario u={u} soyYo={u.id === yo?.id} onEditar={abrirEditar} onReset={reset} onAlternar={alternar} /> },
              ]}
              card={(u) => (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3"><Persona u={u} /><RolChip rol={u.rol} /></div>
                  <p className="text-sm text-muted">{detalle(u)} · Alta {fecha(u.creadoEn)}</p>
                  <Estados u={u} />
                  <AccionesUsuario u={u} soyYo={u.id === yo?.id} onEditar={abrirEditar} onReset={reset} onAlternar={alternar} grandes />
                </div>
              )}
            />
          )}

      {/* Asistente crear / editar */}
      <Modal open={modal} onClose={() => setModal(false)} size="lg"
        title={editId ? 'Editar cuenta' : paso === 1 ? 'Nueva cuenta · 1 de 2: ¿qué rol tendrá?' : `Nueva cuenta · 2 de 2: datos del ${rolElegido.nombre.toLowerCase()}`}
        footer={editId || paso === 2 ? <>
          {!editId && <button onClick={() => setPaso(1)} className="btn-ghost mr-auto"><ChevronLeft className="h-4 w-4" /> Cambiar rol</button>}
          <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn-primary">{guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear cuenta'}</button>
        </> : <button onClick={() => setModal(false)} className="btn-ghost">Cancelar</button>}>
        {paso === 1 && !editId ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLES.map((r) => (
              <button key={r.id} onClick={() => { setForm((f) => ({ ...f, rol: r.id })); setPaso(2); }}
                className="group rounded-2xl border-2 border-line p-4 text-left transition hover:-translate-y-0.5" style={{ borderColor: form.rol === r.id ? r.color : undefined }}>
                <span className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ color: r.color, backgroundColor: `${r.color}1F` }}><r.icon className="h-5 w-5" /></span>
                  <span><span className="block font-display text-lg font-bold text-fg">{r.nombre}</span><span className="block text-sm text-muted">{r.resumen}</span></span>
                </span>
                <ul className="mt-3 space-y-1 text-sm text-muted">
                  {r.puede.map((p) => <li key={p} className="flex items-start gap-1.5"><CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: r.color }} /> {p}</li>)}
                </ul>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-prexi-blue-deep">Elegir <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {apiError && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{apiError}</p>}
            {form.rol === 'estudiante' && !editId && (
              <p className="rounded-xl border border-prexi-amber/40 bg-prexi-amber/10 px-3 py-2.5 text-sm text-fg">
                Para un curso completo es mejor que el docente use <b>Registro de estudiantes</b> (sube su lista de una vez). El usuario es el mismo: primer nombre y CI.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Apellido paterno" error={errores.apellidoPaterno}><Input value={form.apellidoPaterno} onChange={(e) => setForm({ ...form, apellidoPaterno: e.target.value })} placeholder="Ej.: Quispe" autoFocus /></Field>
              <Field label="Apellido materno (opcional)"><Input value={form.apellidoMaterno} onChange={(e) => setForm({ ...form, apellidoMaterno: e.target.value })} placeholder="Ej.: Mamani" /></Field>
              <Field label="Nombres" error={errores.nombres}><Input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} placeholder="Ej.: María José" /></Field>
              <Field label="Cédula (CI)" hint="Solo números. Es su contraseña de respaldo si la olvida." error={errores.cedula}><Input value={form.cedula} inputMode="numeric" onChange={(e) => setForm({ ...form, cedula: e.target.value.replace(/\D/g, '') })} placeholder="Ej.: 9876543" /></Field>
              {/* Usuario con el que entrará: primer nombre + "_" + CI */}
              <div className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-prexi-blue/30 bg-prexi-blue/5 px-3 py-2.5 text-sm">
                <KeyRound className="h-4 w-4 shrink-0 text-prexi-blue-deep" />
                <span className="text-muted">Entrará con el usuario</span>
                <b className="font-mono text-fg">{usuarioDeAcceso({ nombres: form.nombres, cedula: form.cedula }) || 'PrimerNombre_CI'}</b>
              </div>
              {editId && (
                <Field label="Rol" hint={editId === yo?.id ? 'No puedes quitarte el rol de administrador.' : 'Cambiar el rol queda en la auditoría.'}>
                  <select value={form.rol} disabled={editId === yo?.id} onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })} className="input">
                    {ROLES.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Institución (opcional)"><Input value={form.institucion} onChange={(e) => setForm({ ...form, institucion: e.target.value })} placeholder="UPEA" /></Field>
              {form.rol === 'estudiante' && <Field label="Carrera (opcional)"><Input value={form.carrera} onChange={(e) => setForm({ ...form, carrera: e.target.value })} placeholder="Ingeniería de Sistemas" /></Field>}
            </div>
            {!editId && (
              <div className="rounded-2xl border border-line bg-subtle/60 p-4">
                <Field label="Contraseña inicial" hint="Compártela con la persona: deberá cambiarla en su primer ingreso." error={errores.password}>
                  <div className="flex gap-2">
                    <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="font-mono" />
                    <button type="button" onClick={() => setForm({ ...form, password: generarClave() })} className="btn-ghost shrink-0 text-sm"><KeyRound className="h-4 w-4" /> Generar otra</button>
                  </div>
                </Field>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Datos de acceso (cuenta nueva o contraseña restablecida) */}
      <Modal open={!!temporal} onClose={() => setTemporal(null)} title={temporal?.titulo ?? ''}
        footer={<button onClick={() => setTemporal(null)} className="btn-primary">Listo</button>}>
        {temporal && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Entrégale estos datos a <b className="text-fg">{temporal.nombre}</b>. La contraseña no se volverá a mostrar y deberá cambiarla al entrar.</p>
            <DatoCopiable etiqueta="Usuario" valor={temporal.usuario} />
            <DatoCopiable etiqueta="Contraseña inicial" valor={temporal.pass} />
          </div>
        )}
      </Modal>
    </div>
  );
}

function detalle(u: Usuario): string {
  if (u.rol === 'estudiante') return u.curso ?? 'Sin curso asignado';
  if (u.rol === 'docente') return u.paralelos_a_cargo ? `${u.paralelos_a_cargo} paralelo(s) a cargo` : 'Sin paralelos asignados';
  return u.institucion ?? '—';
}

function Persona({ u }: { u: Usuario }) {
  const acceso = u.usuario ?? usuarioDeAcceso(u);
  return (
    <div className={`min-w-0 ${u.activo ? '' : 'opacity-60'}`}>
      <p className="font-medium text-fg">{u.nombre}</p>
      <p className="truncate text-xs text-muted">
        {acceso ? <span className="font-mono">{acceso}</span> : '—'}
        {u.cedula ? ` · CI ${u.cedula}` : ''}{u.ru ? ` · RU ${u.ru}` : ''}
      </p>
    </div>
  );
}

function RolChip({ rol }: { rol: Rol }) {
  const r = rolDe(rol);
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: r.color, backgroundColor: `${r.color}1F` }}><r.icon className="h-3.5 w-3.5" /> {r.nombre}</span>;
}

function Estados({ u }: { u: Usuario }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {u.activo ? <Badge tone="green"><CheckCircle className="h-3 w-3" /> Activa</Badge> : <Badge tone="red"><X className="h-3 w-3" /> Desactivada</Badge>}
      {u.bloqueado && <Badge tone="red"><Lock className="h-3 w-3" /> Bloqueada</Badge>}
      {u.mustChangePassword && <Badge tone="amber"><KeyRound className="h-3 w-3" /> Contraseña inicial</Badge>}
      {u.rol === 'estudiante' && u.estadoInscripcion === 'pendiente' && <Badge tone="blue">Solicitud pendiente</Badge>}
    </div>
  );
}

function DatoCopiable({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-subtle px-4 py-3">
      <span className="min-w-0"><span className="block text-xs text-muted">{etiqueta}</span><code className="block truncate font-mono text-lg font-bold text-fg">{valor || '—'}</code></span>
      <button onClick={() => { navigator.clipboard?.writeText(valor); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
        className="shrink-0 text-xs font-semibold text-prexi-blue-deep hover:underline">{copiado ? '¡Copiado!' : 'Copiar'}</button>
    </div>
  );
}

/** Acciones con texto (no solo íconos). `grandes` = áreas táctiles ≥44px (móvil). */
function AccionesUsuario({ u, soyYo, onEditar, onReset, onAlternar, grandes = false }: {
  u: Usuario; soyYo: boolean;
  onEditar: (u: Usuario) => void; onReset: (u: Usuario) => void; onAlternar: (u: Usuario) => void;
  grandes?: boolean;
}) {
  const t = grandes ? '!px-3 !py-2 text-sm' : '!px-2.5 !py-1 text-xs';
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${grandes ? '' : 'justify-end'}`}>
      <button onClick={() => onEditar(u)} className={`btn-ghost ${t}`}><Edit className="h-3.5 w-3.5" /> Editar</button>
      <button onClick={() => onReset(u)} className={`btn-ghost ${t}`} title="Genera una contraseña temporal y desbloquea la cuenta"><KeyRound className="h-3.5 w-3.5" /> Contraseña</button>
      <button onClick={() => onAlternar(u)} disabled={soyYo} title={soyYo ? 'No puedes desactivar tu propia cuenta' : undefined}
        className={`btn-ghost ${t} disabled:opacity-40 ${u.activo ? 'hover:!text-prexi-red' : 'hover:!text-prexi-green'}`}>
        <Power className="h-3.5 w-3.5" /> {u.activo ? 'Desactivar' : 'Activar'}
      </button>
    </div>
  );
}
