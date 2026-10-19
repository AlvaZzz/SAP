'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { DocenteEjercicio, TipoEjercicio, NivelDificultad, NIVEL_LABEL } from '@/lib/types';
import { Modal, Field, Input, Textarea, Select } from '@/components/ui';
import { nivelDesdeEstrellas, estrellasDesdeNivel, NIVELES } from '@/components/nivel-badge';
import { Trash2, ChevronUp, ChevronDown } from '@/components/icons';

export const TIPOS_EJERCICIO: { value: TipoEjercicio; label: string }[] = [
  { value: 'opcion_multiple', label: 'Opción múltiple' },
  { value: 'predecir_salida', label: 'Predecir salida' },
  { value: 'completar_codigo', label: 'Completar código' },
  { value: 'ordenar_lineas', label: 'Ordenar líneas' },
];
const IDS = ['A', 'B', 'C', 'D', 'E', 'F'];
const CON_OPCIONES: TipoEjercicio[] = ['opcion_multiple', 'predecir_salida', 'ordenar_lineas'];
const XP_POR_NIVEL: Record<NivelDificultad, number> = { basico: 10, intermedio: 15, avanzado: 20 };

/** Dónde se guarda el ejercicio: un tema (práctica) o el examen de una unidad. */
export type DestinoEjercicio =
  | { tipo: 'tema'; temaId: number; etiqueta: string }
  | {
    tipo: 'examen'; unidadId: number; etiqueta: string; temas: { id: number; etiqueta: string }[];
    /** Nombres de los temas de otras unidades: una pregunta puede integrar contenidos anteriores. */
    otrosTemas?: { id: number; etiqueta: string }[];
  };

interface FormState {
  titulo: string; categoria: string; nivel: NivelDificultad; tipo: TipoEjercicio;
  enunciado: string; codigoPython: string; opciones: { id: string; texto: string }[];
  respuestaCorrecta: string; explicacionIa: string; activo: boolean; temasIntegrados: number[];
}

const vacio = (nivel: NivelDificultad): FormState => ({
  titulo: '', categoria: '', nivel, tipo: 'opcion_multiple', enunciado: '', codigoPython: '',
  opciones: IDS.slice(0, 4).map((id) => ({ id, texto: '' })),
  respuestaCorrecta: 'A', explicacionIa: '', activo: true, temasIntegrados: [],
});

/**
 * Formulario de un ejercicio YA UBICADO: se abre desde un tema o desde el
 * examen de una unidad, así que el docente no vuelve a elegir dónde va. En el
 * examen el nivel es siempre intermedio y se marcan los 2 o 3 temas que combina.
 */
