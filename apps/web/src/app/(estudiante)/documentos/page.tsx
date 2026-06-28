'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Search, BookOpen, ArrowRight } from '@/components/icons';

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
    <div className="mx-auto max-w-4xl animate-fade-up">
      <h1 className="text-2xl font-extrabold text-prexi-navy">Documentos del curso</h1>
      <p className="mb-5 text-slate-500">Material compartido por tus docentes.</p>

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documento…" className="input pl-10" />
      </div>

      {cargando ? <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div> : (
        <div className="space-y-3">
          {filtrados.map((d) => (
            <div key={d.id} className="card card-hover flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-red-50 text-red-500"><span className="text-xs font-bold">PDF</span></div>
                <div>
                  <p className="font-semibold text-prexi-navy">{d.titulo}</p>
                  <p className="text-xs text-slate-500">Subido por: <b className="text-slate-600">{d.subido_por}</b> · {fecha(d.fecha)} · <span className="text-prexi-blue">{mb(d.tamano_bytes)}</span></p>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={d.archivo} target="_blank" rel="noreferrer" className="btn-primary !py-2 !px-4 text-sm">Ver</a>
                <a href={d.archivo} download className="btn-ghost !py-2 !px-4 text-sm">Descargar</a>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="card flex items-center gap-3 text-slate-400"><BookOpen className="h-5 w-5" /> No hay documentos que coincidan.</div>
          )}
        </div>
      )}

      <div className="mt-5 flex items-start gap-3 rounded-2xl bg-blue-50 p-4 text-sm text-slate-600">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue" />
        <p>Todos los documentos están disponibles para descarga. Se recomienda revisarlos antes de las sesiones prácticas de laboratorio.</p>
      </div>
    </div>
  );
}
