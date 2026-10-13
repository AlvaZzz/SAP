'use client';

import { useMemo, useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, KeyboardSensor, PointerSensor,
  useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { motion, useReducedMotion } from 'framer-motion';
import { resaltarLinea } from './highlight';
import { useSound } from '@/components/use-sound';
import { CheckCircle, AlertCircle } from '@/components/icons';
import type { ExerciseProps } from './index';

/**
 * TIPO 3 — Completar. Tiene DOS modos según dónde esté el hueco (`__`):
 *
 *  · modo `codigo` — el hueco vive en `codigoPython`. Se renderiza EMBEBIDO en la
 *    línea como campo inline (no input suelto), integrado en el resaltado. Se
 *    responde tecleando en el hueco (glow azul al enfocar) o ARRASTRANDO una ficha
 *    (`and`, `else`, `:` …) — con animación de "encaje"; en móvil basta tocarla.
 *  · modo `texto` — el ejercicio NO trae código y el hueco está en el ENUNCIADO
 *    (ej. "…siempre acaba se llama ______."). Buena parte del banco oficial de la
 *    UPEA es de este tipo: completar un término, no código. Se muestra un único
 *    campo de respuesta; sin la carcasa de editor, que aquí sería engañosa.
 *
 * Sin este segundo modo los ítems sin código quedan SIN forma de responder (el
 * editor sale vacío y "Comprobar" nunca se habilita).
 *
 * Autocompletado/ortografía desactivados en ambos modos.
 *
 * Contrato backend (`completar_codigo`): se envía el TEXTO. Con un solo hueco (los
 * datos actuales) el texto es su valor; con varios, se unen por espacio.
 */
type Segmento = { tipo: 'texto'; valor: string } | { tipo: 'hueco'; idx: number };

export function CompletarCodigo({ ejercicio, resultado, onChange }: ExerciseProps) {
  const { playClick } = useSound();
  const reduce = useReducedMotion();
  const enviado = !!resultado;

  const { lineas, totalHuecos, modo } = useMemo(() => {
    const src = (ejercicio.codigoPython ?? '').replace(/\s+$/, '');
    // Solo hay modo código si REALMENTE hay código con al menos un hueco; si no,
    // el hueco está en el enunciado y se responde con un campo único.
    if (!/_{2,}/.test(src)) return { lineas: [] as Segmento[][], totalHuecos: 1, modo: 'texto' as const };
    let n = 0;
    const lineas = src.split('\n').map((linea) =>
      linea.split(/(_{2,})/).map((p): Segmento => (/^_{2,}$/.test(p) ? { tipo: 'hueco', idx: n++ } : { tipo: 'texto', valor: p })),
    );
    return { lineas, totalHuecos: n, modo: 'codigo' as const };
  }, [ejercicio.codigoPython]);

  const [valores, setValores] = useState<Record<number, string>>({});
  const [foco, setFoco] = useState(0);
  const [pop, setPop] = useState<number | null>(null);
  const [chipActivo, setChipActivo] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const emitir = (next: Record<number, string>) => {
    const llenos = Array.from({ length: totalHuecos }, (_, i) => (next[i] ?? '').trim());
    onChange(totalHuecos > 0 && llenos.every(Boolean) ? llenos.join(' ') : null);
  };
  const setHueco = (idx: number, v: string) => { const next = { ...valores, [idx]: v }; setValores(next); emitir(next); };

  const colocar = (idx: number, texto: string) => {
    if (enviado) return;
    setHueco(idx, texto);
    setPop(idx); setTimeout(() => setPop((p) => (p === idx ? null : p)), 320);
    const sig = Array.from({ length: totalHuecos }, (_, i) => i).find((i) => i !== idx && !valores[i]);
    if (sig != null) setFoco(sig);
    playClick();
  };
  // Chip por toque/teclado: cae en el hueco enfocado (o el primero vacío).
  const usarChip = (texto: string) => {
    const destino = !valores[foco] ? foco : (Array.from({ length: totalHuecos }, (_, i) => i).find((i) => !valores[i]) ?? foco);
    colocar(destino, texto);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setChipActivo(null);
    const { over, active } = e;
    if (over && String(over.id).startsWith('hueco-')) colocar(Number(String(over.id).slice(6)), String(active.data.current?.texto ?? ''));
  };
  const onDragStart = (e: DragStartEvent) => setChipActivo(String(e.active.data.current?.texto ?? ''));

  const anchoCh = (idx: number) => Math.max(3, (valores[idx]?.length ?? 0) + 1);
  const correcto = resultado?.correcto ?? false;
  const esperado = resultado?.respuesta_correcta ?? '';

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setChipActivo(null)}>
      {/* Modo TEXTO: el hueco está en el enunciado → un único campo de respuesta. */}
      {modo === 'texto' && (
        <div className="rounded-xl border border-line bg-subtle p-4">
          <label htmlFor="respuesta-completar" className="mb-2 block text-2xs font-bold uppercase tracking-wide text-muted">
            Completa el espacio en blanco
          </label>
          <input
            id="respuesta-completar"
            value={valores[0] ?? ''}
            onChange={(e) => setHueco(0, e.target.value)}
            disabled={enviado}
            spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off"
            placeholder="Escribe tu respuesta…"
            className={`w-full rounded-lg border-2 bg-card px-3 py-2.5 font-mono text-base text-fg outline-none transition-colors placeholder:font-sans placeholder:text-muted focus:border-prexi-blue focus:shadow-[0_0_0_3px_rgba(59,130,246,0.25)] disabled:opacity-70 ${
              !enviado ? 'border-line'
              : correcto ? 'border-[#22C55E] bg-[#22C55E]/10'
              : 'border-amber-400 bg-amber-500/10'
            }`}
          />
        </div>
      )}

      {/* Modo CÓDIGO: huecos embebidos en la línea (fondo editor) */}
      {modo === 'codigo' && (
      <div className="overflow-hidden rounded-xl border border-[#0E3F7E] bg-[#04162E] shadow-lift">
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#0A121F] px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-[#FF5F56]" />
          <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
          <span className="h-3 w-3 rounded-full bg-[#27C93F]" />
          <span className="ml-2 font-mono text-xs text-slate-400">completar.py</span>
        </div>
        <div className="overflow-x-auto p-4">
          <pre className="font-mono text-sm leading-7 text-slate-100">
            <code className="grid">
              {lineas.map((segs, li) => (
                <span key={li} className="whitespace-pre">
                  {segs.map((s, si) =>
                    s.tipo === 'texto'
                      ? <span key={si}>{resaltarLinea(s.valor)}</span>
                      : (
                        <Hueco
                          key={si}
                          idx={s.idx}
                          value={valores[s.idx] ?? ''}
                          ancho={anchoCh(s.idx)}
                          enviado={enviado}
                          estado={enviado ? (correcto ? 'ok' : 'mal') : 'edit'}
                          esperado={esperado}
                          pop={pop === s.idx && !reduce}
                          onInput={(v) => setHueco(s.idx, v)}
                          onFocus={() => setFoco(s.idx)}
                        />
                      ),
                  )}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
      )}

      {/* Fichas (chips) arrastrables */}
      {ejercicio.opciones.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-2xs font-bold uppercase tracking-wide text-muted">Arrastra una ficha al hueco (o tócala)</p>
          {/* data-sonido-off: las fichas ya suenan al colocarse. */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Fichas de código" data-sonido-off>
            {ejercicio.opciones.map((o) => (
              <Chip key={o.id} id={o.id} texto={o.texto} activa={Object.values(valores).includes(o.texto)} enviado={enviado} onTap={() => usarChip(o.texto)} />
            ))}
          </div>
        </div>
      )}

      {enviado && !correcto && (
        <p className="mt-3 text-sm text-muted">Respuesta esperada: <span className="font-mono font-semibold text-[#22C55E]">{esperado}</span></p>
      )}

      <DragOverlay dropAnimation={null}>
        {chipActivo != null
          ? <span className="rounded-lg border border-prexi-blue bg-card px-3 py-1.5 font-mono text-sm text-prexi-blue-deep shadow-lift">{chipActivo}</span>
          : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Hueco inline: input monoespaciado + zona droppable. Glow azul al enfocar/soltar. */
function Hueco({ idx, value, ancho, enviado, estado, esperado, pop, onInput, onFocus }: {
  idx: number; value: string; ancho: number; enviado: boolean; estado: 'edit' | 'ok' | 'mal'; esperado: string; pop: boolean;
  onInput: (v: string) => void; onFocus: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `hueco-${idx}` });
  const borde = estado === 'ok' ? 'border-[#22C55E] bg-[#22C55E]/15'
    : estado === 'mal' ? 'border-amber-400 bg-amber-500/15'
    : isOver ? 'border-prexi-blue bg-prexi-blue/25 shadow-[0_0_0_3px_rgba(59,130,246,0.4)]'
    : 'border-amber-400 bg-white/10';
  return (
    <motion.span ref={setNodeRef} className="relative mx-0.5 inline-flex" animate={pop ? { scale: [1, 1.18, 1] } : undefined} transition={{ duration: 0.3 }}>
      <input
        value={value}
        onChange={(e) => onInput(e.target.value)}
        onFocus={onFocus}
        disabled={enviado}
        spellCheck={false} autoComplete="off" autoCapitalize="off" autoCorrect="off"
        aria-label={`Hueco ${idx + 1}`}
        title={enviado && estado === 'mal' ? `Esperado: ${esperado}` : undefined}
        style={{ width: `${ancho}ch` }}
        className={`rounded-md border-b-2 px-1 text-center font-mono text-sm text-white outline-none transition-colors focus:border-prexi-blue focus:bg-prexi-blue/25 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.35)] ${borde}`}
      />
      {estado === 'ok' && <CheckCircle className="pointer-events-none absolute -right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#22C55E]" />}
      {estado === 'mal' && <AlertCircle className="pointer-events-none absolute -right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-400" />}
    </motion.span>
  );
}

/** Ficha arrastrable (y tocable). El arrastre real lo muestra el DragOverlay. */
function Chip({ id, texto, activa, enviado, onTap }: { id: string; texto: string; activa: boolean; enviado: boolean; onTap: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `chip-${id}`, data: { texto }, disabled: enviado });
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={enviado}
      onClick={onTap}
      {...attributes}
      {...listeners}
      className={`touch-none rounded-lg border px-3 py-1.5 font-mono text-sm transition ${isDragging ? 'opacity-40' : ''} ${
        activa ? 'border-prexi-blue bg-prexi-blue/10 text-prexi-blue-deep'
        : 'border-line bg-card text-fg hover:border-prexi-blue/50 hover:bg-subtle'} disabled:opacity-60`}
    >
      {texto}
    </button>
  );
}