export function EjercicioForm({ open, onClose, onGuardado, destino, ejercicio, nivelInicial = 'basico' }: {
  open: boolean; onClose: () => void; onGuardado: () => void;
  destino: DestinoEjercicio; ejercicio?: DocenteEjercicio | null; nivelInicial?: NivelDificultad;
}) {
  const esExamen = destino.tipo === 'examen';
  const [form, setForm] = useState<FormState>(vacio(nivelInicial));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (!open) return;
    setErrores({}); setApiError('');
    if (!ejercicio) { setForm(vacio(esExamen ? 'intermedio' : nivelInicial)); return; }
    const ops = Array.isArray(ejercicio.opciones) && ejercicio.opciones.length
      ? ejercicio.opciones.map((o) => ({ id: o.id, texto: o.texto }))
      : vacio('basico').opciones;
    setForm({
      titulo: ejercicio.titulo, categoria: ejercicio.categoria,
      nivel: ejercicio.nivel_dificultad ?? nivelDesdeEstrellas(ejercicio.estrellas), tipo: ejercicio.tipo,
      enunciado: ejercicio.enunciado, codigoPython: ejercicio.codigoPython ?? '', opciones: ops,
      respuestaCorrecta: ejercicio.respuestaCorrecta, explicacionIa: ejercicio.explicacionIa ?? '',
      activo: ejercicio.activo, temasIntegrados: ejercicio.temas_integrados ?? [],
    });
  }, [open, ejercicio, nivelInicial, esExamen]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (form.enunciado.trim().length < 3) e.enunciado = 'Escribe el enunciado.';
    if (CON_OPCIONES.includes(form.tipo)) {
      if (form.opciones.some((o) => !o.texto.trim())) e.opciones = 'Todas las opciones deben tener texto.';
      if (form.tipo !== 'ordenar_lineas' && !form.opciones.some((o) => o.id === form.respuestaCorrecta)) e.respuestaCorrecta = 'Marca la respuesta correcta.';
    } else if (!form.respuestaCorrecta.trim()) {
      e.respuestaCorrecta = 'Escribe la respuesta esperada.';
    }
    if (esExamen && (form.temasIntegrados.length < 2 || form.temasIntegrados.length > 3)) e.temas = 'Marca 2 o 3 temas que la pregunta combina.';
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true); setApiError('');
    const enunciado = form.enunciado.trim();
    const payload = {
      // Título y categoría son opcionales para el docente: se completan solos.
      titulo: (form.titulo.trim() || enunciado).slice(0, 160),
      categoria: form.categoria.trim() || 'General',
      temaId: destino.tipo === 'tema' ? destino.temaId : form.temasIntegrados[0],
      banco: esExamen ? 'examen' : 'practica',
      estrellas: estrellasDesdeNivel(form.nivel),
      tipo: form.tipo, enunciado, codigoPython: form.codigoPython.trim() || undefined,
      opciones: CON_OPCIONES.includes(form.tipo) ? form.opciones.map((o) => ({ id: o.id, texto: o.texto.trim() })) : undefined,
      respuestaCorrecta: form.tipo === 'ordenar_lineas' ? form.opciones.map((o) => o.id).join(',') : form.respuestaCorrecta,
      xp: ejercicio?.xp ?? XP_POR_NIVEL[form.nivel],
      explicacionIa: form.explicacionIa.trim() || undefined, activo: form.activo,
      temasIntegrados: esExamen ? form.temasIntegrados : [],
    };
    try {
      if (ejercicio) await api.put(`/docente/ejercicios/${ejercicio.id}`, payload);
      else await api.post('/docente/ejercicios', payload);
      onGuardado();
      onClose();
    } catch (err) { setApiError(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  const setOpcion = (i: number, texto: string) => setForm((f) => ({ ...f, opciones: f.opciones.map((o, j) => (j === i ? { ...o, texto } : o)) }));
  const addOpcion = () => setForm((f) => (f.opciones.length >= 6 ? f : { ...f, opciones: [...f.opciones, { id: IDS[f.opciones.length], texto: '' }] }));
  const delOpcion = (i: number) => setForm((f) => {
    if (f.opciones.length <= 2) return f;
    const nuevas = f.opciones.filter((_, j) => j !== i).map((o, j) => ({ id: IDS[j], texto: o.texto }));
    return { ...f, opciones: nuevas, respuestaCorrecta: nuevas.some((o) => o.id === f.respuestaCorrecta) ? f.respuestaCorrecta : nuevas[0].id };
  });
  const moverOpcion = (i: number, dir: -1 | 1) => setForm((f) => {
    const j = i + dir;
    if (j < 0 || j >= f.opciones.length) return f;
    const nuevas = [...f.opciones];
    [nuevas[i], nuevas[j]] = [nuevas[j], nuevas[i]];
    return { ...f, opciones: nuevas };
  });
  const alternarTema = (id: number) => setForm((f) => ({
    ...f,
    temasIntegrados: f.temasIntegrados.includes(id) ? f.temasIntegrados.filter((x) => x !== id) : [...f.temasIntegrados, id],
  }));

  const sustantivo = esExamen ? 'pregunta' : 'ejercicio';
  return (
    <Modal open={open} onClose={onClose} title={`${ejercicio ? 'Editar' : esExamen ? 'Nueva' : 'Nuevo'} ${sustantivo}`} size="lg"
      footer={<>
        <button onClick={onClose} className="btn-ghost">Cancelar</button>
        <button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar'}</button>
      </>}>
      <p className="mb-4 rounded-xl bg-subtle px-3.5 py-2.5 text-sm text-muted">
        Se guardará en <b className="text-fg">{destino.etiqueta}</b>{esExamen ? ' · nivel intermedio' : ''}.
      </p>
      {apiError && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{apiError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {destino.tipo === 'examen' && (
          <div className="sm:col-span-2">
            <Field label="Temas que combina esta pregunta" error={errores.temas} hint="Cada pregunta del examen integra 2 o 3 temas o subtemas de la unidad.">
              <div className="flex flex-wrap gap-2">
                {destino.temas.map((t) => {
                  const activo = form.temasIntegrados.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => alternarTema(t.id)} aria-pressed={activo}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${activo ? 'border-prexi-blue bg-prexi-blue text-white' : 'border-line text-muted hover:text-fg'}`}>
                      {t.etiqueta}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}

        <Field label="Tipo de pregunta">
          <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoEjercicio })}>
            {TIPOS_EJERCICIO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
        {!esExamen && (
          <Field label="Nivel">
            <Select value={form.nivel} onChange={(e) => setForm({ ...form, nivel: e.target.value as NivelDificultad })}>
              {NIVELES.map((n) => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
            </Select>
          </Field>
        )}

        <div className="sm:col-span-2"><Field label="Enunciado" error={errores.enunciado}><Textarea value={form.enunciado} onChange={(e) => setForm({ ...form, enunciado: e.target.value })} placeholder="¿Qué debe resolver el estudiante?" /></Field></div>
        <div className="sm:col-span-2"><Field label="Código Python (opcional)" hint="Se muestra como bloque de código."><Textarea value={form.codigoPython} onChange={(e) => setForm({ ...form, codigoPython: e.target.value })} className="font-mono text-sm" placeholder={'print(2 + 3)'} /></Field></div>

        {form.tipo === 'completar_codigo' ? (
          <div className="sm:col-span-2">
            <Field label="Respuesta esperada" error={errores.respuestaCorrecta} hint='Si hay varias formas válidas, sepáralas con "|". Ej.: for i in range(10)|for i in range(0,10)'>
              <Input value={form.respuestaCorrecta} onChange={(e) => setForm({ ...form, respuestaCorrecta: e.target.value })} placeholder="Ej.: for i in range(10)" />
            </Field>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-fg">{form.tipo === 'ordenar_lineas' ? 'Líneas de código (en el orden correcto)' : 'Opciones de respuesta'}</span>
              {form.opciones.length < 6 && <button type="button" onClick={addOpcion} className="text-xs font-semibold text-prexi-blue-deep hover:underline">+ Agregar {form.tipo === 'ordenar_lineas' ? 'línea' : 'opción'}</button>}
            </div>
            {errores.opciones && <p className="mb-2 text-xs text-prexi-red">{errores.opciones}</p>}
            {errores.respuestaCorrecta && <p className="mb-2 text-xs text-prexi-red">{errores.respuestaCorrecta}</p>}
            <div className="space-y-2">
              {form.opciones.map((o, i) => (
                <div key={o.id} className="flex items-center gap-2">
                  {form.tipo === 'ordenar_lineas' ? (
                    <div className="flex shrink-0 flex-col">
                      <button type="button" disabled={i === 0} onClick={() => moverOpcion(i, -1)} aria-label="Subir línea" className="grid h-4 w-7 place-items-center text-muted hover:text-prexi-blue-deep disabled:opacity-20"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={i === form.opciones.length - 1} onClick={() => moverOpcion(i, 1)} aria-label="Bajar línea" className="grid h-4 w-7 place-items-center text-muted hover:text-prexi-blue-deep disabled:opacity-20"><ChevronDown className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <input type="radio" name="correcta" title="Marcar como correcta" checked={form.respuestaCorrecta === o.id} onChange={() => setForm({ ...form, respuestaCorrecta: o.id })} className="h-4 w-4 shrink-0 accent-prexi-blue" />
                  )}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subtle text-sm font-bold text-muted">{form.tipo === 'ordenar_lineas' ? i + 1 : o.id}</span>
                  <Input value={o.texto} onChange={(e) => setOpcion(i, e.target.value)} placeholder={form.tipo === 'ordenar_lineas' ? `Línea ${i + 1}` : `Opción ${o.id}`} className={form.tipo === 'ordenar_lineas' ? 'font-mono text-sm' : ''} />
                  {form.opciones.length > 2 && <button type="button" onClick={() => delOpcion(i)} aria-label="Quitar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{form.tipo === 'ordenar_lineas' ? 'Escríbelas en el orden correcto: el estudiante las verá desordenadas.' : 'Marca el círculo de la opción correcta.'}</p>
          </div>
        )}

        <div className="sm:col-span-2"><Field label="Explicación (opcional)" hint="Se muestra al estudiante tras responder y acompaña a su flashcard."><Textarea value={form.explicacionIa} onChange={(e) => setForm({ ...form, explicacionIa: e.target.value })} /></Field></div>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 accent-prexi-blue" />
          <span className="text-sm font-medium text-fg">Activo (visible para los estudiantes)</span>
        </label>
      </div>
    </Modal>
  );
}
