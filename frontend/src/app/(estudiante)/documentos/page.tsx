'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Skeleton } from '@/components/ui';
import { Search, BookOpen, FileText, Download, Eye, Lightbulb } from '@/components/icons';

interface Doc { id: number; titulo: string; descripcion: string | null; archivo: string; tamano_bytes: number; nivel: string | null; subido_por: string; fecha: string }

export default function DocumentosPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ documentos: Doc[] }>('/documentos').then((r) => setDocs(r.documentos)).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => docs.filter((d) => d.titulo.toLowerCase().includes(q.toLowerCase())), [docs, q]);
  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  const fecha = (f: string) => new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="animate-fade-up">
      <PageHeader title="Documentos del curso" subtitle="Material compartido por tus docentes." />

      <div className="relative mb-6 max-w-xl">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documento…" className="input pl-11" />
      </div>

      {cargando ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((d) => (
            <div key={d.id} className="card card-hover flex flex-col">
              <div className="mb-4 flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-500"><FileText className="h-7 w-7" /></div>
                <div className="min-w-0">
                  <p className="truncate font-display font-bold text-fg">{d.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted">Por <b className="font-semibold text-fg">{d.subido_por}</b></p>
                  <p className="text-xs text-muted">{fecha(d.fecha)} · <span className="font-medium text-prexi-blue-deep">{mb(d.tamano_bytes)}</span></p>
                </div>
              </div>
              {d.descripcion && <p className="mb-4 line-clamp-2 flex-1 text-sm text-muted">{d.descripcion}</p>}
              <div className="mt-auto flex gap-2">
                <a href={d.archivo} target="_blank" rel="noreferrer" className="btn-primary flex-1 !py-2 text-sm"><Eye className="h-4 w-4" /> Ver</a>
                <a href={d.archivo} download className="btn-ghost flex-1 !py-2 text-sm"><Download className="h-4 w-4" /> Descargar</a>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="card col-span-full flex items-center gap-3 text-muted"><BookOpen className="h-5 w-5" /> No hay documentos que coincidan.</div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-prexi-blue/20 bg-prexi-blue/[0.06] p-4 text-sm text-fg">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-prexi-blue-deep" />
        <p>Todos los documentos están disponibles para descarga. Se recomienda revisarlos antes de las sesiones prácticas de laboratorio.</p>
      </div>
    </div>
  );
}
