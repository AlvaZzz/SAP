'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { DocenteDocumento, OpcionTema } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton, Modal, Field, Input, Textarea, Select, EmptyState, ResponsiveTable } from '@/components/ui';
import { SelectorTema } from '@/components/docente/selector-tema';
import { Upload, FileText, Trash2, Edit, Download, Bot } from '@/components/icons';

const MAX_MB = 15;

export default function DocenteDocumentosPage() {
  const [docs, setDocs] = useState<DocenteDocumento[]>([]);
  const [temas, setTemas] = useState<OpcionTema[]>([]);
  const [cargando, setCargando] = useState(true);

  // Formulario de subida.
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [temaId, setTemaId] = useState<number | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Edición de metadatos.
  const [editDoc, setEditDoc] = useState<DocenteDocumento | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTemaId, setEditTemaId] = useState<number | null>(null);

  async function cargar() {
    setCargando(true);
    try { const r = await api.get<{ documentos: DocenteDocumento[] }>('/docente/documentos'); setDocs(r.documentos); }
    catch { /* noop */ } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);
  useEffect(() => { api.get<{ temas: OpcionTema[] }>('/docente/unidades/temas/opciones').then((r) => setTemas(r.temas)).catch(() => undefined); }, []);

  function elegirArchivo(f: File | null) {
    setError('');
    if (!f) { setArchivo(null); return; }
    if (f.type !== 'application/pdf') { setError('Solo se aceptan archivos PDF.'); setArchivo(null); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`El PDF supera el límite de ${MAX_MB} MB.`); setArchivo(null); return; }
    setArchivo(f);
    if (!titulo) setTitulo(f.name.replace(/\.pdf$/i, ''));
  }

  async function subir() {
    setError('');
    if (titulo.trim().length < 3) { setError('El título debe tener al menos 3 caracteres.'); return; }
    if (!archivo) { setError('Selecciona un archivo PDF.'); return; }
    setSubiendo(true);
    const fd = new FormData();
    fd.append('titulo', titulo.trim());
    if (descripcion.trim()) fd.append('descripcion', descripcion.trim());
    if (temaId != null) fd.append('temaId', String(temaId));
    fd.append('archivo', archivo);
    try {
      // Multipart: fetch directo (no el cliente JSON) para que el navegador fije el boundary.
      const res = await fetch('/api/docente/documentos', { method: 'POST', body: fd, credentials: 'include' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'No se pudo subir'); }
      setTitulo(''); setDescripcion(''); setTemaId(null); setArchivo(null);
      if (fileRef.current) fileRef.current.value = '';
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo subir'); }
    finally { setSubiendo(false); }
  }

  function abrirEditar(d: DocenteDocumento) {
    setEditDoc(d); setEditTitulo(d.titulo); setEditDesc(d.descripcion ?? ''); setEditTemaId(d.temaId);
  }
  async function guardarEdicion() {
    if (!editDoc) return;
    await api.put(`/docente/documentos/${editDoc.id}`, {
      titulo: editTitulo.trim(), descripcion: editDesc.trim() || undefined,
      // `null` (no `undefined`) para poder DESASIGNAR el tema: undefined significa
      // "no tocar el campo" y dejaba el documento pegado a su tema para siempre.
      temaId: editTemaId,
    }).catch((e) => setError(e instanceof ApiError ? e.message : 'Error'));
    setEditDoc(null); await cargar();
  }
  async function eliminar(d: DocenteDocumento) {
    if (!confirm(`¿Eliminar "${d.titulo}"?`)) return;
    await api.del(`/docente/documentos/${d.id}`).catch(() => undefined); await cargar();
  }

  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  const fecha = (f: string) => new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="animate-fade-up">
      <PageHeader title="Gestión de documentos" subtitle="Sube material PDF para tus estudiantes." />

      {/* `grid-cols-1` NO es decorativo: sin el, la rejilla usa una pista
          IMPLICITA de tipo `auto`, que se dimensiona por el min-content de su
          contenido. Un <select> aporta como min-content su opcion mas larga y
          con `white-space: pre` no puede partirse, asi que la pista crecia a
          758px dentro de un contenedor de 329px. `grid-cols-1` genera
          `minmax(0, 1fr)`: pista definida, minimo cero, y el select pasa a
          seguir al contenedor. Ni `max-w-full` ni `min-w-0` lo arreglaban. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Zona de carga */}
        {/* `min-w-0`: item de rejilla, arranca en `min-width: auto` y sin esto
            no encoge por debajo de su contenido (el area de subida y sus textos
            desbordaban 401px a 375px de ancho). */}
        <Card className="min-w-0 lg:col-span-1">
          <h2 className="mb-4 font-display text-lg font-bold text-fg">Subir PDF</h2>
          {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}

          <button type="button" onClick={() => fileRef.current?.click()}
            className={`mb-4 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${archivo ? 'border-prexi-blue bg-prexi-blue/5' : 'border-line hover:border-prexi-blue/50 hover:bg-subtle'}`}>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-prexi-blue/10 text-prexi-blue-deep"><Upload className="h-6 w-6" /></div>
            {archivo ? <span className="text-sm font-medium text-fg">{archivo.name} · {mb(archivo.size)}</span>
              : <><span className="text-sm font-medium text-fg">Haz clic para elegir un PDF</span><span className="text-xs text-muted">Máx. {MAX_MB} MB</span></>}
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} />

          <div className="space-y-3">
            <Field label="Título"><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Guía de funciones" /></Field>
            <SelectorTema
              temas={temas}
              valor={temaId}
              onChange={setTemaId}
              hint="Ubica el material en el temario: así tus estudiantes lo encuentran junto al tema que estudian. El tutor PREXI también lo usará como referencia y podrás generar preguntas desde él."
            />
            <Field label="Descripción (opcional)"><Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Breve descripción del material." /></Field>
            <button onClick={subir} disabled={subiendo} className="btn-primary w-full">{subiendo ? 'Subiendo…' : <><Upload className="h-4 w-4" /> Subir documento</>}</button>
          </div>
        </Card>

        {/* Tabla de documentos */}
        <div className="lg:col-span-2">
          {cargando ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            : docs.length === 0 ? <EmptyState icon={<FileText className="h-7 w-7" />} title="Sin documentos" hint="Sube tu primer PDF con el formulario de la izquierda." />
              : (
                <ResponsiveTable
                  rows={docs}
                  rowKey={(d) => d.id}
                  cols={[
                    {
                      header: 'Documento',
                      cell: (d) => (
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-500"><FileText className="h-4 w-4" /></div>
                          <div className="min-w-0"><p className="truncate font-semibold text-fg">{d.titulo}</p>{d.descripcion && <p className="truncate text-xs text-muted">{d.descripcion}</p>}</div>
                        </div>
                      ),
                    },
                    { header: 'Tema', cell: (d) => d.tema_titulo ? <Badge tone="green">{d.tema_titulo}</Badge> : <span className="text-muted">—</span> },
                    { header: 'Tamaño', cell: (d) => <span className="text-muted">{mb(d.tamano_bytes)}</span> },
                    { header: 'Fecha', cell: (d) => <span className="whitespace-nowrap text-muted">{fecha(d.fecha)}</span> },
                    { header: 'Acciones', align: 'right', cardHidden: true, cell: (d) => <AccionesDoc d={d} onEditar={abrirEditar} onEliminar={eliminar} /> },
                  ]}
                  card={(d) => (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-500"><FileText className="h-5 w-5" /></div>
                        <div className="min-w-0"><p className="font-semibold text-fg">{d.titulo}</p>{d.descripcion && <p className="truncate text-xs text-muted">{d.descripcion}</p>}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        {d.tema_titulo && <Badge tone="green">{d.tema_titulo}</Badge>}
                        <span>{mb(d.tamano_bytes)}</span><span>· {fecha(d.fecha)}</span>
                      </div>
                      <AccionesDoc d={d} onEditar={abrirEditar} onEliminar={eliminar} grandes />
                    </div>
                  )}
                />
              )}
        </div>
      </div>

      <Modal open={!!editDoc} onClose={() => setEditDoc(null)} title="Editar documento"
        footer={<>
          <button onClick={() => setEditDoc(null)} className="btn-ghost">Cancelar</button>
          <button onClick={guardarEdicion} className="btn-primary">Guardar</button>
        </>}>
        <div className="space-y-4">
          <Field label="Título"><Input value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} /></Field>
          <SelectorTema temas={temas} valor={editTemaId} onChange={setEditTemaId} />
          <Field label="Descripción"><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/** Acciones de un documento. `grandes` = área táctil ≥44px para móvil. */
