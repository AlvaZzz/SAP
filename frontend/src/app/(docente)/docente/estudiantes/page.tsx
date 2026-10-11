'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { EstudianteFila, EstudianteDetalle, EstadoEstudiante } from '@/lib/types';
import { PageHeader, Card, Skeleton, Modal, Textarea, ProgressBar, Badge, EmptyState, ResponsiveTable } from '@/components/ui';
import { EstadoBadge } from '@/components/docente/estado-badge';
import { Users, Search, Save, CheckCircle, X as XIcon } from '@/components/icons';

const ESTADOS: { value: '' | EstadoEstudiante; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'en_progreso', label: 'En progreso' },
  { value: 'completado', label: 'Completado' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'en_riesgo', label: 'En riesgo' },
];

function EstudiantesContenido() {
  const searchParams = useSearchParams();
  const [lista, setLista] = useState<EstudianteFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<'' | EstadoEstudiante>('');
  const [selId, setSelId] = useState<number | null>(null);

  // La lista viene PAGINADA del backend (50 por página). Se acumulan las
  // páginas en memoria para que el buscador siga funcionando sobre lo cargado.
  const [paginacion, setPaginacion] = useState<{ pagina: number; total: number; paginas: number } | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargarPagina = useCallback((pagina: number) => {
    const primera = pagina === 1;
    if (primera) setCargando(true); else setCargandoMas(true);
    api.get<{ estudiantes: EstudianteFila[]; paginacion: { pagina: number; total: number; paginas: number } }>(
      `/docente/estudiantes?pagina=${pagina}`,
    )
      .then((r) => {
        setLista((prev) => (primera ? r.estudiantes : [...prev, ...r.estudiantes]));
        setPaginacion(r.paginacion);
      })
      .catch(() => undefined)
      .finally(() => { setCargando(false); setCargandoMas(false); });
  }, []);

  useEffect(() => { cargarPagina(1); }, [cargarPagina]);

  // Auto-abre el detalle si viene ?id= desde el dashboard.
  useEffect(() => {
    const id = searchParams.get('id');
    if (id) setSelId(Number(id));
  }, [searchParams]);

  const filtrados = useMemo(() => lista.filter((e) =>
    (!filtro || e.estado === filtro) && e.nombre.toLowerCase().includes(q.toLowerCase())
  ), [lista, q, filtro]);

  const fecha = (f: string | null) => f ? new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Nunca';

  return (
    <div className="animate-fade-up">
      <PageHeader title="Seguimiento de estudiantes" subtitle={`${lista.length} estudiantes registrados`} />

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar estudiante…" className="input pl-11" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map((e) => (
            <button key={e.value} onClick={() => setFiltro(e.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${filtro === e.value ? 'bg-prexi-blue text-white' : 'border border-line text-muted hover:bg-subtle'}`}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        : filtrados.length === 0 ? <EmptyState icon={<Users className="h-7 w-7" />} title="Sin resultados" hint="Ajusta la búsqueda o el filtro de estado." />
          : (
            <ResponsiveTable
              rows={filtrados}
              rowKey={(e) => e.id}
              onRowClick={(e) => setSelId(e.id)}
              cols={[
                {
                  header: 'Estudiante',
                  cell: (e) => (
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-prexi-navy to-prexi-blue text-sm font-bold text-white">{e.nombre.charAt(0).toUpperCase()}</div>
                      <div className="min-w-0"><p className="truncate font-semibold text-fg">{e.nombre}</p><p className="truncate text-xs text-muted">{e.email}</p></div>
                    </div>
                  ),
                },
                { header: 'Nivel', cell: (e) => <span className="text-muted">Nivel {e.nivel_actual}</span> },
                { header: 'XP', cell: (e) => <span className="font-medium text-fg">{e.xp}</span> },
                { header: 'Ejercicios', cell: (e) => <span className="text-muted">{e.ejercicios_completados}</span> },
                { header: 'Última sesión', cell: (e) => <span className="whitespace-nowrap text-muted">{fecha(e.ultima_sesion)}</span> },
                { header: 'Estado', cell: (e) => <EstadoBadge estado={e.estado} /> },
              ]}
            />
          )}

      {/* La lista viene paginada del backend: se cargan más páginas a demanda
          en vez de traer el curso entero de una vez. */}
      {paginacion && paginacion.pagina < paginacion.paginas && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-muted">
            Mostrando {lista.length} de {paginacion.total} estudiantes
          </p>
          <button
            type="button"
            onClick={() => cargarPagina(paginacion.pagina + 1)}
            disabled={cargandoMas}
            className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-fg transition hover:bg-subtle disabled:opacity-50"
          >
            {cargandoMas ? 'Cargando…' : 'Cargar más'}
          </button>
        </div>
      )}

      {selId && <DetalleEstudiante id={selId} onClose={() => setSelId(null)} />}
    </div>
  );
}

function DetalleEstudiante({ id, onClose }: { id: number; onClose: () => void }) {
  const [d, setD] = useState<EstudianteDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    setCargando(true);
    api.get<EstudianteDetalle>(`/docente/estudiantes/${id}`)
      .then((r) => { setD(r); setNota(r.nota); }).catch(() => undefined).finally(() => setCargando(false));
  }, [id]);

  async function guardarNota() {
    setGuardando(true); setGuardado(false);
    await api.put(`/docente/estudiantes/${id}/nota`, { texto: nota }).catch(() => undefined);
    setGuardando(false); setGuardado(true);
    setTimeout(() => setGuardado(false), 2500);
  }

  const fecha = (f: string | null) => f ? new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Nunca';
  const maxAct = d ? Math.max(1, ...d.actividad.map((a) => a.intentos)) : 1;

  return (
    <Modal open onClose={onClose} size="lg" title={d ? d.estudiante.nombre : 'Estudiante'}>
      {cargando || !d ? <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <div className="space-y-6">
          {/* Cabecera */}
          <div className="flex flex-wrap items-center gap-3">
            <EstadoBadge estado={d.estudiante.estado} />
            <span className="text-sm text-muted">{d.estudiante.email}</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'XP total', value: d.estudiante.xp },
              { label: 'Ejercicios', value: d.estudiante.ejercicios_completados },
              { label: 'Tasa acierto', value: `${d.estudiante.tasa_acierto}%` },
              { label: 'Racha', value: `${d.estudiante.racha_dias} d` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line p-3 text-center">
                <p className="font-display text-2xl font-extrabold text-fg">{s.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Progreso por nivel */}
          <div>
            <h3 className="mb-3 font-display font-bold text-fg">Progreso por nivel</h3>
            <div className="space-y-2.5">
              {d.progreso_niveles.map((n) => (
                <div key={n.numero} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs font-medium text-muted">Nivel {n.numero}</span>
                  <div className="flex-1"><ProgressBar value={n.umbral ? (n.ejercicios_completados / n.umbral) * 100 : 0} size="sm" tone={n.estado === 'completado' ? 'green' : 'blue'} /></div>
                  <span className="w-14 shrink-0 text-right text-xs text-muted">{n.ejercicios_completados}/{n.umbral}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actividad + Pretest/Postest */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 font-display font-bold text-fg">Actividad (7 días)</h3>
              <div className="flex h-24 items-end gap-1.5">
                {d.actividad.map((a) => (
                  <div key={a.dia} className="flex flex-1 flex-col items-center gap-1" title={`${a.dia}: ${a.intentos} intentos`}>
                    <div className="flex w-full items-end justify-center" style={{ height: '72px' }}>
                      <div className="w-full rounded-t bg-prexi-blue transition-all" style={{ height: `${(a.intentos / maxAct) * 100}%`, minHeight: a.intentos ? '4px' : '0' }} />
                    </div>
                    <span className="text-[9px] text-muted">{a.dia.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-3 font-display font-bold text-fg">Pretest / Postest</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between rounded-lg bg-subtle px-3 py-2"><span className="text-muted">Pretest</span><span className="font-bold text-fg">{d.pretest ? `${d.pretest.puntaje}/100` : '—'}</span></div>
                <div className="flex justify-between rounded-lg bg-subtle px-3 py-2"><span className="text-muted">Postest</span><span className="font-bold text-fg">{d.postest ? `${d.postest.puntaje}/100` : '—'}</span></div>
                <div className="flex justify-between rounded-lg bg-prexi-blue/10 px-3 py-2"><span className="text-prexi-blue-deep">Avance</span><span className="font-bold text-prexi-blue-deep">{d.avance != null ? `${d.avance > 0 ? '+' : ''}${d.avance}` : '—'}</span></div>
              </div>
            </div>
          </div>

          {/* Historial reciente */}
          <div>
            <h3 className="mb-3 font-display font-bold text-fg">Intentos recientes</h3>
            {d.historial.length === 0 ? <p className="text-sm text-muted">Sin intentos todavía.</p> : (
              <div className="divide-y divide-line rounded-xl border border-line">
                {d.historial.slice(0, 8).map((h, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                    {h.correcto ? <CheckCircle className="h-4 w-4 shrink-0 text-prexi-green" /> : <XIcon className="h-4 w-4 shrink-0 text-prexi-red" />}
                    <span className="min-w-0 flex-1 truncate text-fg">{h.titulo}</span>
                    <span className="shrink-0 text-xs text-muted">{h.categoria}</span>
                    <span className="w-24 shrink-0 text-right text-xs text-muted">{fecha(h.fecha)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Patrones de error detectados por PREXI */}
          {d.patrones_error?.length > 0 && (
            <div>
              <h3 className="mb-3 font-display font-bold text-fg">Errores recurrentes (detectados por el tutor PREXI)</h3>
              <div className="space-y-2">
                {d.patrones_error.map((p) => (
                  <div key={p.clave} className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 text-fg">{p.descripcion}</span>
                    <Badge tone="amber">×{p.frecuencia}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nota del docente */}
          <div>
            <h3 className="mb-2 font-display font-bold text-fg">Nota del docente</h3>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Observación privada sobre este estudiante…" />
            <div className="mt-2 flex items-center gap-3">
              <button onClick={guardarNota} disabled={guardando} className="btn-primary !py-2 text-sm"><Save className="h-4 w-4" /> {guardando ? 'Guardando…' : 'Guardar nota'}</button>
              {guardado && <span className="flex items-center gap-1 text-sm text-prexi-green"><CheckCircle className="h-4 w-4" /> Guardada</span>}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function DocenteEstudiantesPage() {
  return (
    <Suspense fallback={<div className="text-muted">Cargando…</div>}>
      <EstudiantesContenido />
    </Suspense>
  );
}
