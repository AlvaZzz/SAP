'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { UnidadDocente, TemaDocente } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton, Modal, Field, Input, Textarea, EmptyState } from '@/components/ui';
import { ImageUpload } from '@/components/image-upload';
import { Markdown } from '@/components/markdown';
import { Plus, Edit, Trash2, Layers, CheckCircle, Lock, AlertTriangle, ClipboardList } from '@/components/icons';

interface FormUnidad { numero: number; titulo: string; descripcion: string; introduccion: string; repaso: string; dashObjetivos: string; dashAnalogias: string; xp: number }
const VACIO_UNIDAD: FormUnidad = { numero: 1, titulo: '', descripcion: '', introduccion: '', repaso: '', dashObjetivos: '', dashAnalogias: '', xp: 0 };

interface FormTema { unidadId: number; padreId: number | null; numero: string; titulo: string; descripcion: string; repaso: string; umbral: number }
const vacioTema = (unidadId: number, padreId: number | null = null): FormTema => ({ unidadId, padreId, numero: '', titulo: '', descripcion: '', repaso: '', umbral: 10 });

export default function DocenteUnidadesPage() {
  const [unidades, setUnidades] = useState<UnidadDocente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [modalUnidad, setModalUnidad] = useState(false);
  const [editUnidadId, setEditUnidadId] = useState<number | null>(null);
  const [formUnidad, setFormUnidad] = useState<FormUnidad>(VACIO_UNIDAD);
  const [erroresU, setErroresU] = useState<Record<string, string>>({});
  // Portada: imagen guardada (al editar), archivo nuevo elegido y si el docente la tocó.
  const [imgActual, setImgActual] = useState<string | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgTocada, setImgTocada] = useState(false);

  const [modalTema, setModalTema] = useState(false);
  const [editTemaId, setEditTemaId] = useState<number | null>(null);
  const [formTema, setFormTema] = useState<FormTema | null>(null);
  const [erroresT, setErroresT] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    try { const r = await api.get<{ unidades: UnidadDocente[] }>('/docente/unidades'); setUnidades(r.unidades); }
    catch { /* noop */ } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []);

  function abrirCrearUnidad() {
    const siguiente = unidades.length ? Math.max(...unidades.map((u) => u.numero)) + 1 : 1;
    setEditUnidadId(null); setFormUnidad({ ...VACIO_UNIDAD, numero: siguiente }); setErroresU({}); setError('');
    setImgActual(null); setImgFile(null); setImgTocada(false); setModalUnidad(true);
  }
  function abrirEditarUnidad(u: UnidadDocente) {
    setEditUnidadId(u.id); setFormUnidad({ numero: u.numero, titulo: u.titulo, descripcion: u.descripcion ?? '', introduccion: u.introduccion ?? '', repaso: u.repaso ?? '', dashObjetivos: u.dashObjetivos ?? '', dashAnalogias: u.dashAnalogias ?? '', xp: u.xp }); setErroresU({}); setError('');
    setImgActual(u.imagen_url); setImgFile(null); setImgTocada(false); setModalUnidad(true);
  }
  function validarUnidad(): boolean {
    const e: Record<string, string> = {};
    if (formUnidad.titulo.trim().length < 3) e.titulo = 'Escribe un título de al menos 3 caracteres.';
    if (formUnidad.numero < 1) e.numero = 'El número debe ser positivo.';
    setErroresU(e);
    return Object.keys(e).length === 0;
  }
  async function guardarUnidad() {
    if (!validarUnidad()) return;
    setGuardando(true); setError('');
    const payload = { numero: formUnidad.numero, titulo: formUnidad.titulo.trim(), descripcion: formUnidad.descripcion.trim() || undefined, introduccion: formUnidad.introduccion.trim() || undefined, repaso: formUnidad.repaso.trim() || undefined, dashObjetivos: formUnidad.dashObjetivos.trim() || undefined, dashAnalogias: formUnidad.dashAnalogias.trim() || undefined, xp: formUnidad.xp };
    try {
      // 1) Guarda los campos de texto; obtiene el id (nuevo o existente).
      let unidadId = editUnidadId;
      if (editUnidadId) await api.put(`/docente/unidades/${editUnidadId}`, payload);
      else unidadId = (await api.post<{ unidad: { id: number } }>('/docente/unidades', payload)).unidad.id;

      // 2) Portada: solo si el docente la tocó. Archivo nuevo → subir; quitada → borrar.
      if (imgTocada && unidadId) {
        if (imgFile) {
          const fd = new FormData();
          fd.append('imagen', imgFile);
          await api.upload(`/docente/unidades/${unidadId}/imagen`, fd);
        } else if (editUnidadId && imgActual) {
          await api.del(`/docente/unidades/${unidadId}/imagen`);
        }
      }
      setModalUnidad(false); await cargar();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo guardar la unidad'); }
    finally { setGuardando(false); }
  }
  async function eliminarUnidad(u: UnidadDocente) {
    if (!confirm(`¿Eliminar la unidad "${u.titulo}"? Debe no tener temas.`)) return;
    try { await api.del(`/docente/unidades/${u.id}`); await cargar(); }
    catch (err) { alert(err instanceof ApiError ? err.message : 'No se pudo eliminar'); }
  }

  function abrirCrearTema(unidadId: number, padreId: number | null = null) {
    setEditTemaId(null); setFormTema(vacioTema(unidadId, padreId)); setErroresT({}); setError(''); setModalTema(true);
  }
  function abrirEditarTema(unidadId: number, t: TemaDocente, padreId: number | null = null) {
    setEditTemaId(t.id);
    setFormTema({ unidadId, padreId, numero: t.numero, titulo: t.titulo, descripcion: t.descripcion ?? '', repaso: t.repaso ?? '', umbral: t.umbral });
    setErroresT({}); setError(''); setModalTema(true);
  }
  function validarTema(): boolean {
    if (!formTema) return false;
    const e: Record<string, string> = {};
    if (!formTema.numero.trim()) e.numero = 'Ej.: 1.5 o 1.5.2';
    if (formTema.titulo.trim().length < 3) e.titulo = 'Escribe un título de al menos 3 caracteres.';
    if (formTema.umbral < 1) e.umbral = 'Debe ser al menos 1.';
    setErroresT(e);
    return Object.keys(e).length === 0;
  }
  async function guardarTema() {
    if (!formTema || !validarTema()) return;
    setGuardando(true); setError('');
    const base = { numero: formTema.numero.trim(), titulo: formTema.titulo.trim(), descripcion: formTema.descripcion.trim() || undefined, repaso: formTema.repaso.trim() || undefined, umbral: formTema.umbral };
    try {
      // El padre (padreId) solo aplica al CREAR; al editar no se reasigna (y el DTO de edición no lo acepta).
      if (editTemaId) await api.put(`/docente/unidades/temas/${editTemaId}`, base);
      else await api.post(`/docente/unidades/${formTema.unidadId}/temas`, { ...base, padreId: formTema.padreId ?? undefined });
      setModalTema(false); await cargar();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo guardar el tema'); }
    finally { setGuardando(false); }
  }
  async function eliminarTema(t: TemaDocente) {
    if (!confirm(`¿Eliminar "${t.numero} ${t.titulo}"? Debe no tener subtemas.`)) return;
    try { await api.del(`/docente/unidades/temas/${t.id}`); await cargar(); }
    catch (err) { alert(err instanceof ApiError ? err.message : 'No se pudo eliminar'); }
  }
  async function alternarPublicado(t: TemaDocente) {
    try { await api.put(`/docente/unidades/temas/${t.id}`, { publicado: !t.publicado }); await cargar(); }
    catch (err) { alert(err instanceof ApiError ? err.message : 'No se pudo actualizar'); }
  }
  async function alternarDiagnostico(t: TemaDocente) {
    try { await api.put(`/docente/unidades/temas/${t.id}`, { enDiagnostico: !t.en_diagnostico }); await cargar(); }
    catch (err) { alert(err instanceof ApiError ? err.message : 'No se pudo actualizar'); }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Unidades y temas" subtitle="Estructura académica: Unidad → Tema → Subtema. Cada tema necesita mínimo 10 ejercicios para publicarse."
        action={<button onClick={abrirCrearUnidad} className="btn-primary"><Plus className="h-4 w-4" /> Nueva unidad</button>} />

      {cargando ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        : unidades.length === 0 ? <EmptyState icon={<Layers className="h-7 w-7" />} title="Aún no hay unidades" hint="Crea tu primera unidad para empezar a organizar el contenido." />
          : (
            <div className="space-y-5">
              {unidades.map((u) => (
                <Card key={u.id} hover>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">Unidad {u.numero}</p>
                      <h3 className="font-display text-lg font-bold text-fg">{u.titulo}</h3>
                      {u.descripcion && <p className="mt-0.5 text-sm text-muted">{u.descripcion}</p>}
                      {u.xp > 0 && <Badge tone="amber" className="mt-1.5">Bono +{u.xp} XP al completar</Badge>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => abrirCrearTema(u.id)} className="btn-ghost !px-3 !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Tema</button>
                      <button onClick={() => abrirEditarUnidad(u)} title="Editar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-prexi-blue-deep"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => eliminarUnidad(u)} title="Eliminar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>

                  {u.temas.length === 0 ? (
                    <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-muted">Sin temas todavía. Usa &quot;+ Tema&quot; para agregar el primero.</p>
                  ) : (
                    <div className="space-y-2">
                      {u.temas.map((t) => (
                        <div key={t.id} className="rounded-xl border border-line">
                          <FilaTema tema={t} onEditar={() => abrirEditarTema(u.id, t)} onEliminar={() => eliminarTema(t)}
                            onPublicar={() => alternarPublicado(t)} onDiagnostico={() => alternarDiagnostico(t)} onSubtema={() => abrirCrearTema(u.id, t.id)} />
                          {t.subtemas.length > 0 && (
                            <div className="space-y-2 border-t border-line bg-subtle/40 p-2 pl-6">
                              {t.subtemas.map((s) => (
                                <FilaTema key={s.id} tema={s} esSubtema
                                  onEditar={() => abrirEditarTema(u.id, s, t.id)} onEliminar={() => eliminarTema(s)}
                                  onPublicar={() => alternarPublicado(s)} onDiagnostico={() => alternarDiagnostico(s)} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

      {/* Modal Unidad */}
      <Modal open={modalUnidad} onClose={() => setModalUnidad(false)} title={editUnidadId ? 'Editar unidad' : 'Nueva unidad'}
        footer={<>
          <button onClick={() => setModalUnidad(false)} className="btn-ghost">Cancelar</button>
          <button onClick={guardarUnidad} disabled={guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Guardar'}</button>
        </>}>
        {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}
        <div className="space-y-4">
          <Field label="Imagen de portada (opcional)" hint="Se muestra como banner de la unidad al estudiante. Sube una imagen propia o de un banco libre (Unsplash, Pexels). JPG, PNG o WebP · máx. 2 MB.">
            <ImageUpload valorActual={imgActual} disabled={guardando}
              onArchivo={(f) => { setImgFile(f); setImgTocada(true); }} />
          </Field>
          <Field label="Número de unidad" error={erroresU.numero} hint="Define el orden en que la ve el estudiante.">
            <Input type="number" min={1} value={formUnidad.numero} onChange={(e) => setFormUnidad({ ...formUnidad, numero: Number(e.target.value) })} />
          </Field>
          <Field label="Título" error={erroresU.titulo}>
            <Input value={formUnidad.titulo} onChange={(e) => setFormUnidad({ ...formUnidad, titulo: e.target.value })} placeholder="Ej: Unidad 1: Fundamentos de la Programación" />
          </Field>
          <Field label="Descripción (opcional)">
            <Textarea value={formUnidad.descripcion} onChange={(e) => setFormUnidad({ ...formUnidad, descripcion: e.target.value })} />
          </Field>
          <Field label="Introducción didáctica (opcional)" hint="La verá el estudiante antes del diagnóstico, en la pestaña de esta unidad. Admite Markdown: ## títulos, **negrita**, `código`, listas con «-» y bloques ```.">
            <EditorMarkdown value={formUnidad.introduccion} onChange={(v) => setFormUnidad({ ...formUnidad, introduccion: v })} placeholder={'## Objetivos de la unidad\n...\n\n## Conceptos clave\n- ...'} />
          </Field>
          <Field label="Repaso de cierre (opcional)" hint="Lo verá el estudiante antes de la EVALUACIÓN FINAL (postest), como repaso de la unidad. Mismo formato Markdown.">
            <EditorMarkdown value={formUnidad.repaso} onChange={(v) => setFormUnidad({ ...formUnidad, repaso: v })} placeholder={'## Lo esencial que ya dominas\n...\n\n## Conceptos clave a recordar\n- ...'} />
          </Field>
          <Field label="Dashboard · Objetivos (opcional)" hint="Zona ① del Preview de Unidad. Una casilla por objetivo con «- [ ] …». El mapa conceptual y los ejemplos se generan/siembran aparte.">
            <EditorMarkdown value={formUnidad.dashObjetivos} onChange={(v) => setFormUnidad({ ...formUnidad, dashObjetivos: v })} placeholder={'## Al final de esta unidad podrás…\n- [ ] …\n- [ ] …'} />
          </Field>
          <Field label="Dashboard · Analogías del mundo real (opcional)" hint="Zona ③ del Preview de Unidad. Ej.: «**Variable = caja etiquetada.** …».">
            <EditorMarkdown value={formUnidad.dashAnalogias} onChange={(v) => setFormUnidad({ ...formUnidad, dashAnalogias: v })} placeholder={'## Analogías para entenderlo\n- **Concepto = analogía.** …'} />
          </Field>
          <Field label="Bono de XP al completar la unidad" hint="Se otorga una sola vez cuando el estudiante completa todos los temas publicados.">
            <Input type="number" min={0} value={formUnidad.xp} onChange={(e) => setFormUnidad({ ...formUnidad, xp: Number(e.target.value) })} />
          </Field>
        </div>
      </Modal>

      {/* Modal Tema/Subtema */}
      <Modal open={modalTema} onClose={() => setModalTema(false)} title={editTemaId ? 'Editar tema' : formTema?.padreId ? 'Nuevo subtema' : 'Nuevo tema'}
        footer={<>
          <button onClick={() => setModalTema(false)} className="btn-ghost">Cancelar</button>
          <button onClick={guardarTema} disabled={guardando} className="btn-primary">{guardando ? 'Guardando…' : 'Guardar'}</button>
        </>}>
        {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}
        {formTema && (
          <div className="space-y-4">
            <Field label="Número" error={erroresT.numero} hint='Etiqueta jerárquica, ej. "1.5" o "1.5.2".'>
              <Input value={formTema.numero} onChange={(e) => setFormTema({ ...formTema, numero: e.target.value })} placeholder="1.5" />
            </Field>
            <Field label="Título" error={erroresT.titulo}>
              <Input value={formTema.titulo} onChange={(e) => setFormTema({ ...formTema, titulo: e.target.value })} placeholder="Ej: Tipos de datos y variables" />
            </Field>
            <Field label="Descripción (opcional)">
              <Textarea value={formTema.descripcion} onChange={(e) => setFormTema({ ...formTema, descripcion: e.target.value })} />
            </Field>
            <Field label="Repaso del tema (opcional)" hint="Lo verá el estudiante antes del EXAMEN DE FIN DE UNIDAD, en la pestaña de este tema. Admite Markdown.">
              <EditorMarkdown value={formTema.repaso} onChange={(v) => setFormTema({ ...formTema, repaso: v })} placeholder={'**Concepto clave.** Recuerda que…'} />
            </Field>
            <Field label="Ejercicios correctos para desbloquear el siguiente" error={erroresT.umbral}>
              <Input type="number" min={1} value={formTema.umbral} onChange={(e) => setFormTema({ ...formTema, umbral: Number(e.target.value) })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Editor de texto Markdown con conmutador Editar / Vista previa (reutilizable). */
function EditorMarkdown({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [preview, setPreview] = useState(false);
  return (
    <>
      <div className="mb-1.5 flex items-center gap-2">
        <button type="button" onClick={() => setPreview(false)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${!preview ? 'bg-prexi-blue text-white' : 'bg-subtle text-muted'}`}>Editar</button>
        <button type="button" onClick={() => setPreview(true)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${preview ? 'bg-prexi-blue text-white' : 'bg-subtle text-muted'}`}>Vista previa</button>
      </div>
      {preview
        ? <div className="min-h-[6rem] rounded-xl border border-line bg-card p-3">{value.trim() ? <Markdown content={value} /> : <p className="text-sm text-muted">Nada que previsualizar todavía.</p>}</div>
        : <Textarea rows={10} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
    </>
  );
}

function FilaTema({ tema, esSubtema, onEditar, onEliminar, onPublicar, onDiagnostico, onSubtema }: {
  tema: TemaDocente; esSubtema?: boolean; onEditar: () => void; onEliminar: () => void; onPublicar: () => void; onDiagnostico: () => void; onSubtema?: () => void;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 p-3 ${esSubtema ? 'rounded-lg bg-card' : ''}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-fg">{tema.numero} {tema.titulo}</span>
          {tema.publicado ? <Badge tone="green">Publicado</Badge> : <Badge tone="slate">Borrador</Badge>}
          {tema.en_diagnostico && <Badge tone="blue">En diagnóstico</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {tema.ejercicios_activos}/{tema.ejercicios_minimos} ejercicios mínimos
          {!tema.puede_publicarse && <span className="ml-1.5 inline-flex items-center gap-1 text-prexi-amber"><AlertTriangle className="h-3 w-3" /> faltan {Math.max(0, tema.ejercicios_minimos - tema.ejercicios_activos)}</span>}
          <span className="ml-1.5 inline-flex items-center gap-1"><ClipboardList className="h-3 w-3" /> {tema.items_diagnostico} de diagnóstico</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!esSubtema && onSubtema && <button onClick={onSubtema} className="btn-ghost !px-2.5 !py-1 text-xs"><Plus className="h-3 w-3" /> Subtema</button>}
        <button onClick={onDiagnostico} disabled={!tema.en_diagnostico && !tema.puede_diagnosticar}
          title={tema.en_diagnostico ? 'Quitar del diagnóstico' : tema.puede_diagnosticar ? 'Incluir en el diagnóstico inicial' : 'Necesita al menos 3 preguntas de diagnóstico'}
          className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-30 ${tema.en_diagnostico ? 'text-prexi-blue-deep' : 'text-muted hover:text-prexi-blue-deep'}`}>
          <ClipboardList className="h-4 w-4" />
        </button>
        <button onClick={onPublicar} disabled={!tema.publicado && !tema.puede_publicarse}
          title={tema.publicado ? 'Despublicar' : tema.puede_publicarse ? 'Publicar' : `Necesita ${tema.ejercicios_minimos} ejercicios`}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-prexi-green disabled:cursor-not-allowed disabled:opacity-30">
          {tema.publicado ? <Lock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
        </button>
        <button onClick={onEditar} title="Editar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-prexi-blue-deep"><Edit className="h-4 w-4" /></button>
        <button onClick={onEliminar} title="Eliminar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
