'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DocumentoEstudiante } from '@/lib/types';
import { PageHeader, Skeleton } from '@/components/ui';
import { Search, FileText, Download, Eye, Lightbulb, X } from '@/components/icons';

/** Documento sin tema: cae en un grupo "General" al final del listado. */
const GENERAL = { clave: 'general' };

interface Grupo {
  clave: string;
  unidad: { numero: number; titulo: string } | null;
  temas: { clave: string; titulo: string | null; docs: DocumentoEstudiante[] }[];
  total: number;
}

/** Unidad seleccionada en los chips: número, 'general' (sin categoría) o null (todas). */
type Seleccion = number | 'general' | null;

export default function DocumentosPage() {
  const [docs, setDocs] = useState<DocumentoEstudiante[]>([]);
  const [q, setQ] = useState('');
  const [unidadSel, setUnidadSel] = useState<Seleccion>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ documentos: DocumentoEstudiante[] }>('/documentos')
      .then((r) => setDocs(r.documentos))
      .catch(() => undefined)
      .finally(() => setCargando(false));
  }, []);

  // Chips de unidad: solo las que REALMENTE tienen material.
  const unidades = useMemo(() => {
    const m = new Map<number, { numero: number; titulo: string; n: number }>();
    for (const d of docs) {
      if (!d.unidad) continue;
      const prev = m.get(d.unidad.numero);
      m.set(d.unidad.numero, { numero: d.unidad.numero, titulo: d.unidad.titulo, n: (prev?.n ?? 0) + 1 });
    }
    return [...m.values()].sort((a, b) => a.numero - b.numero);
  }, [docs]);

  const sinCategoria = useMemo(() => docs.filter((d) => !d.unidad).length, [docs]);

  // Búsqueda en TIEMPO REAL sobre título, descripción, unidad, tema/subtema y
  // docente. Se normaliza (minúsculas + sin acentos) para que "programacion"
  // encuentre "Programación".
  const filtrados = useMemo(() => {
    const t = normalizar(q);
    return docs.filter((d) => {
      if (unidadSel === 'general' && d.unidad) return false;
      if (typeof unidadSel === 'number' && d.unidad?.numero !== unidadSel) return false;
      if (!t) return true;
      return campos(d).some((c) => normalizar(c).includes(t));
    });
  }, [docs, q, unidadSel]);

  // Agrupación UNIDAD → TEMA (el backend ya entrega el orden académico correcto,
  // así que basta con recorrer en orden y no hay que reordenar aquí).
  const grupos = useMemo<Grupo[]>(() => {
    const out: Grupo[] = [];
    for (const d of filtrados) {
      const claveU = d.unidad ? `u${d.unidad.numero}` : GENERAL.clave;
      let g = out.find((x) => x.clave === claveU);
      if (!g) { g = { clave: claveU, unidad: d.unidad, temas: [], total: 0 }; out.push(g); }

      const claveT = d.tema ? `t${d.tema.id}` : 'sin-tema';
      let t = g.temas.find((x) => x.clave === claveT);
      if (!t) { t = { clave: claveT, titulo: d.tema ? `${d.tema.numero} ${d.tema.titulo}` : null, docs: [] }; g.temas.push(t); }

      t.docs.push(d);
      g.total++;
    }
    return out;
  }, [filtrados]);

  const hayFiltro = q.trim().length > 0 || unidadSel != null;
  const limpiar = () => { setQ(''); setUnidadSel(null); };

  return (
    <div className="animate-fade-up">
      <PageHeader title="Documentos del curso" subtitle="Material compartido por tus docentes, organizado por unidad y tema." />

      {/* Buscador */}
      <div className="mb-4 max-w-xl">
        <label htmlFor="buscar-doc" className="sr-only">Buscar documento por título, unidad, tema o docente</label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
          <input
            id="buscar-doc"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, unidad, tema o docente…"
            className="input pl-11 pr-10"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-subtle hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filtros rápidos por unidad */}
      {unidades.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filtrar por unidad">
          <Chip activo={unidadSel === null} onClick={() => setUnidadSel(null)}>Todas ({docs.length})</Chip>
          {unidades.map((u) => (
            <Chip key={u.numero} activo={unidadSel === u.numero} onClick={() => setUnidadSel(u.numero)} title={u.titulo}>
              Unidad {u.numero} ({u.n})
            </Chip>
          ))}
          {sinCategoria > 0 && (
            <Chip activo={unidadSel === 'general'} onClick={() => setUnidadSel('general')} title="Material sin unidad asignada">
              General ({sinCategoria})
            </Chip>
          )}
        </div>
      )}

      {cargando ? (
        <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtrados.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card px-4 py-16 text-center">
          <Search className="mb-3 h-9 w-9 text-muted" />
          <h2 className="font-display text-lg font-bold text-fg">
            {q.trim() ? <>No se encontraron documentos para “{q.trim()}”</> : 'No hay documentos en esta unidad'}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {docs.length === 0
              ? 'Todavía no hay material publicado. Vuelve más tarde.'
              : 'Prueba con otro término o revisa otra unidad.'}
          </p>
          {hayFiltro && docs.length > 0 && <button onClick={limpiar} className="btn-ghost mt-4">Quitar filtros</button>}
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <section key={g.clave} className="card !p-0">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <h2 className="font-display text-lg font-bold text-fg">{g.unidad ? `Unidad ${g.unidad.numero}: ${g.unidad.titulo}` : 'Material general del curso'}</h2>
                <span className="text-xs font-semibold text-muted">{g.total} {g.total === 1 ? 'documento' : 'documentos'}</span>
              </header>
              {g.temas.map((t) => (
                <div key={t.clave}>
                  {t.titulo && <h3 className="bg-subtle/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">{t.titulo}</h3>}
                  <ul className="divide-y divide-line">
                    {t.docs.map((d) => <FilaDoc key={d.id} d={d} />)}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-prexi-blue/20 bg-prexi-blue/[0.06] p-4 text-sm text-fg">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-prexi-blue-deep" />
        <p>«Abrir» muestra el PDF en una pestaña nueva; «Descargar» lo guarda en tu dispositivo.</p>
      </div>
    </div>
  );
}

/** Campos sobre los que busca el filtro de texto. */
function campos(d: DocumentoEstudiante): string[] {
  return [
    d.titulo,
    d.descripcion ?? '',
    d.subido_por,
    d.unidad ? `Unidad ${d.unidad.numero} ${d.unidad.titulo}` : '',
    d.tema ? `${d.tema.numero} ${d.tema.titulo}` : '',
    d.subtema ? `${d.subtema.numero} ${d.subtema.titulo}` : '',
  ];
}

/** Minúsculas y sin acentos: "programacion" debe encontrar "Programación". */
function normalizar(s: string): string {
  // NFD separa la tilde en un carácter combinante (U+0300–U+036F) que aquí se descarta.
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function Chip({ children, activo, onClick, title }: {
  children: React.ReactNode; activo: boolean; onClick: () => void; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={activo}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
        activo
          ? 'border-prexi-blue bg-prexi-blue text-accent-on'
          : 'border-line bg-card text-muted hover:border-prexi-blue/40 hover:text-fg'}`}
    >
      {children}
    </button>
  );
}

function FilaDoc({ d }: { d: DocumentoEstudiante }) {
  const mb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const fecha = (f: string) => new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-500"><FileText className="h-5 w-5" /></span>
      <div className="min-w-[200px] flex-1">
        <p className="font-semibold text-fg">{d.titulo}</p>
        {d.descripcion && <p className="line-clamp-2 text-sm text-muted">{d.descripcion}</p>}
        <p className="mt-0.5 text-xs text-muted">
          {d.subtema && <span className="font-semibold text-fg">{d.subtema.numero} {d.subtema.titulo} · </span>}
          PDF · {mb(d.tamano_bytes)} · {d.subido_por} · {fecha(d.fecha)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <a href={d.archivo} target="_blank" rel="noreferrer" className="btn-primary !py-1.5 text-sm"><Eye className="h-4 w-4" /> Abrir</a>
        <a href={d.archivo} download title="Descargar" aria-label={`Descargar ${d.titulo}`} className="btn-ghost !px-3 !py-1.5 text-sm"><Download className="h-4 w-4" /><span className="hidden sm:inline"> Descargar</span></a>
      </div>
    </li>
  );
}
