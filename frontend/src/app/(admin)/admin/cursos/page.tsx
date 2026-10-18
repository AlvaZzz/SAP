'use client';

/**
 * CURSOS Y DOCENTES (administrador). Cada materia con sus paralelos: quién lo
 * dicta, cuántos estudiantes tiene y cuántas solicitudes esperan. Lo principal
 * es que ningún paralelo quede sin docente (nadie aceptaría a sus estudiantes).
 * También se crean materias y paralelos.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { PageHeader, Card, Badge, Skeleton, Modal, Field, Input, EmptyState, StatGrid, StatCard } from '@/components/ui';
import { Plus, GraduationCap, Users, AlertTriangle, CheckCircle, BookOpen, Clock, X } from '@/components/icons';

interface Docente { id: number; nombre: string; email: string | null; rol: string; activo: boolean; paralelos: number }
interface Paralelo { id: number; nombre: string; docente: { id: number; nombre: string; email: string | null; activo: boolean } | null; estudiantes: number; solicitudes: number }
interface Materia { id: number; nombre: string; sigla: string | null; gestion: string; paralelos: Paralelo[] }
interface Respuesta { materias: Materia[]; docentes: Docente[]; resumen: { materias: number; paralelos: number; sin_docente: number; estudiantes: number; solicitudes: number } }

export default function AdminCursosPage() {
  const [d, setD] = useState<Respuesta | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [modalMateria, setModalMateria] = useState(false);
  const [modalParalelo, setModalParalelo] = useState<Materia | null>(null);

  const cargar = useCallback(async () => {
    const r = await api.get<Respuesta>('/admin/cursos').catch(() => null);
    if (r) setD(r);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const docentesActivos = useMemo(() => (d?.docentes ?? []).filter((x) => x.activo), [d]);

  async function asignar(p: Paralelo, valor: string) {
    const docenteId = valor ? Number(valor) : null;
    if (docenteId === (p.docente?.id ?? null)) return;
    if (docenteId === null && !confirm(`¿Dejar el paralelo ${p.nombre} sin docente? Sus solicitudes quedarán sin quien las acepte.`)) return;
    setGuardando(p.id); setAviso(null);
    try {
      await api.put(`/admin/cursos/paralelos/${p.id}/docente`, { docenteId });
      const nombre = d?.docentes.find((x) => x.id === docenteId)?.nombre;
      setAviso({ ok: true, texto: nombre ? `Paralelo ${p.nombre}: ahora lo dicta ${nombre}.` : `Paralelo ${p.nombre} quedó sin docente.` });
      await cargar();
    } catch (e) { setAviso({ ok: false, texto: e instanceof ApiError ? e.message : 'No se pudo asignar.' }); }
    finally { setGuardando(null); }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Cursos y docentes" subtitle="Cada paralelo necesita un docente: es quien acepta a sus estudiantes y sigue su avance."
        action={<button onClick={() => setModalMateria(true)} className="btn-primary"><Plus className="h-4 w-4" /> Nueva materia</button>} />

      <StatGrid className="mb-5">
        {!d ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <StatCard icon={<BookOpen className="h-7 w-7" />} accent="blue" label="Materias" value={d.resumen.materias} />
            <StatCard icon={<GraduationCap className="h-7 w-7" />} accent="navy" label="Paralelos" value={d.resumen.paralelos} />
            <StatCard icon={<Users className="h-7 w-7" />} accent="green" label="Estudiantes inscritos" value={d.resumen.estudiantes} />
            <StatCard icon={<AlertTriangle className="h-7 w-7" />} accent="amber" label="Paralelos sin docente" value={d.resumen.sin_docente} />
          </>
        )}
      </StatGrid>

      {aviso && (
        <p className={`mb-4 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm text-fg ${aviso.ok ? 'border-prexi-green/40 bg-prexi-green/10' : 'border-red-500/40 bg-red-500/10'}`}>
          <span className="flex items-center gap-2">{aviso.ok ? <CheckCircle className="h-4 w-4 text-prexi-green" /> : <AlertTriangle className="h-4 w-4 text-prexi-red" />} {aviso.texto}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-muted hover:text-fg"><X className="h-4 w-4" /></button>
        </p>
      )}

      {d && docentesActivos.length === 0 && (
        <p className="mb-4 rounded-xl border border-prexi-amber/40 bg-prexi-amber/10 px-3 py-2.5 text-sm text-fg">
          Todavía no hay docentes activos. <Link href="/admin/usuarios?nuevo=1" className="font-semibold text-prexi-blue-deep hover:underline">Crea la cuenta del docente</Link> y vuelve para asignarlo.
        </p>
      )}

      {!d ? <Skeleton className="h-48" /> : d.materias.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen className="h-7 w-7" />} title="Aún no hay materias" hint="Crea la materia (por ejemplo, Programación I · 2026-II) y luego sus paralelos. El docente también puede crearlas al registrar su lista." />
          <div className="mt-4 text-center"><button onClick={() => setModalMateria(true)} className="btn-primary"><Plus className="h-4 w-4" /> Crear la primera materia</button></div>
        </Card>
      ) : (
        <div className="space-y-5">
          {d.materias.map((m) => (
            <Card key={m.id}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-bold text-fg">{m.nombre} {m.sigla && <span className="text-base font-semibold text-muted">· {m.sigla}</span>}</h2>
                  <p className="text-sm text-muted">Gestión {m.gestion} · {m.paralelos.length} paralelo(s) · {m.paralelos.reduce((s, p) => s + p.estudiantes, 0)} estudiantes</p>
                </div>
                <button onClick={() => setModalParalelo(m)} className="btn-ghost text-sm"><Plus className="h-4 w-4" /> Agregar paralelo</button>
              </div>

              {m.paralelos.length === 0 ? <p className="text-sm text-muted">Esta materia aún no tiene paralelos.</p> : (
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {m.paralelos.map((p) => (
                    <li key={p.id} className={`rounded-2xl border p-4 ${p.docente ? 'border-line' : 'border-2 border-prexi-amber/60 bg-prexi-amber/5'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-display text-lg font-bold text-fg">Paralelo {p.nombre}</p>
                        {p.docente ? <Badge tone="green"><CheckCircle className="h-3 w-3" /> Con docente</Badge> : <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> Sin docente</Badge>}
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
                        <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" /> {p.estudiantes} estudiante(s)</span>
                        {p.solicitudes > 0 && <span className="inline-flex items-center gap-1 font-semibold text-prexi-amber"><Clock className="h-4 w-4" /> {p.solicitudes} solicitud(es)</span>}
                      </p>
                      <label className="mt-3 block">
                        <span className="mb-1 block text-xs font-semibold text-muted">Docente a cargo</span>
                        <select value={p.docente?.id ?? ''} disabled={guardando === p.id} onChange={(e) => asignar(p, e.target.value)} className="input !py-2 text-sm">
                          <option value="">— Sin docente —</option>
                          {docentesActivos.map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.rol === 'admin' ? ' (admin)' : ''} · {x.paralelos} a cargo</option>)}
                          {p.docente && !p.docente.activo && <option value={p.docente.id}>{p.docente.nombre} (desactivado)</option>}
                        </select>
                      </label>
                      {guardando === p.id && <p className="mt-1 text-xs text-muted">Guardando…</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Docentes y su carga */}
      {d && d.docentes.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 font-display text-lg font-bold text-fg">Docentes y su carga</h2>
          <ul className="divide-y divide-line">
            {d.docentes.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className={`min-w-0 flex-1 ${x.activo ? '' : 'opacity-60'}`}>
                  <span className="block font-medium text-fg">{x.nombre} {x.rol === 'admin' && <Badge tone="amber">admin</Badge>}</span>
                  <span className="block truncate text-xs text-muted">{x.email}</span>
                </span>
                <span className="text-sm text-muted">{x.paralelos ? `${x.paralelos} paralelo(s)` : 'Sin paralelos'}</span>
                {!x.activo && <Badge tone="red">Desactivado</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ModalMateria abierto={modalMateria} onCerrar={() => setModalMateria(false)} onListo={async (t) => { setModalMateria(false); setAviso({ ok: true, texto: t }); await cargar(); }} />
      <ModalParalelo materia={modalParalelo} docentes={docentesActivos} onCerrar={() => setModalParalelo(null)} onListo={async (t) => { setModalParalelo(null); setAviso({ ok: true, texto: t }); await cargar(); }} />
    </div>
  );
}

function ModalMateria({ abierto, onCerrar, onListo }: { abierto: boolean; onCerrar: () => void; onListo: (texto: string) => void }) {
  const [f, setF] = useState({ nombre: 'Programación I', sigla: 'PRG-111', gestion: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (abierto) { setError(''); setF((x) => ({ ...x, gestion: x.gestion || `${new Date().getFullYear()}-${new Date().getMonth() < 6 ? 'I' : 'II'}` })); } }, [abierto]);
  async function crear() {
    setGuardando(true); setError('');
    try { await api.post('/admin/cursos/materias', f); onListo(`Se creó ${f.nombre} (${f.gestion}). Ahora agrégale sus paralelos.`); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo crear.'); }
    finally { setGuardando(false); }
  }
  return (
    <Modal open={abierto} onClose={onCerrar} title="Nueva materia"
      footer={<><button onClick={onCerrar} className="btn-ghost">Cancelar</button><button onClick={crear} disabled={guardando} className="btn-primary">{guardando ? 'Creando…' : 'Crear materia'}</button></>}>
      {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Nombre de la materia"><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field></div>
        <Field label="Sigla (opcional)"><Input value={f.sigla} onChange={(e) => setF({ ...f, sigla: e.target.value })} /></Field>
        <Field label="Gestión" hint="Por ejemplo, 2026-I o 2026-II."><Input value={f.gestion} onChange={(e) => setF({ ...f, gestion: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ModalParalelo({ materia, docentes, onCerrar, onListo }: { materia: Materia | null; docentes: Docente[]; onCerrar: () => void; onListo: (texto: string) => void }) {
  const [nombre, setNombre] = useState('');
  const [docenteId, setDocenteId] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (!materia) return;
    setError(''); setDocenteId('');
    // Sugiere la letra siguiente a la última (A, B → C).
    const usadas = materia.paralelos.map((p) => p.nombre);
    setNombre('ABCDEFGHIJ'.split('').find((l) => !usadas.includes(l)) ?? '');
  }, [materia]);
  async function crear() {
    if (!materia) return;
    setGuardando(true); setError('');
    try {
      await api.post('/admin/cursos/paralelos', { materiaId: materia.id, nombre, ...(docenteId ? { docenteId: Number(docenteId) } : {}) });
      onListo(`Se creó el paralelo ${nombre.toUpperCase()} de ${materia.nombre}.`);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo crear.'); }
    finally { setGuardando(false); }
  }
  return (
    <Modal open={!!materia} onClose={onCerrar} title={`Nuevo paralelo · ${materia?.nombre ?? ''} ${materia?.gestion ?? ''}`}
      footer={<><button onClick={onCerrar} className="btn-ghost">Cancelar</button><button onClick={crear} disabled={guardando || !nombre.trim()} className="btn-primary">{guardando ? 'Creando…' : 'Crear paralelo'}</button></>}>
      {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paralelo" hint="Una letra o un número corto."><Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={4} /></Field>
        <Field label="Docente a cargo (opcional)">
          <select value={docenteId} onChange={(e) => setDocenteId(e.target.value)} className="input">
            <option value="">— Lo asigno después —</option>
            {docentes.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
