'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DocenteEjercicio, DocenteDocumento, PreguntaIa, TipoEjercicio, NivelDificultad, NIVEL_LABEL } from '@/lib/types';
import { Badge, Skeleton, Field, Input, Textarea, Select } from '@/components/ui';
import { NIVELES } from '@/components/nivel-badge';
import { Plus, Edit, Trash2, Sparkles, CheckCircle, X, Upload, Eye, EyeOff, Bot, Code, BookOpen } from '@/components/icons';
import { EjercicioForm, DestinoEjercicio, TIPOS_EJERCICIO } from './ejercicio-form';

const META = 10;
const TIPOS_FLASHCARD: TipoEjercicio[] = ['opcion_multiple', 'predecir_salida', 'completar_codigo'];
const etiquetaTipo = (t: TipoEjercicio) => TIPOS_EJERCICIO.find((x) => x.value === t)?.label ?? t;

type Pestana = 'ejercicios' | 'flashcards' | 'ia';

/**
 * Todo el contenido de UN tema (o del examen de una unidad) en un solo lugar:
 * sus ejercicios por nivel, las flashcards que salen de ellos y el generador
 * de PREXI, que ya sabe para qué tema trabaja.
 */
export function ContenidoPanel({ destino, onCambio }: { destino: DestinoEjercicio; onCambio: () => void }) {
  const esExamen = destino.tipo === 'examen';
  const [pestana, setPestana] = useState<Pestana>('ejercicios');
  const [ejercicios, setEjercicios] = useState<DocenteEjercicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<{ abierto: boolean; ejercicio: DocenteEjercicio | null; nivel: NivelDificultad }>({ abierto: false, ejercicio: null, nivel: 'basico' });

  const consulta = destino.tipo === 'examen' ? `banco=examen&unidad=${destino.unidadId}` : `banco=practica&tema=${destino.temaId}`;
  const cargar = useCallback(async () => {
    try {
      const r = await api.get<{ ejercicios: DocenteEjercicio[] }>(`/docente/ejercicios?${consulta}`);
      setEjercicios(r.ejercicios ?? []);
    } catch { /* se queda con lo que había */ } finally { setCargando(false); }
  }, [consulta]);
  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = useCallback(async () => { await cargar(); onCambio(); }, [cargar, onCambio]);

  async function alternar(e: DocenteEjercicio) { await api.patch(`/docente/ejercicios/${e.id}/activo`).catch(() => undefined); await refrescar(); }
  async function eliminar(e: DocenteEjercicio) {
    if (!confirm('¿Eliminar este ejercicio? No se puede deshacer.')) return;
    await api.del(`/docente/ejercicios/${e.id}`).catch(() => undefined); await refrescar();
  }

  const flashcards = useMemo(() => ejercicios.filter((e) => e.activo && TIPOS_FLASHCARD.includes(e.tipo)), [ejercicios]);
  const nombreTema = useMemo(() => new Map(destino.tipo === 'examen' ? destino.temas.map((t) => [t.id, t.etiqueta]) : []), [destino]);

  const pestanas: [Pestana, string][] = esExamen
    ? [['ejercicios', `Preguntas (${ejercicios.filter((e) => e.activo).length}/${META})`], ['ia', 'Generar con PREXI']]
    : [['ejercicios', `Ejercicios (${ejercicios.length})`], ['flashcards', `Flashcards (${flashcards.length})`], ['ia', 'Generar con PREXI']];

  const fila = (e: DocenteEjercicio) => (
    <div key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="min-w-[180px] flex-1">
        <p className={`line-clamp-2 text-sm ${e.activo ? 'text-fg' : 'text-muted line-through'}`}>{e.enunciado}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {etiquetaTipo(e.tipo)}
          {esExamen && (e.temas_integrados.length >= 2
            ? e.temas_integrados.map((id) => <Badge key={id} tone="blue">{nombreTema.get(id) ?? `Tema ${id}`}</Badge>)
            : <Badge tone="amber">No combina temas: edítala</Badge>)}
        </p>
      </div>
      <div className="flex items-center">
        <button onClick={() => alternar(e)} title={e.activo ? 'Ocultar a los estudiantes' : 'Mostrar a los estudiantes'} aria-label={e.activo ? 'Ocultar' : 'Mostrar'} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-prexi-blue-deep">{e.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
        <button onClick={() => setForm({ abierto: true, ejercicio: e, nivel: e.nivel_dificultad })} title="Editar" aria-label="Editar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-prexi-blue-deep"><Edit className="h-4 w-4" /></button>
        <button onClick={() => eliminar(e)} title="Eliminar" aria-label="Eliminar" className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="border-t border-line bg-subtle/30 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1" role="tablist">
        {pestanas.map(([p, label]) => (
          <button key={p} role="tab" aria-selected={pestana === p} onClick={() => setPestana(p)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${pestana === p ? 'bg-prexi-blue text-white' : 'text-muted hover:text-fg'}`}>
            {p === 'ia' ? <Sparkles className="h-3.5 w-3.5" /> : p === 'flashcards' ? <BookOpen className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {pestana === 'ejercicios' && (cargando ? <Skeleton className="h-24" /> : esExamen ? (
        <div className="rounded-xl border border-line bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <p className="text-sm text-muted">El examen toma <b className="text-fg">{META} preguntas</b> de nivel intermedio; cada una combina 2 o 3 temas de la unidad.</p>
            <button onClick={() => setForm({ abierto: true, ejercicio: null, nivel: 'intermedio' })} className="btn-ghost !px-2.5 !py-1 text-xs"><Plus className="h-3.5 w-3.5" /> Agregar pregunta</button>
          </div>
          {ejercicios.length === 0
            ? <p className="px-3 py-4 text-sm text-muted">Aún no hay preguntas. Agrégalas a mano o genera las {META} con PREXI.</p>
            : <div className="divide-y divide-line">{ejercicios.map(fila)}</div>}
        </div>
      ) : (
        <div className="space-y-3">
          {NIVELES.map((n) => {
            const delNivel = ejercicios.filter((e) => e.nivel_dificultad === n);
            const activos = delNivel.filter((e) => e.activo).length;
            return (
              <div key={n} className="rounded-xl border border-line bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-fg">{NIVEL_LABEL[n]}</span>
                    <Badge tone={activos >= META ? 'green' : 'amber'}>{activos}/{META}</Badge>
                    {activos < META && <span className="text-xs text-muted">faltan {META - activos}</span>}
                  </div>
                  <button onClick={() => setForm({ abierto: true, ejercicio: null, nivel: n })} className="btn-ghost !px-2.5 !py-1 text-xs"><Plus className="h-3.5 w-3.5" /> Agregar</button>
                </div>
                {delNivel.length === 0
                  ? <p className="px-3 py-3 text-sm text-muted">Sin ejercicios en este nivel.</p>
                  : <div className="divide-y divide-line">{delNivel.map(fila)}</div>}
              </div>
            );
          })}
        </div>
      ))}

      {pestana === 'flashcards' && (
        <div>
          <p className="mb-3 text-sm text-muted">Las flashcards <b className="text-fg">se arman solas</b> con los ejercicios activos de este tema: la pregunta va al frente y la respuesta correcta al reverso. Cada estudiante ve las de su nivel. Para cambiar una tarjeta, edita su ejercicio.</p>
          {flashcards.length === 0 ? <p className="rounded-xl bg-card px-3 py-4 text-sm text-muted">Todavía no hay tarjetas: crea ejercicios de opción múltiple, predecir salida o completar código.</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {flashcards.map((e) => (
                <div key={e.id} className="rounded-xl border border-line bg-card p-3">
                  <div className="mb-1 flex items-center justify-between gap-2"><span className="text-[11px] font-bold uppercase tracking-wide text-muted">Frente</span><Badge tone="slate">{NIVEL_LABEL[e.nivel_dificultad]}</Badge></div>
                  <p className="line-clamp-3 text-sm text-fg">{e.enunciado}</p>
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted">Reverso</p>
                  <p className="text-sm font-semibold text-prexi-green">{respuestaLegible(e)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pestana === 'ia' && <GeneradorIa destino={destino} onAprobada={refrescar} />}

      <EjercicioForm open={form.abierto} onClose={() => setForm((f) => ({ ...f, abierto: false }))} onGuardado={refrescar}
        destino={destino} ejercicio={form.ejercicio} nivelInicial={form.nivel} />
    </div>
  );
}

function respuestaLegible(e: { tipo: TipoEjercicio; opciones: { id: string; texto: string }[]; respuestaCorrecta: string }): string {
  if (e.tipo === 'completar_codigo') return e.respuestaCorrecta.split('|')[0];
  if (e.tipo === 'ordenar_lineas') return `Orden: ${e.respuestaCorrecta}`;
  const ops = Array.isArray(e.opciones) ? e.opciones : [];
  return ops.find((o) => o.id.trim().toUpperCase() === e.respuestaCorrecta.trim().toUpperCase())?.texto ?? e.respuestaCorrecta;
}

type Material = 'ninguno' | 'texto' | 'pdf';

/** Generador de PREXI ya contextualizado: propone, el docente revisa y aprueba. */
function GeneradorIa({ destino, onAprobada }: { destino: DestinoEjercicio; onAprobada: () => void }) {
  const esExamen = destino.tipo === 'examen';
  const [tipo, setTipo] = useState<TipoEjercicio>('opcion_multiple');
  const [nivel, setNivel] = useState<NivelDificultad>('basico');
  const [material, setMaterial] = useState<Material>('ninguno');
  const [texto, setTexto] = useState('');
  const [documentos, setDocumentos] = useState<DocenteDocumento[]>([]);
  const [documentoId, setDocumentoId] = useState('');
  const [generando, setGenerando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [borradores, setBorradores] = useState<PreguntaIa[]>([]);
  const [editando, setEditando] = useState<PreguntaIa | null>(null);
  const [ocupada, setOcupada] = useState<number | 'todas' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtro = destino.tipo === 'examen' ? `unidad=${destino.unidadId}` : `tema=${destino.temaId}`;
  const temaParaPdf = destino.tipo === 'examen' ? destino.temas[0]?.id : destino.temaId;

  const cargarBorradores = useCallback(async () => {
    const r = await api.get<{ preguntas: PreguntaIa[] }>(`/docente/preguntas-ia?estado=borrador&${filtro}`).catch(() => null);
    if (r) setBorradores(r.preguntas);
  }, [filtro]);
  const cargarDocumentos = useCallback(async () => {
    const r = await api.get<{ documentos: DocenteDocumento[] }>('/docente/documentos').catch(() => null);
    if (r) setDocumentos(r.documentos.filter((d) => d.tiene_texto));
  }, []);
  useEffect(() => { cargarBorradores(); cargarDocumentos(); }, [cargarBorradores, cargarDocumentos]);

  async function subirPdf(file: File | null) {
    if (!file || !temaParaPdf) return;
    setError('');
    if (file.type !== 'application/pdf') { setError('Solo se aceptan archivos PDF.'); return; }
    setSubiendo(true);
    const fd = new FormData();
    fd.append('titulo', file.name.replace(/\.pdf$/i, '').slice(0, 120) || 'Material');
    fd.append('temaId', String(temaParaPdf));
    fd.append('archivo', file);
    try {
      const d = await api.upload<{ documento?: { id: number }; id?: number; texto_extraido?: boolean }>('/docente/documentos', fd);
      if (d.texto_extraido === false) setError('El PDF se subió, pero no tiene texto que se pueda leer (¿está escaneado?). Pega el texto en su lugar.');
      await cargarDocumentos();
      const id = d.documento?.id ?? d.id;
      if (id && d.texto_extraido !== false) setDocumentoId(String(id));
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo subir el PDF'); }
    finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function generar() {
    setError('');
    if (material === 'texto' && texto.trim().length < 40) { setError('Pega un texto un poco más largo, o elige «Solo el tema».'); return; }
    if (material === 'pdf' && !documentoId) { setError('Elige o sube un PDF, o usa «Solo el tema».'); return; }
    setGenerando(true);
    try {
      await api.post('/docente/preguntas-ia/generar', {
        ...(destino.tipo === 'examen' ? { unidadId: destino.unidadId } : { temaId: destino.temaId, nivel }),
        tipo, cantidad: META,
        ...(material === 'texto' ? { texto: texto.trim().slice(0, 12000) } : {}),
        ...(material === 'pdf' ? { documentoId: Number(documentoId) } : {}),
      });
      await cargarBorradores();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'PREXI no pudo generar las preguntas. Intenta de nuevo.'); }
    finally { setGenerando(false); }
  }

  async function aprobar(p: PreguntaIa) {
    setOcupada(p.id); setError('');
    try { await api.post(`/docente/preguntas-ia/${p.id}/aprobar`, {}); await cargarBorradores(); onAprobada(); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo aprobar'); }
    finally { setOcupada(null); }
  }
  async function descartar(p: PreguntaIa) {
    setOcupada(p.id);
    await api.post(`/docente/preguntas-ia/${p.id}/rechazar`).catch(() => undefined);
    await cargarBorradores(); setOcupada(null);
  }
  async function aprobarTodas() {
    if (!confirm(`¿Aprobar las ${borradores.length} preguntas? Se publicarán tal como están.`)) return;
    setOcupada('todas'); setError('');
    let fallidas = 0;
    for (const p of borradores) await api.post(`/docente/preguntas-ia/${p.id}/aprobar`, {}).catch(() => { fallidas += 1; });
    if (fallidas) setError(`${fallidas} pregunta(s) no se pudieron aprobar: revísalas una por una.`);
    await cargarBorradores(); onAprobada(); setOcupada(null);
  }
  async function guardarEdicion() {
    if (!editando) return;
    setError('');
    try {
      await api.put(`/docente/preguntas-ia/${editando.id}`, {
        enunciado: editando.enunciado, codigoPython: editando.codigoPython ?? '',
        ...(editando.opciones.length >= 2 ? { opciones: editando.opciones } : {}),
        respuestaCorrecta: editando.respuestaCorrecta, explicacionIa: editando.explicacionIa ?? '',
        ...(esExamen ? { temasIntegrados: editando.temas_integrados.map((t) => t.id) } : {}),
      });
      setEditando(null); await cargarBorradores();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cambio'); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-card p-3 sm:p-4">
        <p className="mb-3 flex items-start gap-2 text-sm text-muted">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" />
          <span>{esExamen
            ? <>PREXI propone <b className="text-fg">{META} preguntas de examen</b>, de nivel intermedio, cada una combinando 2 o 3 temas de esta unidad.</>
            : <>PREXI propone <b className="text-fg">{META} ejercicios</b> para <b className="text-fg">{destino.etiqueta}</b>.</>} Tú las revisas antes de publicarlas.</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tipo de pregunta">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEjercicio)}>{TIPOS_EJERCICIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
          </Field>
          {!esExamen && (
            <Field label="Nivel">
              <Select value={nivel} onChange={(e) => setNivel(e.target.value as NivelDificultad)}>{NIVELES.map((n) => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}</Select>
            </Field>
          )}
          <Field label="Basarse en">
            <Select value={material} onChange={(e) => setMaterial(e.target.value as Material)}>
              <option value="ninguno">{esExamen ? "Solo los temas de la unidad" : "Solo el tema"}</option>
              <option value="texto">Un texto que pego</option>
              <option value="pdf">Un PDF</option>
            </Select>
          </Field>
        </div>
        {material === 'texto' && (
          <div className="mt-3"><Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pega aquí tus apuntes o el fragmento del libro…" /></div>
        )}
        {material === 'pdf' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select value={documentoId} onChange={(e) => setDocumentoId(e.target.value)} className="!w-auto min-w-[220px]">
              <option value="">{documentos.length ? 'Elige un PDF…' : 'Aún no subiste ningún PDF'}</option>
              {documentos.map((d) => <option key={d.id} value={d.id}>{d.titulo}</option>)}
            </Select>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => subirPdf(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={subiendo} className="btn-ghost text-sm disabled:opacity-60"><Upload className="h-4 w-4" /> {subiendo ? 'Subiendo…' : 'Subir PDF'}</button>
          </div>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red" role="alert">{error}</p>}
        <button onClick={generar} disabled={generando} className="btn-primary mt-3 disabled:opacity-60">
          <Sparkles className="h-4 w-4" /> {generando ? 'PREXI está escribiendo… (puede tardar un minuto)' : `Generar ${META} preguntas`}
        </button>
      </div>

      {borradores.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-fg">{borradores.length} por revisar</p>
            <button onClick={aprobarTodas} disabled={ocupada !== null} className="btn-ghost text-sm disabled:opacity-60"><CheckCircle className="h-4 w-4" /> {ocupada === 'todas' ? 'Aprobando…' : 'Aprobar todas'}</button>
          </div>
          <div className="space-y-2">
            {borradores.map((p) => editando?.id === p.id ? (
              <div key={p.id} className="space-y-3 rounded-xl border border-prexi-blue/50 bg-card p-3">
                <Field label="Enunciado"><Textarea value={editando.enunciado} onChange={(e) => setEditando({ ...editando, enunciado: e.target.value })} /></Field>
                <Field label="Código Python (opcional)"><Textarea className="font-mono text-sm" value={editando.codigoPython ?? ''} onChange={(e) => setEditando({ ...editando, codigoPython: e.target.value })} /></Field>
                {editando.opciones.length >= 2 && editando.tipo !== 'ordenar_lineas' ? (
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-fg">Opciones (marca la correcta)</span>
                    {editando.opciones.map((o, i) => (
                      <div key={o.id} className="flex items-center gap-2">
                        <input type="radio" name={`ok-${p.id}`} checked={editando.respuestaCorrecta === o.id} onChange={() => setEditando({ ...editando, respuestaCorrecta: o.id })} className="h-4 w-4 shrink-0 accent-prexi-blue" />
                        <Input value={o.texto} onChange={(e) => setEditando({ ...editando, opciones: editando.opciones.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Field label={editando.tipo === 'ordenar_lineas' ? 'Orden correcto (ids separados por coma)' : 'Respuesta esperada'}><Input value={editando.respuestaCorrecta} onChange={(e) => setEditando({ ...editando, respuestaCorrecta: e.target.value })} /></Field>
                )}
                <Field label="Explicación"><Textarea value={editando.explicacionIa ?? ''} onChange={(e) => setEditando({ ...editando, explicacionIa: e.target.value })} /></Field>
                {destino.tipo === 'examen' && (
                  <Field label="Temas que combina (2 o 3)">
                    <div className="flex flex-wrap gap-2">
                      {destino.temas.map((t) => {
                        const activo = editando.temas_integrados.some((x) => x.id === t.id);
                        return (
                          <button key={t.id} type="button" aria-pressed={activo}
                            onClick={() => setEditando({ ...editando, temas_integrados: activo ? editando.temas_integrados.filter((x) => x.id !== t.id) : [...editando.temas_integrados, { id: t.id, nombre: t.etiqueta }] })}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${activo ? 'border-prexi-blue bg-prexi-blue text-white' : 'border-line text-muted hover:text-fg'}`}>{t.etiqueta}</button>
                        );
                      })}
                    </div>
                  </Field>
                )}
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditando(null)} className="btn-ghost text-sm">Cancelar</button>
                  <button onClick={guardarEdicion} className="btn-primary text-sm">Guardar cambios</button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="rounded-xl border border-line bg-card p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge tone="slate">{etiquetaTipo(p.tipo)}</Badge>
                  <Badge tone="slate">{NIVEL_LABEL[p.nivel]}</Badge>
                  {p.temas_integrados.map((t) => <Badge key={t.id} tone="blue">{t.nombre}</Badge>)}
                </div>
                <p className="whitespace-pre-wrap text-sm text-fg">{p.enunciado}</p>
                {p.codigoPython && <pre className="mt-2 overflow-x-auto rounded-lg bg-subtle p-2 font-mono text-xs text-fg">{p.codigoPython}</pre>}
                {p.opciones.length > 0 && p.tipo !== 'ordenar_lineas' ? (
                  <ul className="mt-2 space-y-1">
                    {p.opciones.map((o) => {
                      const ok = o.id === p.respuestaCorrecta;
                      return <li key={o.id} className={`flex items-start gap-2 rounded-lg px-2 py-1 text-sm ${ok ? 'bg-prexi-green/10 font-semibold text-prexi-green' : 'text-muted'}`}><span className="font-bold">{o.id}.</span><span className="flex-1">{o.texto}</span>{ok && <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />}</li>;
                    })}
                  </ul>
                ) : <p className="mt-2 text-sm"><span className="text-muted">Respuesta: </span><b className="text-prexi-green">{respuestaLegible(p)}</b></p>}
                {p.explicacionIa && <p className="mt-2 text-xs text-muted">{p.explicacionIa}</p>}
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button onClick={() => descartar(p)} disabled={ocupada !== null} className="btn-ghost text-sm disabled:opacity-60"><X className="h-4 w-4" /> Descartar</button>
                  <button onClick={() => setEditando(p)} disabled={ocupada !== null} className="btn-ghost text-sm disabled:opacity-60"><Edit className="h-4 w-4" /> Editar</button>
                  <button onClick={() => aprobar(p)} disabled={ocupada !== null} className="btn-primary text-sm disabled:opacity-60"><CheckCircle className="h-4 w-4" /> {ocupada === p.id ? 'Aprobando…' : 'Aprobar'}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
