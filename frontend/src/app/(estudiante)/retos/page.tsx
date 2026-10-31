'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { RetoEstudiante, EstadoReto, NIVEL_LABEL, NIVEL_COLOR } from '@/lib/types';
import { PageHeader, Skeleton } from '@/components/ui';
import { nivelDesdeEstrellas } from '@/components/nivel-badge';
import { Target, ArrowRight, Clock, Lock, Search, X } from '@/components/icons';
import { SELLO, ORDEN_SELLOS, SelloReto } from '@/components/retos/sello-reto';
import { TIPOS_RETO, TipoReto } from '@/components/docente/retos/tipos';
import { FuentePractica } from '@/components/fuente-practica';

interface Acceso { acceso: boolean; nivel: string; nivel_label: string; motivo: string | null }
type Filtro = 'todos' | EstadoReto;

/** Qué significa cada sello para el estudiante y qué hace el botón (ver SelloReto). */
const ESTADO = SELLO;
const ORDEN_ESTADO = ORDEN_SELLOS;

interface Grupo { clave: string; titulo: string; temas: { clave: string; titulo: string | null; retos: RetoEstudiante[] }[]; total: number; hechos: number }

const tipoDe = (r: RetoEstudiante): TipoReto => (r.es_bug_hunt ? 'bug' : 'codigo');
const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/**
 * Retos del estudiante: primero el tipo («Encuentra el bug» o «Escribe tu
 * código»), después una lista por unidad y tema. Cada fila dice en qué estado
 * está el reto y qué toca hacer.
 */
