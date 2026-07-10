'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { PreguntaIa, OpcionTema, TipoEjercicio, DocenteDocumento } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton, Modal, Field, Input, Textarea, Select, EmptyState } from '@/components/ui';
import { Bot, Sparkles, CheckCircle, X, Edit, Upload } from '@/components/icons';

const MAX_MB = 15;

const TIPOS: { value: TipoEjercicio; label: string }[] = [
  { value: 'opcion_multiple', label: 'Opción múltiple' },
  { value: 'predecir_salida', label: 'Predecir salida' },
  { value: 'completar_codigo', label: 'Completar código' },
  { value: 'ordenar_lineas', label: 'Ordenar líneas (Parsons)' },
];

export default function DocentePreguntasIaPage() {
  const search = useSearchParams();
  const [documentos, setDocumentos] = useState<DocenteDocumento[]>([]);
  const [temas, setTemas] = useState<OpcionTema[]>([]);
  const [preguntas, setPreguntas] = useState<PreguntaIa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<'borrador' | 'aprobada' | 'rechazada'>('borrador');

  // Generación.
  const [documentoId, setDocumentoId] = useState(search.get('documento') ?? '');
  const [temaId, setTemaId] = useState(search.get('tema') ?? '');
  const [cantidad, setCantidad] = useState(5);
  const [tipo, setTipo] = useState<TipoEjercicio>('opcion_multiple');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  // Subida directa de PDF dentro de este módulo.
  const [subiendo, setSubiendo] = useState(false);
  const [ok, setOk] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function subirPdf(file: File | null) {
    setError(''); setOk('');
    if (!file) return;
    if (!temaId) { setError('Elige primero el tema destino para asociar el PDF.'); return; }
    if (file.type !== 'application/pdf') { setError('Solo se aceptan archivos PDF.'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`El PDF supera el límite de ${MAX_MB} MB.`); return; }
    setSubiendo(true);
    const fd = new FormData();
    fd.append('titulo', file.name.replace(/\.pdf$/i, '').slice(0, 120) || 'Material');
    fd.append('temaId', temaId);
    fd.append('archivo', file);
    try {
      const res = await fetch('/api/docente/documentos', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo subir el PDF');
      if (data.texto_extraido === false) { setError('El PDF se subió pero no tiene texto extraíble (¿es una imagen escaneada?). Sube un PDF con texto seleccionable.'); }
      else setOk('PDF subido y listo. Ya puedes generar preguntas.');
      // Refresca la lista y selecciona el PDF recién subido.
      const r = await api.get<{ documentos: DocenteDocumento[] }>('/docente/documentos');
      const conTexto = r.documentos.filter((d) => d.tiene_texto);
      setDocumentos(conTexto);
      if (data.id) setDocumentoId(String(data.id));
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo subir el PDF'); }
    finally { setSubiendo(false); }
  }

  // Edición/aprobación de un borrador.
  const [editando, setEditando] = useState<PreguntaIa | null>(null);
  const [formEdit, setFormEdit] = useState({ categoria: '', enunciado: '', codigoPython: '', respuestaCorrecta: '', explicacionIa: '' });
  const [aprobando, setAprobando] = useState<PreguntaIa | null>(null);
  const [formAprobar, setFormAprobar] = useState({ nivel: 1, estrellas: 3, xp: 50 });
  const [guardando, setGuardando] = useState(false);

  async function cargarPreguntas() {
    setCargando(true);
    try {
      const r = await api.get<{ preguntas: PreguntaIa[] }>(`/docente/preguntas-ia?estado=${filtroEstado}`);
      setPreguntas(r.preguntas);
    } catch { /* noop */ } finally { setCargando(false); }
  }
  useEffect(() => { cargarPreguntas(); /* eslint-disable-next-line */ }, [filtroEstado]);
  useEffect(() => {
    api.get<{ documentos: DocenteDocumento[] }>('/docente/documentos').then((r) => setDocumentos(r.documentos.filter((d) => d.tiene_texto))).catch(() => undefined);
    api.get<{ temas: OpcionTema[] }>('/docente/unidades/temas/opciones').then((r) => setTemas(r.temas)).catch(() => undefined);
  }, []);

  async function generar() {
    setError('');
    if (!documentoId) { setError('Selecciona el PDF del que se generarán las preguntas.'); return; }
    if (!temaId) { setError('Selecciona el tema al que se asociarán.'); return; }
    setGenerando(true);
    try {
      const r = await api.post<{ generadas: number }>('/docente/preguntas-ia/generar', {
        documentoId: Number(documentoId), temaId: Number(temaId), cantidad, tipo,
      });
      setFiltroEstado('borrador');
      await cargarPreguntas();
      if (r.generadas === 0) setError('ALVARO no generó preguntas nuevas. Intenta con otro material.');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudieron generar las preguntas'); }
    finally { setGenerando(false); }
  }

  function abrirEditar(p: PreguntaIa) {
    setEditando(p);
    setFormEdit({ categoria: p.categoria, enunciado: p.enunciado, codigoPython: p.codigoPython ?? '', respuestaCorrecta: p.respuestaCorrecta, explicacionIa: p.explicacionIa ?? '' });
  }
  async function guardarEdicion() {
    if (!editando) return;
    setGuardando(true);
    try {
      await api.put(`/docente/preguntas-ia/${editando.id}`, {
        categoria: formEdit.categoria.trim(), enunciado: formEdit.enunciado.trim(),
        codigoPython: formEdit.codigoPython.trim() || undefined, respuestaCorrecta: formEdit.respuestaCorrecta.trim(),
        explicacionIa: formEdit.explicacionIa.trim() || undefined,
      });
      setEditando(null); await cargarPreguntas();
    } catch (err) { alert(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  async function confirmarAprobar() {
    if (!aprobando) return;
    setGuardando(true);
    try {
      await api.post(`/docente/preguntas-ia/${aprobando.id}/aprobar`, formAprobar);
      setAprobando(null); await cargarPreguntas();
    } catch (err) { alert(err instanceof ApiError ? err.message : 'No se pudo aprobar'); }
    finally { setGuardando(false); }
  }
  async function rechazar(p: PreguntaIa) {
    if (!confirm('¿Rechazar esta pregunta propuesta por ALVARO? No podrás recuperarla.')) return;
    await api.post(`/docente/preguntas-ia/${p.id}/rechazar`).catch(() => undefined);
    await cargarPreguntas();
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Preguntas generadas por ALVARO" subtitle="ALVARO propone preguntas desde tus PDFs; tú las revisas, corriges y apruebas antes de publicarlas." />

      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-prexi-amber" /><h2 className="font-display text-lg font-bold text-fg">Generar nuevas preguntas</h2></div>
        {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}
        {ok && <p className="mb-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-prexi-green">{ok}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tema destino" hint="Las preguntas y el PDF se asocian a este tema.">
            <Select value={temaId} onChange={(e) => setTemaId(e.target.value)}>
              <option value="">Selecciona un tema…</option>
              {temas.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}
            </Select>
          </Field>
          <Field label="PDF de origen" hint="Elige uno subido o sube uno nuevo abajo.">
            <Select value={documentoId} onChange={(e) => setDocumentoId(e.target.value)}>
              <option value="">Selecciona un PDF…</option>
              {documentos.map((d) => <option key={d.id} value={d.id}>{d.titulo}</option>)}
            </Select>
          </Field>
          <Field label="Tipo de pregunta">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEjercicio)}>{TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
          </Field>
          <Field label="Cantidad">
            <Input type="number" min={1} max={10} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
          </Field>
        </div>

        {/* Subida directa de PDF (input file + drag & drop) */}
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); subirPdf(e.dataTransfer.files?.[0] ?? null); }}
          onClick={() => fileRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${arrastrando ? 'border-prexi-blue bg-prexi-blue/10' : 'border-line hover:border-prexi-blue/50 hover:bg-subtle'}`}>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-prexi-blue/10 text-prexi-blue-deep"><Upload className="h-5 w-5" /></div>
          {subiendo ? <span className="text-sm font-medium text-fg">Subiendo y extrayendo texto…</span>
            : <><span className="text-sm font-medium text-fg">Arrastra un PDF aquí o haz clic para subirlo</span><span className="text-xs text-muted">Solo PDF · máx. {MAX_MB} MB · elige el tema primero</span></>}
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => subirPdf(e.target.files?.[0] ?? null)} />
        </div>

        <button onClick={generar} disabled={generando || subiendo} className="btn-primary mt-4">
          {generando ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> ALVARO está generando…</> : <><Bot className="h-4 w-4" /> Generar preguntas</>}
        </button>
      </Card>

      <div className="mb-4 flex items-center gap-2">
        {(['borrador', 'aprobada', 'rechazada'] as const).map((e) => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition ${filtroEstado === e ? 'bg-prexi-blue text-white' : 'bg-subtle text-muted hover:text-fg'}`}>
            {e === 'borrador' ? 'Pendientes de revisión' : e}
          </button>
        ))}
      </div>

      {cargando ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        : preguntas.length === 0 ? <EmptyState icon={<Bot className="h-7 w-7" />} title="No hay preguntas aquí" hint="Genera un lote nuevo desde un PDF con el formulario de arriba." />
          : (
            <div className="space-y-3">
              {preguntas.map((p) => (
                <Card key={p.id} hover>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge tone="blue">{p.tema}</Badge>
                        <Badge tone="slate">{p.categoria}</Badge>
                        {p.documento && <span className="text-xs text-muted">desde: {p.documento}</span>}
                      </div>
                      <p className="font-medium text-fg">{p.enunciado}</p>
                      {p.codigoPython && <pre className="mt-2 overflow-x-auto rounded-lg bg-subtle p-3 font-mono text-xs text-fg">{p.codigoPython}</pre>}
                      {p.opciones.length > 0 && (
                        <ul className="mt-2 space-y-1 text-sm text-muted">
                          {p.opciones.map((o) => <li key={o.id} className={o.id === p.respuestaCorrecta || p.tipo === 'ordenar_lineas' ? 'font-semibold text-prexi-green' : ''}>{o.id}. {o.texto}</li>)}
                        </ul>
                      )}
                      {p.tipo === 'completar_codigo' && <p className="mt-2 text-sm text-muted">Respuesta esperada: <span className="font-mono font-semibold text-prexi-green">{p.respuestaCorrecta}</span></p>}
                    </div>
                    {p.estado === 'borrador' && (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button onClick={() => setAprobando(p)} className="btn-primary !px-3 !py-1.5 text-xs"><CheckCircle className="h-3.5 w-3.5" /> Aprobar</button>
                        <button onClick={() => abrirEditar(p)} className="btn-ghost !px-3 !py-1.5 text-xs"><Edit className="h-3.5 w-3.5" /> Editar</button>
                        <button onClick={() => rechazar(p)} className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-prexi-red transition hover:bg-red-500/10"><X className="h-3.5 w-3.5" /> Rechazar</button>
                      </div>
                    )}
                    {p.estado !== 'borrador' && <Badge tone={p.estado === 'aprobada' ? 'green' : 'red'} className="shrink-0">{p.estado}</Badge>}
                  </div>
                </Card>
              ))}
            </div>
          )}

      {/* Editar borrador */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Corregir pregunta propuesta" size="lg"
        footer={<>
          <button onClick={() => setEditando(null)} className="btn-ghost">Cancelar</button>
          <button onClick={guardarEdicion} disabled={guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Guardar'}</button>
        </>}>
        <div className="space-y-4">
          <Field label="Categoría"><Input value={formEdit.categoria} onChange={(e) => setFormEdit({ ...formEdit, categoria: e.target.value })} /></Field>
          <Field label="Enunciado"><Textarea value={formEdit.enunciado} onChange={(e) => setFormEdit({ ...formEdit, enunciado: e.target.value })} /></Field>
          <Field label="Código Python (opcional)"><Textarea value={formEdit.codigoPython} onChange={(e) => setFormEdit({ ...formEdit, codigoPython: e.target.value })} className="font-mono text-sm" /></Field>
          <Field label="Respuesta correcta" hint="Para opción múltiple/ordenar líneas usa el id (A, B, B-A-C…); para completar código, el valor esperado.">
            <Input value={formEdit.respuestaCorrecta} onChange={(e) => setFormEdit({ ...formEdit, respuestaCorrecta: e.target.value })} />
          </Field>
          <Field label="Explicación (opcional)"><Textarea value={formEdit.explicacionIa} onChange={(e) => setFormEdit({ ...formEdit, explicacionIa: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* Aprobar: asignar nivel/dificultad/XP */}
      <Modal open={!!aprobando} onClose={() => setAprobando(null)} title="Aprobar y publicar"
        footer={<>
          <button onClick={() => setAprobando(null)} className="btn-ghost">Cancelar</button>
          <button onClick={confirmarAprobar} disabled={guardando} className="btn-primary">{guardando ? 'Publicando…' : 'Aprobar y publicar'}</button>
        </>}>
        <p className="mb-4 text-sm text-muted">Asigna el nivel de gamificación, la dificultad y el XP de este ejercicio antes de publicarlo para los estudiantes.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nivel"><Select value={formAprobar.nivel} onChange={(e) => setFormAprobar({ ...formAprobar, nivel: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Nivel {n}</option>)}</Select></Field>
          <Field label="Dificultad"><Select value={formAprobar.estrellas} onChange={(e) => setFormAprobar({ ...formAprobar, estrellas: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{'★'.repeat(n)}</option>)}</Select></Field>
          <Field label="XP"><Input type="number" min={5} max={500} value={formAprobar.xp} onChange={(e) => setFormAprobar({ ...formAprobar, xp: Number(e.target.value) })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
