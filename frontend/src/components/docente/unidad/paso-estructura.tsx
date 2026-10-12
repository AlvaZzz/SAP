'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { UnidadDocente, TemaDocente } from '@/lib/types';
import { Card, Field, Input, Textarea, Badge } from '@/components/ui';
import { ImageUpload } from '@/components/image-upload';
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, Save, CheckCircle } from '@/components/icons';

interface FormUnidad { numero: number; titulo: string; descripcion: string; introduccion: string; repaso: string; dashObjetivos: string; dashAnalogias: string; xp: number }
interface FormTema { id: number | null; padreId: number | null; numero: string; titulo: string; descripcion: string; repaso: string }

const mensaje = (e: unknown, defecto: string) => (e instanceof ApiError ? e.message : defecto);

/** Siguiente número sugerido: "2.4" para un tema de la unidad 2, "2.4.3" para un subtema. */
function numeroSugerido(unidad: UnidadDocente, padre: TemaDocente | null): string {
  return padre ? `${padre.numero}.${padre.subtemas.length + 1}` : `${unidad.numero}.${unidad.temas.length + 1}`;
}

/**
 * PASO 1 — La unidad y su lista de temas y subtemas. Primero se guarda la
 * unidad; recién entonces aparece la sección para agregarle temas.
 */