function AccionesDoc({ d, onEditar, onEliminar, grandes = false }: {
  d: DocenteDocumento; onEditar: (d: DocenteDocumento) => void; onEliminar: (d: DocenteDocumento) => void; grandes?: boolean;
}) {
  const s = grandes ? 'h-10 w-10' : 'h-8 w-8';
  return (
    <div className={`flex items-center gap-1 ${grandes ? '' : 'justify-end'}`}>
      {d.temaId && d.tiene_texto && (
        <Link href={`/docente/preguntas-ia?documento=${d.id}&tema=${d.temaId}`} title="Generar preguntas con el tutor PREXI" className={`grid ${s} place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-blue-deep ${grandes ? 'border border-line' : ''}`}><Bot className="h-4 w-4" /></Link>
      )}
      <a href={`/api/documentos/${d.id}/archivo`} target="_blank" rel="noreferrer" title="Ver PDF" className={`grid ${s} place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-blue-deep ${grandes ? 'border border-line' : ''}`}><Download className="h-4 w-4" /></a>
      <button onClick={() => onEditar(d)} title="Editar" className={`grid ${s} place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-blue-deep ${grandes ? 'border border-line' : ''}`}><Edit className="h-4 w-4" /></button>
      <button onClick={() => onEliminar(d)} title="Eliminar" className={`grid ${s} place-items-center rounded-lg text-muted transition hover:bg-card hover:text-prexi-red ${grandes ? 'border border-line' : ''}`}><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
