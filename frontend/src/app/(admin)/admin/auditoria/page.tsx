'use client';

/**
 * AUDITORÍA (administrador): quién hizo qué y cuándo. Cada acción con un nombre
 * claro, agrupada por día, con búsqueda libre (por persona o por detalle),
 * filtros de acción y fechas, y «cargar más» para ir hacia atrás.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Badge, Skeleton, Input, EmptyState } from '@/components/ui';
import { ClipboardList, Search, X } from '@/components/icons';
import { ACCIONES, etiquetaAccion, tonoAccion } from '@/components/admin/acciones';

interface Log { id: number; actor: string; actor_rol: string; accion: string; entidad: string; entidadId: number | null; detalle: string; fecha: string }
interface Respuesta { total: number; acciones: string[]; logs: Log[] }
const PAGINA = 50;
const ROL = { estudiante: 'Estudiante', docente: 'Docente', investigador: 'Investigador', admin: 'Administrador' } as Record<string, string>;

export default function AdminAuditoriaPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [acciones, setAcciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [masCargando, setMasCargando] = useState(false);
  const [accion, setAccion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [q, setQ] = useState('');

  const consulta = useCallback((offset: number) => {
    const p = new URLSearchParams({ limit: String(PAGINA), offset: String(offset) });
    if (accion) p.set('accion', accion);
    if (desde) p.set('desde', desde);
    if (hasta) p.set('hasta', hasta);
    if (q.trim()) p.set('q', q.trim());
    return api.get<Respuesta>(`/admin/auditoria?${p.toString()}`);
  }, [accion, desde, hasta, q]);

  useEffect(() => {
    setCargando(true);
    const t = setTimeout(() => {
      consulta(0).then((r) => { setLogs(r.logs); setTotal(r.total); setAcciones(r.acciones); }).catch(() => undefined).finally(() => setCargando(false));
    }, 250);
    return () => clearTimeout(t);
  }, [consulta]);

  async function cargarMas() {
    setMasCargando(true);
    try { const r = await consulta(logs.length); setLogs((l) => [...l, ...r.logs]); } catch { /* noop */ } finally { setMasCargando(false); }
  }

  // Agrupadas por día (hoy, ayer o la fecha).
  const porDia = useMemo(() => {
    const hoy = new Date().toDateString();
    const ayer = new Date(Date.now() - 86_400_000).toDateString();
    const m = new Map<string, Log[]>();
    for (const l of logs) {
      const d = new Date(l.fecha);
      const k = d.toDateString() === hoy ? 'Hoy' : d.toDateString() === ayer ? 'Ayer'
        : d.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      m.set(k, [...(m.get(k) ?? []), l]);
    }
    return [...m.entries()];
  }, [logs]);

  const hayFiltros = !!(accion || desde || hasta || q);
  const grupos = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const a of acciones) { const n = ACCIONES[a]?.grupo ?? 'Otras'; g.set(n, [...(g.get(n) ?? []), a]); }
    return [...g.entries()];
  }, [acciones]);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Auditoría" subtitle="Quién hizo qué y cuándo: cuentas, roles, cursos, configuración y seguridad. Nada de esto se puede borrar." />

      <Card className="mb-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_160px_160px_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Buscar</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Persona o detalle (ej. «paralelo A»)" className="input !pl-9" />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">Acción</span>
            <select value={accion} onChange={(e) => setAccion(e.target.value)} className="input">
              <option value="">Todas</option>
              {grupos.map(([g, lista]) => <optgroup key={g} label={g}>{lista.map((a) => <option key={a} value={a}>{etiquetaAccion(a)}</option>)}</optgroup>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-muted">Desde</span><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-muted">Hasta</span><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          {hayFiltros
            ? <button onClick={() => { setAccion(''); setDesde(''); setHasta(''); setQ(''); }} className="btn-ghost"><X className="h-4 w-4" /> Limpiar</button>
            : <span className="hidden lg:block" />}
        </div>
      </Card>

      {cargando ? <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        : logs.length === 0 ? <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="Sin registros" hint={hayFiltros ? 'No hay acciones que coincidan con los filtros.' : 'Todavía no se registró ninguna acción.'} />
          : (
            <>
              <p className="mb-3 text-sm text-muted">{total} registro(s){logs.length < total ? ` · mostrando ${logs.length}` : ''}</p>
              <div className="space-y-5">
                {porDia.map(([dia, lista]) => (
                  <section key={dia}>
                    <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted first-letter:uppercase">{dia}</h2>
                    <Card className="!p-0">
                      <ul className="divide-y divide-line">
                        {lista.map((l) => (
                          <li key={l.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-5 py-3">
                            <span className="w-14 shrink-0 pt-0.5 text-xs font-semibold text-muted">{new Date(l.fecha).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}</span>
                            <Badge tone={tonoAccion(l.accion)}>{etiquetaAccion(l.accion)}</Badge>
                            <div className="min-w-[200px] flex-1">
                              <p className="break-words text-sm text-fg">{l.detalle || '—'}</p>
                              <p className="mt-0.5 text-xs text-muted">{l.actor} · {ROL[l.actor_rol] ?? l.actor_rol}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  </section>
                ))}
              </div>
              {logs.length < total && (
                <div className="mt-5 text-center">
                  <button onClick={cargarMas} disabled={masCargando} className="btn-ghost">{masCargando ? 'Cargando…' : `Cargar ${Math.min(PAGINA, total - logs.length)} más`}</button>
                </div>
              )}
            </>
          )}
    </div>
  );
}