export default function RetosPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [retos, setRetos] = useState<RetoEstudiante[]>([]);
  const [acceso, setAcceso] = useState<Acceso | null>(null);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  useEffect(() => {
    // Primero el ACCESO (lo decide el backend); solo si lo hay se piden los retos.
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

  const cuenta = useMemo(() => ({ bug: retos.filter((r) => r.es_bug_hunt).length, codigo: retos.filter((r) => !r.es_bug_hunt).length }), [retos]);
  // Sin elección en la URL se abre el tipo que tenga retos.
  const pedido = search.get('tipo');
  const tipo: TipoReto = pedido === 'bug' || pedido === 'codigo' ? pedido : cuenta.bug === 0 && cuenta.codigo > 0 ? 'codigo' : 'bug';

  const delTipo = useMemo(() => retos.filter((r) => tipoDe(r) === tipo), [retos, tipo]);
  const porEstado = useMemo(() => {
    const c: Record<EstadoReto, number> = { nuevo: 0, en_curso: 0, incompleto: 0, revision: 0, aprobado: 0 };
    for (const r of delTipo) c[r.estado] += 1;
    return c;
  }, [delTipo]);

  const visibles = useMemo(() => {
    const t = normalizar(q);
    return delTipo.filter((r) => {
      if (filtro !== 'todos' && r.estado !== filtro) return false;
      if (!t) return true;
      return [r.titulo, r.enunciado, r.tema ? `${r.tema.numero} ${r.tema.titulo}` : '', r.subtema ? `${r.subtema.numero} ${r.subtema.titulo}` : '', r.unidad?.titulo ?? '']
        .some((c) => normalizar(c).includes(t));
    });
  }, [delTipo, filtro, q]);

  // Unidad → tema, en el orden académico que ya entrega el backend.
  const grupos = useMemo<Grupo[]>(() => {
    const out: Grupo[] = [];
    for (const r of visibles) {
      const claveU = r.unidad ? `u${r.unidad.numero}` : 'general';
      let g = out.find((x) => x.clave === claveU);
      if (!g) { g = { clave: claveU, titulo: r.unidad ? `Unidad ${r.unidad.numero}: ${r.unidad.titulo}` : 'Otros retos', temas: [], total: 0, hechos: 0 }; out.push(g); }
      const ref = r.subtema ?? r.tema;
      const claveT = ref ? `t${ref.id}` : 'sin-tema';
      let t = g.temas.find((x) => x.clave === claveT);
      if (!t) { t = { clave: claveT, titulo: ref ? `${ref.numero} ${ref.titulo}` : null, retos: [] }; g.temas.push(t); }
      t.retos.push(r);
      g.total += 1;
      if (r.estado === 'aprobado') g.hechos += 1;
    }
    return out;
  }, [visibles]);

  if (cargando) return (
    <div className="animate-fade-up">
      <PageHeader title="Retos" subtitle="Desafíos de programación para practicar lo que vas aprendiendo." />
      <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
    </div>
  );

  if (acceso && !acceso.acceso) return (
    <div className="animate-fade-up">
      <PageHeader title="Retos" subtitle="Desafíos de programación para practicar lo que vas aprendiendo." />
      <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card px-4 py-20 text-center">
        <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-subtle text-muted"><Lock className="h-7 w-7" /></div>
        <h2 className="font-display text-lg font-bold text-fg">Los retos aún no están disponibles</h2>
        <p className="mt-1 max-w-md text-sm text-muted">{acceso.motivo}</p>
        <p className="mt-3 text-xs text-muted">Tu nivel actual: <b className="text-fg">{acceso.nivel_label}</b></p>
      </div>
    </div>
  );

  const info = TIPOS_RETO[tipo];
  const hayFiltro = q.trim().length > 0 || filtro !== 'todos';

  return (
    <div className="animate-fade-up">
      <PageHeader title="Retos" subtitle="Desafíos de programación para practicar lo que vas aprendiendo. Ves los de tu nivel en cada tema." />

      {/* 1 · Tipo de reto */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2" role="tablist" aria-label="Tipo de reto">
        {(Object.keys(TIPOS_RETO) as TipoReto[]).map((t) => {
          const d = TIPOS_RETO[t];
          const sel = t === tipo;
          return (
            <button key={t} role="tab" aria-selected={sel} onClick={() => { setFiltro('todos'); router.replace(`/retos?tipo=${t}`); }}
              className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${sel ? 'bg-card shadow-soft' : 'border-line bg-card opacity-70 hover:opacity-100'}`}
              style={sel ? { borderColor: d.color } : undefined}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ color: d.color, backgroundColor: `${d.color}1F` }}><d.Icono className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block font-display text-lg font-bold text-fg">{d.nombre} <span className="text-sm font-semibold text-muted">· {cuenta[t]}</span></span>
                <span className="mt-0.5 block text-sm text-muted">
                  {t === 'bug' ? 'Recibes un programa con un error: encuéntralo y corrígelo.' : 'Te plantean un problema y escribes el programa desde cero.'}
                </span>
                <span className="mt-1 block text-xs font-medium text-muted">
                  {t === 'bug' ? 'Sabes al instante si lo lograste.' : 'Lo entregas y tu docente lo revisa.'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {delTipo.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card px-4 py-16 text-center">
          <Target className="mb-3 h-9 w-9 text-muted" />
          <h2 className="font-display text-lg font-bold text-fg">Aún no hay retos de «{info.nombre}» para ti</h2>
          <p className="mt-1 max-w-sm text-sm text-muted">Aparecen aquí cuando tu docente publica uno de tu nivel en un tema que ya abriste.</p>
        </div>
      ) : (
        <>
          {/* 2 · Cómo voy: también filtra la lista */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" role="group" aria-label="Filtrar por estado">
            <BotonEstado activo={filtro === 'todos'} onClick={() => setFiltro('todos')} numero={delTipo.length} texto="Todos" color="#6366F1" />
            {ORDEN_ESTADO.map((e) => (
              <BotonEstado key={e} activo={filtro === e} onClick={() => setFiltro(filtro === e ? 'todos' : e)} numero={porEstado[e]} texto={ESTADO[e].plural} color={ESTADO[e].color} />
            ))}
          </div>

          <div className="relative mb-6 max-w-md">
            <label htmlFor="buscar-reto" className="sr-only">Buscar reto por título o tema</label>
            <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
            <input id="buscar-reto" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título o tema…" className="input pl-11 pr-10" />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-subtle hover:text-fg"><X className="h-4 w-4" /></button>
            )}
          </div>

          {/* 3 · Lista por unidad y tema */}
          {visibles.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card px-4 py-12 text-center">
              <p className="font-semibold text-fg">No hay retos con ese filtro</p>
              {hayFiltro && <button onClick={() => { setQ(''); setFiltro('todos'); }} className="btn-ghost mt-3">Ver todos</button>}
            </div>
          ) : (
            <div className="space-y-5">
              {grupos.map((g) => (
                <section key={g.clave} className="card !p-0">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                    <h2 className="font-display text-lg font-bold text-fg">{g.titulo}</h2>
                    <span className="text-xs font-semibold text-muted">{g.hechos} de {g.total} completados</span>
                  </header>
                  {g.temas.map((t) => (
                    <div key={t.clave}>
                      {t.titulo && <h3 className="bg-subtle/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">{t.titulo}</h3>}
                      <ol className="divide-y divide-line">
                        {t.retos.map((r, i) => <FilaReto key={r.id} r={r} numero={i + 1} />)}
                      </ol>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BotonEstado({ activo, onClick, numero, texto, color }: { activo: boolean; onClick: () => void; numero: number; texto: string; color: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo}
      className={`rounded-xl border-2 px-3 py-2 text-left transition ${activo ? 'bg-card shadow-soft' : 'border-line bg-card hover:bg-subtle'}`}
      style={activo ? { borderColor: color } : undefined}>
      <span className="block font-display text-xl font-extrabold leading-none" style={{ color: activo || numero > 0 ? color : undefined }}>{numero}</span>
      <span className="mt-1 block text-xs font-semibold text-muted">{texto}</span>
    </button>
  );
}

function FilaReto({ r, numero }: { r: RetoEstudiante; numero: number }) {
  const e = ESTADO[r.estado];
  const nivel = r.nivel_dificultad ?? nivelDesdeEstrellas(r.estrellas);
  const limite = r.fecha_limite && r.estado !== 'aprobado' ? new Date(r.fecha_limite) : null;
  const vencido = limite ? limite.getTime() < Date.now() : false;
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ color: e.color, backgroundColor: `${e.color}1F` }} title={e.nombre}>
        {r.estado === 'nuevo' ? <span className="text-sm font-bold">{numero}</span> : <e.Icono className="h-[18px] w-[18px]" />}
      </span>
      <div className="min-w-[200px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-fg">{r.titulo}</p>
          <SelloReto estado={r.estado} />
        </div>
        <FuentePractica fuente={r.fuente_practica} className="my-1" />
        <p className="line-clamp-1 text-sm text-muted">{r.enunciado}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {r.estado === 'incompleto' && (r.intentos_fallidos ?? 0) > 0 && (
            <span className="font-semibold" style={{ color: e.color }}>{r.intentos_fallidos} {r.intentos_fallidos === 1 ? 'intento' : 'intentos'}</span>
          )}
          <span className="font-semibold" style={{ color: NIVEL_COLOR[nivel] }}>Nivel {NIVEL_LABEL[nivel]}</span>
          <span className="text-muted">{r.estado === 'aprobado' ? `+${r.xp_obtenido} XP ganados` : `+${r.xp} XP`}</span>
          {limite && (
            <span className={`inline-flex items-center gap-1 font-semibold ${vencido ? 'text-prexi-red' : 'text-prexi-amber'}`}>
              <Clock className="h-3 w-3" /> {vencido ? 'Venció el' : 'Hasta el'} {limite.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </p>
        {r.feedback && r.estado === 'incompleto' && (
          <p className="mt-1.5 rounded-lg bg-prexi-amber/10 px-3 py-1.5 text-xs text-fg"><b>Tu docente dice:</b> {r.feedback}</p>
        )}
      </div>
      <Link href={`/retos/${r.id}`} className={`${r.estado === 'nuevo' || r.estado === 'en_curso' || r.estado === 'incompleto' ? 'btn-primary' : 'btn-ghost'} shrink-0 !py-1.5 text-sm`}>
        {e.accion} <ArrowRight className="h-4 w-4" />
      </Link>
    </li>
  );
}
