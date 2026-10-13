'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DocenteDocumento, OpcionTema } from '@/lib/types';
import { PageHeader, Card, Skeleton, Modal, Field, Input, Textarea } from '@/components/ui';
import { SelectorTema } from '@/components/docente/selector-tema';
import { Upload, FileText, Trash2, Edit, Eye, Plus, Search, X, CheckCircle, AlertTriangle, Bot } from '@/components/icons';

const MAX_MB = 15;
const mb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fecha = (f: string) => new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });

interface Grupo { clave: string; titulo: string; temas: { clave: string; titulo: string | null; docs: DocenteDocumento[] }[]; total: number }

/**
 * DOCUMENTOS del docente: el material en PDF que comparte con sus estudiantes.
 * Subir es un panel de tres pasos (archivo, tema, nombre); debajo, la lista
 * ordenada por unidad y tema, igual que la ve el estudiante.
 */
export default function DocenteDocumentosPage() {
  const [docs, setDocs] = useState<DocenteDocumento[] | null>(null);
  const [temas, setTemas] = useState<OpcionTema[]>([]);
  const [q, setQ] = useState('');
  const [subiendoPanel, setSubiendoPanel] = useState(false);
  const [aviso, setAviso] = useState('');

  // Subida
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [temaId, setTemaId] = useState<number | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Edición
  const [editDoc, setEditDoc] = useState<DocenteDocumento | null>(null);
  const [edit, setEdit] = useState({ titulo: '', descripcion: '', temaId: null as number | null });
  const [errorEdit, setErrorEdit] = useState('');

  const cargar = useCallback(async () => {
    const r = await api.get<{ documentos: DocenteDocumento[] }>('/docente/documentos').catch(() => null);
    setDocs(r?.documentos ?? []);
  }, []);
  useEffect(() => {
    cargar();
    api.get<{ temas: OpcionTema[] }>('/docente/unidades/temas/opciones').then((r) => setTemas(r.temas)).catch(() => undefined);
  }, [cargar]);

  function elegirArchivo(f: File | null) {
    setError('');
    if (!f) return;
    if (f.type !== 'application/pdf') { setError('Ese archivo no es un PDF. Solo se pueden subir archivos PDF.'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`Ese PDF pesa ${mb(f.size)}. El máximo es ${MAX_MB} MB.`); return; }
    setArchivo(f);
    if (!titulo.trim()) setTitulo(f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '));
  }

  function limpiarSubida() {
    setArchivo(null); setTemaId(null); setTitulo(''); setDescripcion(''); setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function subir() {
    if (!archivo) { setError('Primero elige el archivo PDF.'); return; }
    if (titulo.trim().length < 3) { setError('Escribe un nombre para el documento (al menos 3 letras).'); return; }
    setSubiendo(true); setError('');
    const fd = new FormData();
    fd.append('titulo', titulo.trim());
    if (descripcion.trim()) fd.append('descripcion', descripcion.trim());
    if (temaId != null) fd.append('temaId', String(temaId));
    fd.append('archivo', archivo);
    try {
      const r = await api.upload<{ texto_extraido?: boolean }>('/docente/documentos', fd);
      setAviso(r.texto_extraido === false
        ? `«${titulo.trim()}» se subió. Es un PDF escaneado: tus estudiantes lo pueden leer, pero PREXI no puede usarlo.`
        : `«${titulo.trim()}» se subió. Tus estudiantes ya lo pueden ver.`);
      limpiarSubida(); setSubiendoPanel(false);
      await cargar();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo subir el documento. Intenta de nuevo.'); }
    finally { setSubiendo(false); }
  }

  function abrirEditar(d: DocenteDocumento) {
    setEditDoc(d); setErrorEdit('');
    setEdit({ titulo: d.titulo, descripcion: d.descripcion ?? '', temaId: d.temaId });
  }
  async function guardarEdicion() {
    if (!editDoc) return;
    if (edit.titulo.trim().length < 3) { setErrorEdit('Escribe un nombre de al menos 3 letras.'); return; }
    try {
      // `null` (no `undefined`) permite QUITAR el tema del documento.
      await api.put(`/docente/documentos/${editDoc.id}`, { titulo: edit.titulo.trim(), descripcion: edit.descripcion.trim() || undefined, temaId: edit.temaId });
      setEditDoc(null); await cargar();
    } catch (e) { setErrorEdit(e instanceof ApiError ? e.message : 'No se pudo guardar.'); }
  }
  async function eliminar(d: DocenteDocumento) {
    if (!confirm(`¿Eliminar «${d.titulo}»? Tus estudiantes dejarán de verlo.`)) return;
    await api.del(`/docente/documentos/${d.id}`).catch(() => undefined);
    setAviso(''); await cargar();
  }

  // Unidad → tema, en el orden del temario.
  const grupos = useMemo<Grupo[]>(() => {
    const texto = q.trim().toLowerCase();
    const visibles = (docs ?? []).filter((d) => !texto || `${d.titulo} ${d.descripcion ?? ''} ${d.tema_titulo ?? ''}`.toLowerCase().includes(texto));
    const porId = new Map(temas.map((t, i) => [t.id, { ...t, pos: i }]));
    const mapa = new Map<string, Grupo & { orden: number }>();
    for (const d of visibles) {
      const t = d.temaId != null ? porId.get(d.temaId) : undefined;
      const clave = t ? `u${t.unidad_id}` : 'general';
      const g = mapa.get(clave) ?? { clave, titulo: t ? `Unidad ${t.unidad_numero}: ${t.unidad_titulo}` : 'Material general (sin tema)', temas: [], total: 0, orden: t ? t.unidad_numero : 9999 };
      const claveT = t ? `t${t.id}` : 'sin';
      let fila = g.temas.find((x) => x.clave === claveT);
      if (!fila) { fila = { clave: claveT, titulo: t ? `${t.numero} ${t.titulo}` : null, docs: [] }; g.temas.push(fila); }
      fila.docs.push(d); g.total += 1;
      mapa.set(clave, g);
    }
    const pos = (clave: string) => porId.get(Number(clave.slice(1)))?.pos ?? 0;
    return [...mapa.values()].sort((a, b) => a.orden - b.orden).map((g) => ({ ...g, temas: [...g.temas].sort((a, b) => pos(a.clave) - pos(b.clave)) }));
  }, [docs, temas, q]);

  const total = docs?.length ?? 0;
  const mostrarPanel = subiendoPanel || total === 0;
  const temaElegido = temas.find((t) => t.id === temaId);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Documentos" subtitle="Guías, apuntes y prácticas en PDF que compartes con tus estudiantes."
        action={total > 0 && !subiendoPanel ? <button onClick={() => { setSubiendoPanel(true); setAviso(''); }} className="btn-primary"><Plus className="h-4 w-4" /> Subir documento</button> : undefined} />

      {aviso && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-prexi-green/10 px-4 py-3 text-sm text-prexi-green" role="status">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{aviso}</span>
        </p>
      )}

      {/* Subir: tres pasos en un mismo panel */}
      {docs !== null && mostrarPanel && (
        <Card className="mb-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-fg">{total === 0 ? 'Sube tu primer documento' : 'Subir un documento'}</h2>
              <p className="mt-0.5 text-sm text-muted">Tres pasos. Al terminar, tus estudiantes lo ven en su sección Documentos.</p>
            </div>
            {total > 0 && <button onClick={() => { setSubiendoPanel(false); limpiarSubida(); }} className="btn-ghost text-sm"><X className="h-4 w-4" /> Cancelar</button>}
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Paso numero={1} titulo="Elige el PDF" hecho={!!archivo}>
              <button type="button" onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegirArchivo(e.dataTransfer.files?.[0] ?? null); }}
                className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition ${archivo ? 'border-prexi-green bg-prexi-green/5' : arrastrando ? 'border-prexi-blue bg-prexi-blue/10' : 'border-line hover:border-prexi-blue/60 hover:bg-subtle'}`}>
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${archivo ? 'bg-red-500/10 text-red-500' : 'bg-prexi-blue/10 text-prexi-blue-deep'}`}>{archivo ? <FileText className="h-6 w-6" /> : <Upload className="h-6 w-6" />}</span>
                {archivo ? (
                  <>
                    <span className="break-all text-sm font-semibold text-fg">{archivo.name}</span>
                    <span className="text-xs text-muted">{mb(archivo.size)} · toca para cambiarlo</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-fg">Toca aquí o arrastra el archivo</span>
                    <span className="text-xs text-muted">Solo PDF, hasta {MAX_MB} MB</span>
                  </>
                )}
              </button>
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)} />
            </Paso>

            <Paso numero={2} titulo="¿De qué tema es?" hecho={temaId != null}>
              <SelectorTema temas={temas} valor={temaId} onChange={setTemaId} />
              <p className="mt-2 text-xs text-muted">{temaElegido
                ? <>El estudiante lo encontrará junto a <b className="text-fg">{temaElegido.numero} {temaElegido.titulo}</b>.</>
                : 'Puedes dejarlo sin tema: aparecerá como material general del curso.'}</p>
            </Paso>

            <Paso numero={3} titulo="Ponle un nombre" hecho={titulo.trim().length >= 3}>
              <div className="space-y-3">
                <Field label="Nombre del documento"><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej.: Guía de bucles for y while" /></Field>
                <Field label="¿Qué contiene? (opcional)" hint="Una línea que le diga al estudiante para qué sirve.">
                  <Textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej.: 20 ejercicios resueltos paso a paso." />
                </Field>
              </div>
            </Paso>
          </div>

          {error && <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-prexi-red" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}
          <div className="mt-5 flex justify-end border-t border-line pt-4">
            <button onClick={subir} disabled={subiendo} className="btn-primary disabled:opacity-60"><Upload className="h-4 w-4" /> {subiendo ? 'Subiendo…' : 'Subir documento'}</button>
          </div>
        </Card>
      )}

      {/* Lista */}
      {docs === null ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : total > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-fg">Tus documentos <span className="text-sm font-semibold text-muted">{total}</span></h2>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input !py-2 pl-9 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o tema" aria-label="Buscar documento" />
            </div>
          </div>

          {grupos.length === 0 ? (
            <Card><p className="text-center text-sm text-muted">Ningún documento coincide con «{q.trim()}».</p></Card>
          ) : (
            <div className="space-y-5">
              {grupos.map((g) => (
                <section key={g.clave} className="card !p-0">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                    <h3 className="font-display text-lg font-bold text-fg">{g.titulo}</h3>
                    <span className="text-xs font-semibold text-muted">{g.total} {g.total === 1 ? 'documento' : 'documentos'}</span>
                  </header>
                  {g.temas.map((t) => (
                    <div key={t.clave}>
                      {t.titulo && <h4 className="bg-subtle/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted">{t.titulo}</h4>}
                      <ul className="divide-y divide-line">
                        {t.docs.map((d) => (
                          <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-500"><FileText className="h-5 w-5" /></span>
                            <div className="min-w-[200px] flex-1">
                              <p className="font-semibold text-fg">{d.titulo}</p>
                              {d.descripcion && <p className="line-clamp-2 text-sm text-muted">{d.descripcion}</p>}
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                                <span>PDF · {mb(d.tamano_bytes)} · {fecha(d.fecha)}</span>
                                {d.tiene_texto
                                  ? <span className="inline-flex items-center gap-1 font-semibold text-prexi-blue-deep"><Bot className="h-3.5 w-3.5" /> PREXI puede leerlo</span>
                                  : <span className="inline-flex items-center gap-1 font-semibold text-prexi-amber" title="Es un PDF escaneado (una imagen): los estudiantes lo ven, pero PREXI no puede usarlo."><AlertTriangle className="h-3.5 w-3.5" /> Escaneado: PREXI no lo lee</span>}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <a href={`/api/documentos/${d.id}/archivo`} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-1.5 text-sm"><Eye className="h-4 w-4" /> Abrir</a>
                              <button onClick={() => abrirEditar(d)} className="btn-ghost !px-3 !py-1.5 text-sm"><Edit className="h-4 w-4" /> Editar</button>
                              <button onClick={() => eliminar(d)} title="Eliminar" aria-label={`Eliminar ${d.titulo}`} className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-subtle hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={!!editDoc} onClose={() => setEditDoc(null)} title="Editar documento"
        footer={<>
          <button onClick={() => setEditDoc(null)} className="btn-ghost">Cancelar</button>
          <button onClick={guardarEdicion} className="btn-primary">Guardar cambios</button>
        </>}>
        <div className="space-y-4">
          {errorEdit && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red" role="alert">{errorEdit}</p>}
          <Field label="Nombre del documento"><Input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></Field>
          <SelectorTema temas={temas} valor={edit.temaId} onChange={(temaId) => setEdit({ ...edit, temaId })} hint="Cámbialo para mover el documento a otro tema." />
          <Field label="¿Qué contiene? (opcional)"><Textarea rows={2} value={edit.descripcion} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></Field>
          <p className="text-xs text-muted">Para cambiar el archivo, elimina este documento y sube el nuevo.</p>
        </div>
      </Modal>
    </div>
  );
}

function Paso({ numero, titulo, hecho, children }: { numero: number; titulo: string; hecho: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2.5 flex items-center gap-2">
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${hecho ? 'bg-prexi-green text-white' : 'bg-prexi-blue text-accent-on'}`}>{hecho ? <CheckCircle className="h-4 w-4" /> : numero}</span>
        <span className="font-semibold text-fg">{titulo}</span>
      </p>
      {children}
    </div>
  );
}