export function PasoEstructura({ unidad, numeroNuevo, onCreada, onCambio, onSiguiente }: {
  unidad: UnidadDocente | null; numeroNuevo: number;
  onCreada: (id: number) => void; onCambio: () => Promise<void> | void; onSiguiente: () => void;
}) {
  const [form, setForm] = useState<FormUnidad>({ numero: numeroNuevo, titulo: '', descripcion: '', introduccion: '', repaso: '', dashObjetivos: '', dashAnalogias: '', xp: 0 });
  const [masOpciones, setMasOpciones] = useState(false);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgTocada, setImgTocada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardada, setGuardada] = useState(false);
  const [error, setError] = useState('');
  const [tema, setTema] = useState<FormTema | null>(null);
  const [errorTema, setErrorTema] = useState('');

  useEffect(() => {
    if (!unidad) { setForm((f) => ({ ...f, numero: numeroNuevo })); return; }
    setForm({
      numero: unidad.numero, titulo: unidad.titulo, descripcion: unidad.descripcion ?? '', introduccion: unidad.introduccion ?? '',
      repaso: unidad.repaso ?? '', dashObjetivos: unidad.dashObjetivos ?? '', dashAnalogias: unidad.dashAnalogias ?? '', xp: unidad.xp,
    });
    // Solo al cambiar de unidad: no pisar lo que el docente está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidad?.id, numeroNuevo]);

  async function guardarUnidad() {
    if (form.titulo.trim().length < 3) { setError('Escribe el nombre de la unidad (al menos 3 letras).'); return; }
    if (form.numero < 1) { setError('El número de la unidad debe ser 1 o mayor.'); return; }
    setGuardando(true); setError(''); setGuardada(false);
    const opcional = (s: string) => s.trim() || undefined;
    try {
      let id = unidad?.id ?? null;
      if (unidad) {
        await api.put(`/docente/unidades/${unidad.id}`, {
          numero: form.numero, titulo: form.titulo.trim(), descripcion: opcional(form.descripcion), introduccion: opcional(form.introduccion),
          repaso: opcional(form.repaso), dashObjetivos: opcional(form.dashObjetivos), dashAnalogias: opcional(form.dashAnalogias), xp: form.xp,
        });
      } else {
        id = (await api.post<{ unidad: { id: number } }>('/docente/unidades', { numero: form.numero, titulo: form.titulo.trim(), descripcion: opcional(form.descripcion), xp: form.xp })).unidad.id;
      }
      if (imgTocada && id) {
        if (imgFile) { const fd = new FormData(); fd.append('imagen', imgFile); await api.upload(`/docente/unidades/${id}/imagen`, fd); }
        else if (unidad?.imagen_url) await api.del(`/docente/unidades/${id}/imagen`);
        setImgTocada(false);
      }
      if (!unidad && id) { onCreada(id); return; }
      await onCambio(); setGuardada(true);
    } catch (e) { setError(mensaje(e, 'No se pudo guardar la unidad.')); }
    finally { setGuardando(false); }
  }

  function nuevoTema(padre: TemaDocente | null) {
    if (!unidad) return;
    setErrorTema('');
    setTema({ id: null, padreId: padre?.id ?? null, numero: numeroSugerido(unidad, padre), titulo: '', descripcion: '', repaso: '' });
  }
  function editarTema(t: TemaDocente, padreId: number | null) {
    setErrorTema('');
    setTema({ id: t.id, padreId, numero: t.numero, titulo: t.titulo, descripcion: t.descripcion ?? '', repaso: t.repaso ?? '' });
  }
  async function guardarTema() {
    if (!tema || !unidad) return;
    if (!tema.numero.trim()) { setErrorTema('Falta el número (por ejemplo 1.3).'); return; }
    if (tema.titulo.trim().length < 3) { setErrorTema('Escribe el nombre del tema (al menos 3 letras).'); return; }
    setGuardando(true); setErrorTema('');
    const base = { numero: tema.numero.trim(), titulo: tema.titulo.trim(), descripcion: tema.descripcion.trim() || undefined, repaso: tema.repaso.trim() || undefined };
    try {
      if (tema.id) await api.put(`/docente/unidades/temas/${tema.id}`, base);
      else await api.post(`/docente/unidades/${unidad.id}/temas`, { ...base, padreId: tema.padreId ?? undefined });
      setTema(null); await onCambio();
    } catch (e) { setErrorTema(mensaje(e, 'No se pudo guardar el tema.')); }
    finally { setGuardando(false); }
  }
  async function eliminarTema(t: TemaDocente) {
    if (!confirm(`¿Eliminar «${t.numero} ${t.titulo}»? No se puede deshacer.`)) return;
    try { await api.del(`/docente/unidades/temas/${t.id}`); await onCambio(); }
    catch (e) { alert(mensaje(e, 'No se pudo eliminar.')); }
  }

  const formularioTema = tema && (
    <div className="space-y-3 rounded-2xl border border-prexi-blue/50 bg-card p-4">
      <p className="font-bold text-fg">{tema.id ? 'Editar' : 'Agregar'} {tema.padreId ? 'subtema' : 'tema'}</p>
      <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
        <Field label="Número" hint="Como aparece en tu programa.">
          <Input value={tema.numero} onChange={(e) => setTema({ ...tema, numero: e.target.value })} placeholder="1.3" />
        </Field>
        <Field label="Nombre">
          <Input autoFocus value={tema.titulo} onChange={(e) => setTema({ ...tema, titulo: e.target.value })} placeholder="Ej.: Tipos de datos y variables" />
        </Field>
      </div>
      <Field label="¿Qué se ve en este tema? (opcional)" hint="Una o dos líneas. PREXI las usa para generar mejores ejercicios.">
        <Textarea rows={2} value={tema.descripcion} onChange={(e) => setTema({ ...tema, descripcion: e.target.value })} placeholder="Ej.: Enteros, decimales, texto y booleanos; cómo declarar una variable." />
      </Field>
      <Field label="Repaso antes del examen (opcional)" hint="Un resumen corto que el estudiante lee antes del examen de la unidad.">
        <Textarea rows={2} value={tema.repaso} onChange={(e) => setTema({ ...tema, repaso: e.target.value })} />
      </Field>
      {errorTema && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red" role="alert">{errorTema}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={() => setTema(null)} className="btn-ghost">Cancelar</button>
        <button onClick={guardarTema} disabled={guardando} className="btn-primary disabled:opacity-60">{guardando ? 'Guardando…' : tema.id ? 'Guardar cambios' : `Agregar ${tema.padreId ? 'subtema' : 'tema'}`}</button>
      </div>
    </div>
  );

  const fila = (t: TemaDocente, padre: TemaDocente | null) => (
    <div key={t.id}>
      {tema?.id === t.id ? formularioTema : (
        <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card px-3 py-2.5 ${padre ? 'ml-6' : ''}`}>
          <span className="min-w-0 flex-1 text-sm font-semibold text-fg">{t.numero} {t.titulo}</span>
          {t.publicado && <Badge tone="green">Publicado</Badge>}
          {!padre && <button onClick={() => nuevoTema(t)} className="btn-ghost !px-2.5 !py-1 text-xs"><Plus className="h-3.5 w-3.5" /> Subtema</button>}
          <button onClick={() => editarTema(t, padre?.id ?? null)} className="btn-ghost !px-2.5 !py-1 text-xs"><Edit className="h-3.5 w-3.5" /> Editar</button>
          <button onClick={() => eliminarTema(t)} title="Eliminar" aria-label={`Eliminar ${t.titulo}`} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
      {!padre && t.subtemas.map((s) => fila(s, t))}
      {!padre && tema && tema.id === null && tema.padreId === t.id && <div className="ml-6 mt-2">{formularioTema}</div>}
    </div>
  );

  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-display text-xl font-bold text-fg">{unidad ? 'Datos de la unidad' : '¿Cómo se llama la unidad?'}</h2>
        <p className="mb-4 mt-1 text-sm text-muted">Una unidad agrupa varios temas, igual que en tu programa de la materia.</p>
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <Field label="Número" hint="El orden en que la ven.">
            <Input type="number" min={1} value={form.numero} onChange={(e) => setForm({ ...form, numero: Number(e.target.value) })} />
          </Field>
          <Field label="Nombre de la unidad">
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej.: Fundamentos de la programación" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="¿De qué trata? (opcional)" hint="Una o dos líneas que el estudiante lee en la tarjeta de la unidad.">
            <Textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej.: Algoritmos, tipos de datos, operadores y diagramas de flujo." />
          </Field>
        </div>

        <button type="button" onClick={() => setMasOpciones((v) => !v)} aria-expanded={masOpciones} className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-prexi-blue-deep hover:underline">
          {masOpciones ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />} Más opciones: portada, textos de introducción y repaso
        </button>
        {masOpciones && (
          <div className="mt-4 space-y-4 rounded-xl border border-line bg-subtle/40 p-4">
            <p className="text-xs text-muted">Todo esto es opcional. Los textos aceptan formato Markdown (## títulos, **negrita**, listas con «-»).</p>
            <Field label="Imagen de portada" hint="JPG, PNG o WebP, hasta 2 MB.">
              <ImageUpload valorActual={unidad?.imagen_url ?? null} disabled={guardando} onArchivo={(f) => { setImgFile(f); setImgTocada(true); }} />
            </Field>
            {unidad && (
              <>
                <Field label="Introducción" hint="La lee el estudiante al entrar a la unidad.">
                  <Textarea rows={5} value={form.introduccion} onChange={(e) => setForm({ ...form, introduccion: e.target.value })} />
                </Field>
                <Field label="Repaso de cierre" hint="Lo lee antes del examen de la unidad.">
                  <Textarea rows={5} value={form.repaso} onChange={(e) => setForm({ ...form, repaso: e.target.value })} />
                </Field>
                <Field label="Objetivos" hint="Una línea por objetivo, empezando con «- [ ]».">
                  <Textarea rows={4} value={form.dashObjetivos} onChange={(e) => setForm({ ...form, dashObjetivos: e.target.value })} />
                </Field>
                <Field label="Analogías del mundo real" hint="Ej.: **Variable = caja con etiqueta.**">
                  <Textarea rows={4} value={form.dashAnalogias} onChange={(e) => setForm({ ...form, dashAnalogias: e.target.value })} />
                </Field>
              </>
            )}
            <Field label="Puntos extra (XP) al completar la unidad" hint="Se entregan una sola vez. Deja 0 si no quieres dar puntos extra.">
              <Input type="number" min={0} max={1000} value={form.xp} onChange={(e) => setForm({ ...form, xp: Number(e.target.value) })} className="sm:!w-40" />
            </Field>
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red" role="alert">{error}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={guardarUnidad} disabled={guardando} className="btn-primary disabled:opacity-60">
            <Save className="h-4 w-4" /> {guardando ? 'Guardando…' : unidad ? 'Guardar cambios' : 'Crear unidad y continuar'}
          </button>
          {guardada && <span className="flex items-center gap-1 text-sm font-semibold text-prexi-green" role="status"><CheckCircle className="h-4 w-4" /> Guardado</span>}
        </div>
      </Card>

      {unidad && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-fg">Temas de la unidad</h2>
              <p className="mt-1 text-sm text-muted">Agrega los temas en el orden en que se enseñan. Si un tema es grande, divídelo en subtemas.</p>
            </div>
            <button onClick={() => nuevoTema(null)} className="btn-primary"><Plus className="h-4 w-4" /> Agregar tema</button>
          </div>
          <div className="mt-4 space-y-2">
            {unidad.temas.length === 0 && !tema && (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Esta unidad todavía no tiene temas. Empieza con «Agregar tema».</p>
            )}
            {unidad.temas.map((t) => fila(t, null))}
            {tema && tema.id === null && tema.padreId === null && formularioTema}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
            {unidad.temas.length === 0 && <span className="text-sm text-muted">Agrega al menos un tema para continuar.</span>}
            <button onClick={onSiguiente} disabled={unidad.temas.length === 0} className="btn-primary disabled:opacity-50">Siguiente: ejercicios</button>
          </div>
        </Card>
      )}
    </div>
  );
}
