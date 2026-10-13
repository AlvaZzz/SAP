'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { NivelDificultad, NIVEL_LABEL, TemaDocente } from '@/lib/types';
import { Badge, Skeleton, Field, Input, Textarea, Select } from '@/components/ui';
import { NIVELES } from '@/components/nivel-badge';
import { Plus, Edit, Trash2, Sparkles, Eye, EyeOff } from '@/components/icons';

const META = 10;

interface FlashcardDocente {
  id: number; temaId: number; ejercicioId: number | null; frente: string; reverso: string;
  explicacion: string | null; codigoPython: string | null; nivel: NivelDificultad; activo: boolean;
}
interface Respuesta { flashcards: FlashcardDocente[]; ejercicios_disponibles: number; ejercicios_sin_tarjeta: number }
interface Borrador { id: number | null; frente: string; reverso: string; explicacion: string; nivel: NivelDificultad }
const VACIO: Borrador = { id: null, frente: '', reverso: '', explicacion: '', nivel: 'basico' };

/** Flashcards de un tema: se generan desde sus ejercicios o se escriben a mano. */
export function FlashcardsTema({ tema, onCambio }: { tema: TemaDocente; onCambio: () => void }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [generando, setGenerando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await api.get<Respuesta>(`/docente/flashcards?tema=${tema.id}`).catch(() => null);
    if (r) setDatos(r);
  }, [tema.id]);
  useEffect(() => { setDatos(null); setAviso(''); setError(''); setBorrador(null); cargar(); }, [cargar]);
  const refrescar = async () => { await cargar(); onCambio(); };

  async function generar() {
    setGenerando(true); setError(''); setAviso('');
    try {
      const r = await api.post<{ creadas: number; mensaje: string }>('/docente/flashcards/generar', { temaId: tema.id });
      setAviso(r.mensaje); await refrescar();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudieron generar las flashcards.'); }
    finally { setGenerando(false); }
  }

  async function guardar() {
    if (!borrador) return;
    if (borrador.frente.trim().length < 3 || !borrador.reverso.trim()) { setError('Escribe la pregunta y su respuesta.'); return; }
    setGuardando(true); setError('');
    const cuerpo = { frente: borrador.frente, reverso: borrador.reverso, explicacion: borrador.explicacion, nivel: borrador.nivel };
    try {
      if (borrador.id) await api.put(`/docente/flashcards/${borrador.id}`, cuerpo);
      else await api.post('/docente/flashcards', { ...cuerpo, temaId: tema.id });
      setBorrador(null); await refrescar();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo guardar la flashcard.'); }
    finally { setGuardando(false); }
  }
  async function alternar(f: FlashcardDocente) { await api.put(`/docente/flashcards/${f.id}`, { activo: !f.activo }).catch(() => undefined); await refrescar(); }
  async function eliminar(f: FlashcardDocente) {
    if (!confirm('¿Eliminar esta flashcard?')) return;
    await api.del(`/docente/flashcards/${f.id}`).catch(() => undefined); await refrescar();
  }

  if (!datos) return <Skeleton className="h-40" />;
  const activas = datos.flashcards.filter((f) => f.activo).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-lg font-bold text-fg">Flashcards de {tema.numero} {tema.titulo}</p>
            <p className="text-sm text-muted">
              {activas >= META ? `Listo: ya hay ${activas}.` : `Llevas ${activas} de ${META}. ${META - activas === 1 ? 'Te falta 1' : `Te faltan ${META - activas}`}.`}
              {' '}Cada estudiante verá las de su nivel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setBorrador(VACIO); setError(''); }} className="btn-ghost"><Plus className="h-4 w-4" /> Escribir una flashcard</button>
            <button onClick={generar} disabled={generando || datos.ejercicios_sin_tarjeta === 0} className="btn-primary disabled:opacity-50"
              title={datos.ejercicios_disponibles === 0 ? 'Primero crea ejercicios en el paso 2' : datos.ejercicios_sin_tarjeta === 0 ? 'Todos tus ejercicios ya tienen flashcard' : undefined}>
              <Sparkles className="h-4 w-4" /> {generando ? 'PREXI está escribiendo…' : `Generar desde mis ejercicios (${datos.ejercicios_sin_tarjeta})`}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          {datos.ejercicios_disponibles === 0
            ? 'Este tema todavía no tiene ejercicios: vuelve al paso 2 para crearlos y PREXI podrá convertirlos en flashcards.'
            : datos.ejercicios_sin_tarjeta === 0
              ? 'Todos los ejercicios de este tema ya tienen su flashcard.'
              : `PREXI toma los ${datos.ejercicios_sin_tarjeta} ejercicios de este tema que aún no tienen flashcard y crea una por cada uno. Después puedes editarlas.`}
        </p>
        {aviso && <p className="mt-3 rounded-lg bg-prexi-green/10 px-3 py-2 text-sm text-prexi-green" role="status">{aviso}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red" role="alert">{error}</p>}
      </div>

      {borrador && (
        <div className="space-y-3 rounded-2xl border border-prexi-blue/50 bg-card p-4">
          <p className="font-bold text-fg">{borrador.id ? 'Editar flashcard' : 'Nueva flashcard'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Frente: la pregunta" hint="Lo que el estudiante lee primero.">
              <Textarea rows={3} value={borrador.frente} onChange={(e) => setBorrador({ ...borrador, frente: e.target.value })} placeholder="Ej.: ¿Qué tipo de dato es 3.14 en Python?" />
            </Field>
            <Field label="Reverso: la respuesta" hint="Lo que ve al voltear la tarjeta.">
              <Textarea rows={3} value={borrador.reverso} onChange={(e) => setBorrador({ ...borrador, reverso: e.target.value })} placeholder="Ej.: float (número decimal)" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <Field label="Explicación breve (opcional)" hint="Una frase que ayude a recordarla.">
              <Input value={borrador.explicacion} onChange={(e) => setBorrador({ ...borrador, explicacion: e.target.value })} placeholder="Ej.: Todo número con punto decimal es float." />
            </Field>
            <Field label="Nivel">
              <Select value={borrador.nivel} onChange={(e) => setBorrador({ ...borrador, nivel: e.target.value as NivelDificultad })}>
                {NIVELES.map((n) => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setBorrador(null)} className="btn-ghost">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-60">{guardando ? 'Guardando…' : 'Guardar flashcard'}</button>
          </div>
        </div>
      )}

      {datos.flashcards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          Aún no hay flashcards en este tema. Mientras tanto, los estudiantes ven tarjetas armadas automáticamente con los ejercicios.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {datos.flashcards.map((f) => (
            <div key={f.id} className={`flex flex-col rounded-xl border border-line bg-card p-3 ${f.activo ? '' : 'opacity-60'}`}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Badge tone="slate">{NIVEL_LABEL[f.nivel]}</Badge>
                {!f.activo && <Badge tone="slate">Oculta</Badge>}
              </div>
              <p className="text-2xs font-bold uppercase tracking-wide text-muted">Frente</p>
              <p className="line-clamp-3 text-sm text-fg">{f.frente}</p>
              <p className="mt-2 text-2xs font-bold uppercase tracking-wide text-muted">Reverso</p>
              <p className="line-clamp-2 text-sm font-semibold text-prexi-green">{f.reverso}</p>
              <div className="mt-auto flex items-center justify-end gap-1 pt-2">
                <button onClick={() => { setBorrador({ id: f.id, frente: f.frente, reverso: f.reverso, explicacion: f.explicacion ?? '', nivel: f.nivel }); setError(''); }} className="btn-ghost !px-2.5 !py-1 text-xs"><Edit className="h-3.5 w-3.5" /> Editar</button>
                <button onClick={() => alternar(f)} title={f.activo ? 'Ocultar a los estudiantes' : 'Mostrar a los estudiantes'} aria-label={f.activo ? 'Ocultar' : 'Mostrar'} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-prexi-blue-deep">{f.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                <button onClick={() => eliminar(f)} title="Eliminar" aria-label="Eliminar" className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-prexi-red"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
