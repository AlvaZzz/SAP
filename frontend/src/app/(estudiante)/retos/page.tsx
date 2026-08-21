'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { RetoEstudiante, EstadoReto, NivelDificultad, NIVEL_LABEL, NIVEL_COLOR } from '@/lib/types';
import { PageHeader, Badge, Skeleton } from '@/components/ui';
import { NivelBadge, nivelDesdeEstrellas } from '@/components/nivel-badge';
import { Target, CheckCircle, ArrowRight, Code, Clock, AlertTriangle, Lock, Search, X, Layers } from '@/components/icons';

interface Acceso { acceso: boolean; nivel: string; nivel_label: string; motivo: string | null }

const GENERAL = { clave: 'general', titulo: 'General / Sin categoría' };
/** Selección de unidad en los chips: número, 'general' o null (todas). */
type SelUnidad = number | 'general' | null;

interface Grupo {
  clave: string;
  unidad: { numero: number; titulo: string } | null;
  temas: { clave: string; titulo: string | null; retos: RetoEstudiante[] }[];
  total: number;
}

export default function RetosPage() {
  const router = useRouter();
  const [retos, setRetos] = useState<RetoEstudiante[]>([]);
  const [acceso, setAcceso] = useState<Acceso | null>(null);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [unidadSel, setUnidadSel] = useState<SelUnidad>(null);
  const [nivelSel, setNivelSel] = useState<NivelDificultad | null>(null);

  useEffect(() => {
    // Primero el ACCESO (nivel IRT + habilitación docente, validado en el backend).
    api.get<Acceso>('/retos/acceso')
      .then(async (a) => {
        setAcceso(a);
        if (a.acceso) {
          const r = await api.get<{ retos: RetoEstudiante[] }>('/retos').catch(() => ({ retos: [] }));
          setRetos(r.retos);
        }
      })
      .catch(() => setAcceso(null))
      .finally(() => setCargando(false));
  }, []);

  // Chips de unidad: solo las que tienen retos.
  const unidades = useMemo(() => {
    const m = new Map<number, { numero: number; titulo: string; n: number }>();
    for (const r of retos) {
      if (!r.unidad) continue;
      const prev = m.get(r.unidad.numero);
      m.set(r.unidad.numero, { numero: r.unidad.numero, titulo: r.unidad.titulo, n: (prev?.n ?? 0) + 1 });
    }
    return [...m.values()].sort((a, b) => a.numero - b.numero);
  }, [retos]);

  const sinCategoria = useMemo(() => retos.filter((r) => !r.unidad).length, [retos]);

  // Conteo por nivel de dificultad (derivado de estrellas) para los chips.
  const porNivel = useMemo(() => {
    const c: Record<NivelDificultad, number> = { basico: 0, intermedio: 0, avanzado: 0 };
    for (const r of retos) c[nivelDesdeEstrellas(r.estrellas)]++;
    return c;
  }, [retos]);

  // Búsqueda en TIEMPO REAL (título, categoría, unidad, tema, docente) + filtros.
  const filtrados = useMemo(() => {
    const t = normalizar(q);
    return retos.filter((r) => {
      if (unidadSel === 'general' && r.unidad) return false;
      if (typeof unidadSel === 'number' && r.unidad?.numero !== unidadSel) return false;
      if (nivelSel && nivelDesdeEstrellas(r.estrellas) !== nivelSel) return false;
      if (!t) return true;
      return campos(r).some((c) => normalizar(c).includes(t));
    });
  }, [retos, q, unidadSel, nivelSel]);

  // Agrupación UNIDAD → TEMA (el backend ya entrega el orden académico correcto).
  const grupos = useMemo<Grupo[]>(() => {
    const out: Grupo[] = [];
    for (const r of filtrados) {
      const claveU = r.unidad ? `u${r.unidad.numero}` : GENERAL.clave;
      let g = out.find((x) => x.clave === claveU);
      if (!g) { g = { clave: claveU, unidad: r.unidad, temas: [], total: 0 }; out.push(g); }

      const claveT = r.tema ? `t${r.tema.id}` : 'sin-tema';
      let t = g.temas.find((x) => x.clave === claveT);
      if (!t) { t = { clave: claveT, titulo: r.tema ? `${r.tema.numero} ${r.tema.titulo}` : null, retos: [] }; g.temas.push(t); }

      t.retos.push(r);
      g.total++;
    }
    return out;
  }, [filtrados]);

  const hayFiltro = q.trim().length > 0 || unidadSel != null || nivelSel != null;
  const limpiar = () => { setQ(''); setUnidadSel(null); setNivelSel(null); };

  if (cargando) return (
    <div className="animate-fade-up">
      <PageHeader title="Retos" subtitle="Desafíos de código publicados por tus docentes." />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-48" />)}</div>
    </div>
  );

  // Bloqueo por nivel/habilitación (mensaje claro, coherente con el backend).
  if (acceso && !acceso.acceso) return (
    <div className="animate-fade-up">
      <PageHeader title="Retos" subtitle="Desafíos de código para consolidar lo aprendido." />
      <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card py-20 text-center">
        <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-subtle text-muted"><Lock className="h-7 w-7" /></div>
        <h2 className="font-display text-lg font-bold text-fg">Retos aún no disponibles</h2>
        <p className="mt-1 max-w-md text-sm text-muted">{acceso.motivo}</p>
        <p className="mt-3 text-xs text-muted">Tu nivel actual: <b className="text-fg">{acceso.nivel_label}</b></p>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-up">
      <PageHeader title="Retos" subtitle="Desafíos de código organizados por unidad y tema. Elige uno y resuélvelo en el editor con PREXI." />

      {/* Buscador */}
      <div className="mb-4 max-w-xl">
        <label htmlFor="buscar-reto" className="sr-only">Buscar reto por título, unidad, tema o docente</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input
            id="buscar-reto"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, categoría, unidad, tema o docente…"
            className="input pl-11 pr-10"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-subtle hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filtros por nivel de dificultad */}
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar por nivel">
        <Chip activo={nivelSel === null} onClick={() => setNivelSel(null)}>Todos los niveles</Chip>
        {(['basico', 'intermedio', 'avanzado'] as NivelDificultad[]).filter((n) => porNivel[n] > 0).map((n) => (
          <Chip key={n} activo={nivelSel === n} onClick={() => setNivelSel(n)} color={NIVEL_COLOR[n]}>
            {NIVEL_LABEL[n]} ({porNivel[n]})
          </Chip>
        ))}
      </div>

      {/* Filtros por unidad */}
      {unidades.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por unidad">
          <Chip activo={unidadSel === null} onClick={() => setUnidadSel(null)}>Todas las unidades</Chip>
          {unidades.map((u) => (
            <Chip key={u.numero} activo={unidadSel === u.numero} onClick={() => setUnidadSel(u.numero)} title={u.titulo}>
              Unidad {u.numero} ({u.n})
            </Chip>
          ))}
          {sinCategoria > 0 && (
            <Chip activo={unidadSel === 'general'} onClick={() => setUnidadSel('general')} title="Retos sin unidad asignada">
              General ({sinCategoria})
            </Chip>
          )}
        </div>
      )}

      {filtrados.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card px-4 py-16 text-center">
          <Target className="mb-3 h-9 w-9 text-muted" />
          <h2 className="font-display text-lg font-bold text-fg">
            {q.trim() ? <>No se encontraron retos para “{q.trim()}”</> : retos.length === 0 ? 'Aún no hay retos publicados' : 'No hay retos con estos filtros'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {retos.length === 0
              ? 'Cuando un docente publique un reto, aparecerá aquí para que lo resuelvas en el editor con PREXI.'
              : 'Prueba con otro término, nivel o unidad.'}
          </p>
          {hayFiltro && retos.length > 0 && <button onClick={limpiar} className="btn-ghost mt-4">Quitar filtros</button>}
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map((g) => (
            <section key={g.clave}>
              {/* Encabezado de UNIDAD */}
              <div className="mb-3 flex flex-wrap items-center gap-3 border-b border-line pb-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-prexi-blue/10 text-prexi-blue-deep">
                  <Layers className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  {g.unidad ? (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-prexi-blue-deep">Unidad {g.unidad.numero}</p>
                      <h2 className="font-display text-lg font-extrabold text-fg">{g.unidad.titulo}</h2>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Sin categoría</p>
                      <h2 className="font-display text-lg font-extrabold text-fg">{GENERAL.titulo}</h2>
                    </>
                  )}
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted">{g.total} {g.total === 1 ? 'reto' : 'retos'}</span>
              </div>

              {/* TEMAS dentro de la unidad */}
              <div className="space-y-5">
                {g.temas.map((t) => (
                  <div key={t.clave}>
                    {t.titulo && <h3 className="mb-2.5 text-sm font-bold text-fg">{t.titulo}</h3>}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {t.retos.map((r) => <TarjetaReto key={r.id} r={r} onAbrir={() => router.push(`/retos/${r.id}`)} />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Campos sobre los que busca el filtro de texto. */
function campos(r: RetoEstudiante): string[] {
  return [
    r.titulo,
    r.categoria,
    r.autor,
    r.unidad ? `Unidad ${r.unidad.numero} ${r.unidad.titulo}` : '',
    r.tema ? `${r.tema.numero} ${r.tema.titulo}` : '',
    r.subtema ? `${r.subtema.numero} ${r.subtema.titulo}` : '',
  ];
}

/** Minúsculas y sin acentos: "bucles" debe encontrar "Bucles". */
function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function Chip({ children, activo, onClick, title, color }: {
  children: React.ReactNode; activo: boolean; onClick: () => void; title?: string; color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={activo}
      style={activo && color ? { backgroundColor: color, borderColor: color, color: '#fff' } : undefined}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
        activo
          ? color ? '' : 'border-prexi-blue bg-prexi-blue text-accent-on'
          : 'border-line bg-card text-muted hover:border-prexi-blue/40 hover:text-fg'}`}
    >
      {children}
    </button>
  );
}

function BadgeEstado({ estado }: { estado: EstadoReto }) {
  if (estado === 'aprobado') return <Badge tone="green"><CheckCircle className="h-3 w-3" /> Aprobado</Badge>;
  if (estado === 'pendiente') return <Badge tone="blue"><Clock className="h-3 w-3" /> En revisión</Badge>;
  if (estado === 'necesita_mejorar') return <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> A mejorar</Badge>;
  return <Badge tone="slate">Nuevo</Badge>;
}

function TarjetaReto({ r, onAbrir }: { r: RetoEstudiante; onAbrir: () => void }) {
  return (
    <div className="card card-hover flex flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-prexi-blue/10 text-prexi-blue-deep"><Code className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-prexi-blue-deep">{r.categoria}</p>
            {/* Título completo (2 líneas máx.) + tooltip */}
            <h3 className="line-clamp-2 font-display font-bold leading-snug text-fg" title={r.titulo}>{r.titulo}</h3>
          </div>
        </div>
        <BadgeEstado estado={r.estado} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <NivelBadge estrellas={r.estrellas} size="sm" />
        {r.subtema && <Badge tone="blue">{r.subtema.numero}</Badge>}
        {r.es_bug_hunt && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">Bug hunt</span>}
      </div>

      <p className="mb-3 line-clamp-3 flex-1 text-sm text-muted">{r.enunciado}</p>

      {r.fecha_limite && r.estado !== 'aprobado' && (
        <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <Clock className="h-3 w-3" /> Fecha límite: {new Date(r.fecha_limite).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}
        </p>
      )}
      {r.feedback && (r.estado === 'necesita_mejorar' || r.estado === 'aprobado') && (
        <p className="mb-3 line-clamp-2 rounded-lg bg-subtle px-3 py-2 text-xs text-muted"><b className="text-fg">Feedback:</b> {r.feedback}</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-4">
        <span className="min-w-0 truncate text-xs text-muted">
          {r.estado === 'aprobado' ? `+${r.xp_obtenido} XP ganados` : `+${r.xp} XP`} · {r.autor}
        </span>
        <button onClick={onAbrir} className="btn-primary shrink-0 !py-1.5 !px-3.5 text-sm">
          {r.estado === 'aprobado' ? 'Ver' : r.estado === 'necesita_mejorar' ? 'Corregir' : r.estado === 'pendiente' ? 'Ver entrega' : 'Resolver'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
