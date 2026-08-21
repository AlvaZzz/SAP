'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader, Card, Badge, Skeleton, Select, Input, EmptyState, ResponsiveTable } from '@/components/ui';
import { Users, Lock, CheckCircle } from '@/components/icons';

interface Estudiante { id: number; nombre: string; email: string; grupo: 'control' | 'experimental'; institucion: string | null; paralelo: string | null; activo: boolean }
interface Grupos {
  bloqueado: boolean;
  conteo: { control: number; experimental: number; total: number };
  instituciones: { institucion: string; control: number; experimental: number; total: number }[];
  paralelos: { paralelo: string; control: number; experimental: number; total: number }[];
  estudiantes: Estudiante[];
}

export default function AdminGruposPage() {
  const [d, setD] = useState<Grupos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [inst, setInst] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState('');
  const [paraleloSel, setParaleloSel] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setD(await api.get<Grupos>('/admin/grupos')); } catch { /* noop */ } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  function toggle(id: number) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleTodos() {
    if (!d) return;
    setSel((s) => s.size === d.estudiantes.length ? new Set() : new Set(d.estudiantes.map((e) => e.id)));
  }

  async function asignar(grupo: 'control' | 'experimental', ids: number[]) {
    if (ids.length === 0) return;
    setError('');
    if (d?.bloqueado && !confirm('Los grupos están bloqueados. ¿Forzar el cambio? Puede contaminar el diseño cuasi-experimental.')) return;
    setAplicando(true);
    try {
      await api.post('/admin/grupos/asignar', { ids, grupo, institucion: inst.trim() || undefined, forzar: d?.bloqueado || undefined });
      setSel(new Set()); await cargar();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo asignar'); }
    finally { setAplicando(false); }
  }

  async function asignarParalelo(grupo: 'control' | 'experimental') {
    if (!paraleloSel) { setError('Selecciona un paralelo.'); return; }
    setError('');
    if (d?.bloqueado && !confirm('Los grupos están bloqueados. ¿Forzar el cambio? Puede contaminar el diseño cuasi-experimental.')) return;
    setAplicando(true);
    try {
      await api.post('/admin/grupos/asignar-paralelo', { paralelo: paraleloSel, grupo, forzar: d?.bloqueado || undefined });
      await cargar();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo asignar el paralelo'); }
    finally { setAplicando(false); }
  }

  if (cargando) return <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  if (!d) return <EmptyState icon={<Users className="h-7 w-7" />} title="No se pudo cargar" />;
  const balance = d.conteo.total ? Math.round((Math.min(d.conteo.control, d.conteo.experimental) / (d.conteo.total / 2)) * 100) : 0;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Grupos de investigación" subtitle="Asigna cada estudiante a control o experimental. Este grupo alimenta las comparativas y la exportación del investigador." />

      {d.bloqueado && (
        <div className="mb-5 flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <Lock className="h-4 w-4 shrink-0" /> Los grupos están <b>bloqueados</b> (recolección en curso). Cambiarlos requiere confirmación para no contaminar el diseño.
        </div>
      )}

      {/* Conteos + balance */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="text-center"><p className="stat-label">Control</p><p className="font-display text-3xl font-extrabold text-prexi-blue-deep">{d.conteo.control}</p></Card>
        <Card className="text-center"><p className="stat-label">Experimental</p><p className="font-display text-3xl font-extrabold text-prexi-green">{d.conteo.experimental}</p></Card>
        <Card className="text-center"><p className="stat-label">Balance de la muestra</p><p className="font-display text-3xl font-extrabold text-fg">{balance}%</p></Card>
      </div>

      {/* Desglose por institución */}
      {d.instituciones.length > 0 && (
        <Card className="mb-6">
          <p className="mb-3 text-sm font-semibold text-fg">Por institución / cohorte</p>
          <div className="space-y-2">
            {d.instituciones.map((i) => (
              <div key={i.institucion} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate text-muted">{i.institucion}</span>
                <div className="flex h-5 flex-1 overflow-hidden rounded">
                  <div className="bg-prexi-blue" style={{ width: `${(i.control / i.total) * 100}%` }} />
                  <div className="bg-prexi-green" style={{ width: `${(i.experimental / i.total) * 100}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-xs text-muted">{i.control} / {i.experimental}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}

      {/* Asignación por paralelo completo (la forma recomendada de armar los grupos) */}
      <Card className="mb-6">
        <p className="mb-1 text-sm font-semibold text-fg">Asignar un paralelo completo</p>
        <p className="mb-3 text-xs text-muted">La forma más rápida de armar el diseño: un paralelo entero como grupo experimental (usa el tutor PREXI) y otro como control.</p>
        {d.paralelos.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay estudiantes con paralelo registrado.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={paraleloSel} onChange={(e) => setParaleloSel(e.target.value)} className="!w-auto">
              <option value="">Selecciona un paralelo…</option>
              {d.paralelos.map((p) => <option key={p.paralelo} value={p.paralelo}>{p.paralelo} ({p.total} estudiantes)</option>)}
            </Select>
            <button onClick={() => asignarParalelo('control')} disabled={!paraleloSel || aplicando} className="rounded-xl bg-prexi-blue px-4 py-2 text-sm font-semibold text-accent-on transition hover:bg-prexi-blue-hover disabled:opacity-40">Todo el paralelo → Control</button>
            <button onClick={() => asignarParalelo('experimental')} disabled={!paraleloSel || aplicando} className="rounded-xl bg-prexi-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40">Todo el paralelo → Experimental</button>
          </div>
        )}
        {d.paralelos.length > 0 && (
          <div className="mt-4 space-y-2">
            {d.paralelos.map((p) => (
              <div key={p.paralelo} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 truncate text-muted">Paralelo {p.paralelo}</span>
                <div className="flex h-5 flex-1 overflow-hidden rounded">
                  <div className="bg-prexi-blue" style={{ width: `${(p.control / p.total) * 100}%` }} />
                  <div className="bg-prexi-green" style={{ width: `${(p.experimental / p.total) * 100}%` }} />
                </div>
                <span className="w-24 shrink-0 text-right text-xs text-muted">{p.control} / {p.experimental}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Barra de acción masiva */}
      <Card className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-fg">{sel.size} seleccionado(s)</span>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={inst} onChange={(e) => setInst(e.target.value)} placeholder="Institución (opcional)" className="!w-44 max-w-full" />
          <button onClick={() => asignar('control', [...sel])} disabled={sel.size === 0 || aplicando} className="rounded-xl bg-prexi-blue px-4 py-2 text-sm font-semibold text-accent-on transition hover:bg-prexi-blue-hover disabled:opacity-40">→ Control</button>
          <button onClick={() => asignar('experimental', [...sel])} disabled={sel.size === 0 || aplicando} className="rounded-xl bg-prexi-green px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40">→ Experimental</button>
        </div>
      </Card>

      {/* Tabla (tarjetas en móvil) */}
      {d.estudiantes.length === 0 ? (
        <Card><p className="py-6 text-center text-muted">No hay estudiantes registrados.</p></Card>
      ) : (
        <ResponsiveTable
          rows={d.estudiantes}
          rowKey={(e) => e.id}
          cols={[
            {
              header: <input type="checkbox" aria-label="Seleccionar todos" checked={sel.size === d.estudiantes.length && d.estudiantes.length > 0} onChange={toggleTodos} className="h-4 w-4 accent-prexi-blue" />,
              cell: (e) => <input type="checkbox" aria-label={`Seleccionar a ${e.nombre}`} checked={sel.has(e.id)} onChange={() => toggle(e.id)} className="h-4 w-4 accent-prexi-blue" />,
            },
            { header: 'Estudiante', cell: (e) => <div><p className="font-medium text-fg">{e.nombre}</p><p className="text-xs text-muted">{e.email}</p></div> },
            { header: 'Paralelo', cell: (e) => <span className="text-muted">{e.paralelo ?? '—'}</span> },
            { header: 'Institución', cell: (e) => <span className="text-muted">{e.institucion ?? '—'}</span> },
            { header: 'Grupo actual', cell: (e) => <Badge tone={e.grupo === 'experimental' ? 'green' : 'slate'}>{e.grupo}</Badge> },
            { header: 'Asignar', align: 'right', cell: (e) => <BotonesAsignar e={e} aplicando={aplicando} onAsignar={asignar} /> },
          ]}
          card={(e) => (
            <div className={`space-y-3 ${sel.has(e.id) ? 'rounded-xl bg-prexi-blue/5' : ''}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" aria-label={`Seleccionar a ${e.nombre}`} checked={sel.has(e.id)} onChange={() => toggle(e.id)} className="mt-1 h-5 w-5 shrink-0 accent-prexi-blue" />
                <div className="min-w-0 flex-1"><p className="font-medium text-fg">{e.nombre}</p><p className="truncate text-xs text-muted">{e.email}</p></div>
                <Badge tone={e.grupo === 'experimental' ? 'green' : 'slate'}>{e.grupo}</Badge>
              </div>
              <p className="text-xs text-muted">Paralelo {e.paralelo ?? '—'} · {e.institucion ?? 'Sin institución'}</p>
              <BotonesAsignar e={e} aplicando={aplicando} onAsignar={asignar} grandes />
            </div>
          )}
        />
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><CheckCircle className="h-3.5 w-3.5 text-prexi-green" /> El bloqueo de grupos se activa desde Sistema → Investigación.</p>
    </div>
  );
}

/** Botones Control/Experimental de una fila. `grandes` = área táctil cómoda en móvil. */
function BotonesAsignar({ e, aplicando, onAsignar, grandes = false }: {
  e: Estudiante; aplicando: boolean;
  onAsignar: (grupo: 'control' | 'experimental', ids: number[]) => void;
  grandes?: boolean;
}) {
  const pad = grandes ? 'px-3.5 py-2 text-sm' : 'px-2.5 py-1 text-xs';
  return (
    <div className={`flex items-center gap-1.5 ${grandes ? '' : 'justify-end'}`}>
      <button onClick={() => onAsignar('control', [e.id])} disabled={aplicando} className={`rounded-lg border font-semibold transition ${pad} ${e.grupo === 'control' ? 'border-prexi-blue bg-prexi-blue/10 text-prexi-blue-deep' : 'border-line text-muted hover:bg-subtle'}`}>Control</button>
      <button onClick={() => onAsignar('experimental', [e.id])} disabled={aplicando} className={`rounded-lg border font-semibold transition ${pad} ${e.grupo === 'experimental' ? 'border-prexi-green bg-emerald-500/10 text-prexi-green' : 'border-line text-muted hover:bg-subtle'}`}>Experimental</button>
    </div>
  );
}
