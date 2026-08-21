'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, KeyboardSensor,
  PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, useReducedMotion } from 'framer-motion';
import { Opcion } from '@/lib/types';
import { resaltarLinea } from './highlight';
import { useSound } from '@/components/use-sound';
import { GripVertical, ChevronUp, ChevronDown, Plus, CheckCircle, AlertCircle } from '@/components/icons';
import type { ExerciseProps } from './index';

/**
 * TIPO 4 — Ordenar líneas (Parsons), LA ESTRELLA. Dos zonas: "Bloques disponibles"
 * (banco) y "Tu solución". Se arrastra entre zonas y se reordena dentro (@dnd-kit,
 * con teclado y ▲▼ para táctil). La solución muestra una columna que enhebra los
 * bloques, numeración que se reordena en vivo y guías de indentación (la sangría
 * viene en el texto → automática; `evaluaIndentacion` queda listo para el futuro).
 * Al comprobar: verde los bien ubicados, ámbar los mal; si falla, los bloques
 * "vuelan" a su posición correcta.
 *
 * Contrato backend (`ordenar_lineas`): ids en orden, separados por coma (solo se
 * evalúa el ORDEN). "Comprobar" se habilita cuando el banco queda vacío.
 */

const INDENT_REM = 1.4;

function nivelIndent(texto: string): number {
  const m = texto.match(/^[ \t]*/);
  const esp = m ? m[0].replace(/\t/g, '    ').length : 0;
  return Math.min(6, Math.floor(esp / 4));
}
function limpiar(texto: string): string { return texto.replace(/^[ \t]+/, ''); }

function barajarIds(arr: Opcion[]): string[] {
  const ids = arr.map((o) => o.id);
  if (ids.length < 2) return ids;
  const orig = ids.join(',');
  for (let k = 0; k < 8; k++) {
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.join(',') !== orig) return a;
  }
  return [...ids].reverse();
}

type Zona = 'banco' | 'solucion';

export function OrdenarLineas({ ejercicio, resultado, onChange }: ExerciseProps) {
  const reduce = useReducedMotion();
  const { playClick } = useSound();
  const byId = useMemo(() => new Map(ejercicio.opciones.map((o) => [o.id, o])), [ejercicio.opciones]);
  const [listas, setListas] = useState<Record<Zona, string[]>>(() => ({ banco: barajarIds(ejercicio.opciones), solucion: [] }));
  const [activo, setActivo] = useState<string | null>(null);
  const enviado = !!resultado;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // La respuesta solo está lista cuando TODO está en la solución (banco vacío).
  useEffect(() => {
    onChange(listas.banco.length === 0 && listas.solucion.length > 0 ? listas.solucion.join(',') : null);
  }, [listas, onChange]);

  const contenedor = (id: string): Zona | undefined =>
    id === 'banco' || id === 'solucion' ? (id as Zona) : (['banco', 'solucion'] as Zona[]).find((z) => listas[z].includes(id));

  const onDragStart = (e: DragStartEvent) => setActivo(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = contenedor(String(active.id));
    const to = contenedor(String(over.id));
    if (!from || !to || from === to) return;
    setListas((prev) => {
      const origen = prev[from].filter((id) => id !== active.id);
      const destinoPrev = prev[to];
      const overIsZona = over.id === 'banco' || over.id === 'solucion';
      const idx = overIsZona ? destinoPrev.length : Math.max(0, destinoPrev.indexOf(String(over.id)));
      const destino = [...destinoPrev.slice(0, idx), String(active.id), ...destinoPrev.slice(idx)];
      return { ...prev, [from]: origen, [to]: destino };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActivo(null);
    const { active, over } = e;
    if (!over) return;
    const from = contenedor(String(active.id));
    const to = contenedor(String(over.id));
    if (from && to && from === to && active.id !== over.id) {
      setListas((prev) => {
        const items = prev[to];
        const oldIndex = items.indexOf(String(active.id));
        const newIndex = over.id === to ? items.length - 1 : items.indexOf(String(over.id));
        return newIndex < 0 ? prev : { ...prev, [to]: arrayMove(items, oldIndex, newIndex) };
      });
    }
    playClick();
  };

  // Acciones táctiles/teclado sin arrastre.
  const enviarASolucion = (id: string) => { setListas((p) => ({ banco: p.banco.filter((x) => x !== id), solucion: [...p.solucion, id] })); playClick(); };
  const moverSolucion = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= listas.solucion.length) return;
    setListas((p) => ({ ...p, solucion: arrayMove(p.solucion, i, j) })); playClick();
  };
  const devolverABanco = (id: string) => { setListas((p) => ({ banco: [...p.banco, id], solucion: p.solucion.filter((x) => x !== id) })); playClick(); };

  // Modo REVISIÓN (ya enviado): estático + "vuelo" a la posición correcta.
  if (enviado) {
    return <Revision opciones={listas.solucion.map((id) => byId.get(id)!).filter(Boolean)} correctas={resultado!.respuesta_correcta} reduce={!!reduce} />;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActivo(null)}>
      {/* data-sonido-off: mover/enviar/arrastrar ya reproducen su propio click. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-sonido-off>
        {/* Banco */}
        <Zona id="banco" titulo="Bloques disponibles" fondo="bg-subtle/60 border-line" vacio="Arrastra los bloques aquí para quitarlos de la solución.">
          <SortableContext items={listas.banco} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {listas.banco.map((id) => (
                <Bloque key={id} opcion={byId.get(id)!} zona="banco" onAccion={() => enviarASolucion(id)} accionLabel="Enviar a la solución" AccionIcon={Plus} />
              ))}
              {listas.banco.length === 0 && <li className="rounded-lg border border-dashed border-white/10 py-6 text-center text-xs text-slate-500">Todo colocado</li>}
            </ul>
          </SortableContext>
        </Zona>

        {/* Solución */}
        <Zona id="solucion" titulo="Tu solución" fondo="border-[#0E3F7E] bg-[#04162E]" oscura vacio="Suelta aquí los bloques y ordénalos.">
          {/* Columna que enhebra los bloques */}
          {listas.solucion.length > 1 && <span aria-hidden className="pointer-events-none absolute bottom-6 left-[26px] top-11 w-px bg-white/12" />}
          <SortableContext items={listas.solucion} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {listas.solucion.map((id, i) => (
                <Bloque key={id} opcion={byId.get(id)!} zona="solucion" pos={i + 1} index={i} total={listas.solucion.length}
                  onMover={moverSolucion} onAccion={() => devolverABanco(id)} accionLabel="Devolver al banco" AccionIcon={ChevronUp} devolver />
              ))}
              {listas.solucion.length === 0 && <li className="rounded-lg border border-dashed border-white/15 py-6 text-center text-xs text-slate-500">Arrastra aquí el primer bloque.</li>}
            </ol>
          </SortableContext>
        </Zona>
      </div>

      <p className="mt-2 text-[11px] text-muted">
        Arrastra desde el <GripVertical className="inline h-3 w-3 align-[-2px]" />, usa ▲▼ para mover, o toca <Plus className="inline h-3 w-3 align-[-2px]" /> para enviar a la solución. La sangría se aplica sola.
      </p>

      <DragOverlay dropAnimation={null}>
        {activo ? <TarjetaBloque opcion={byId.get(activo)!} arrastrando /> : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ── Zona (contenedor droppable) ── */
function Zona({ id, titulo, fondo, oscura, vacio, children }: {
  id: Zona; titulo: string; fondo: string; oscura?: boolean; vacio: string; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div>
      <p className={`mb-2 text-[11px] font-bold uppercase tracking-wide ${oscura ? 'text-prexi-blue-deep' : 'text-muted'}`}>{titulo}</p>
      <div ref={setNodeRef} title={vacio} className={`relative min-h-[7rem] rounded-xl border p-3 shadow-lift transition-colors ${fondo} ${isOver ? 'ring-2 ring-prexi-blue/50' : ''}`}>
        {children}
      </div>
    </div>
  );
}

/* ── Bloque sortable (dentro de una zona) ── */
function Bloque({ opcion, zona, pos, index, total, onMover, onAccion, accionLabel, AccionIcon, devolver }: {
  opcion: Opcion; zona: Zona; pos?: number; index?: number; total?: number;
  onMover?: (i: number, dir: -1 | 1) => void; onAccion: () => void; accionLabel: string;
  AccionIcon: React.ComponentType<{ className?: string }>; devolver?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opcion.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const enSolucion = zona === 'solucion';

  return (
    <li ref={setNodeRef} style={style} className={`relative flex items-stretch gap-2 ${isDragging ? 'z-10 opacity-40' : ''}`}>
      {enSolucion && (
        <span className="relative z-10 mt-[9px] grid h-5 w-5 shrink-0 place-items-center self-start rounded-full bg-[#0E3F7E] text-[11px] font-bold text-white ring-2 ring-[#04162E]" style={{ fontVariantNumeric: 'tabular-nums' }}>{pos}</span>
      )}

      {/* ▲▼ solo en solución (táctil) */}
      {enSolucion && onMover != null && (
        <div className="flex shrink-0 flex-col justify-center">
          <button type="button" disabled={index === 0} onClick={() => onMover(index!, -1)} aria-label={`Subir a la posición ${(pos ?? 1) - 1}`}
            className="grid h-5 w-6 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-sky-300 disabled:opacity-20"><ChevronUp className="h-4 w-4" /></button>
          <button type="button" disabled={index === (total ?? 1) - 1} onClick={() => onMover(index!, 1)} aria-label={`Bajar a la posición ${(pos ?? 1) + 1}`}
            className="grid h-5 w-6 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-sky-300 disabled:opacity-20"><ChevronDown className="h-4 w-4" /></button>
        </div>
      )}

      <TarjetaBloque opcion={opcion} handleProps={{ ...attributes, ...listeners }} />

      {/* Acción de toque: banco→solución (Plus) o solución→banco (X-ish) */}
      <button type="button" onClick={onAccion} aria-label={accionLabel}
        className="shrink-0 self-center rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:border-prexi-blue/50 hover:text-sky-300">
        {devolver ? <ChevronUp className="h-4 w-4 rotate-90" /> : <AccionIcon className="h-4 w-4" />}
      </button>
    </li>
  );
}

/* ── Tarjeta visual del bloque (compartida con el DragOverlay) ── */
function TarjetaBloque({ opcion, handleProps, arrastrando, estado }: {
  opcion: Opcion; handleProps?: Record<string, unknown>; arrastrando?: boolean; estado?: 'ok' | 'mal';
}) {
  const nivel = nivelIndent(opcion.texto);
  const texto = limpiar(opcion.texto);
  const borde = estado === 'ok' ? 'border-[#22C55E]/70 bg-[#22C55E]/10'
    : estado === 'mal' ? 'border-amber-400/70 bg-amber-500/10'
    : arrastrando ? 'border-prexi-blue bg-[#0A2A52] shadow-xl'
    : 'border-white/10 bg-[#0A1B33] hover:border-prexi-blue/50';
  return (
    <div className={`relative flex min-w-0 flex-1 items-center gap-2 rounded-lg border py-2 pr-3 transition-colors ${borde}`} style={{ paddingLeft: `${0.5 + nivel * INDENT_REM}rem` }}>
      {Array.from({ length: nivel }).map((_, k) => (
        <span key={k} aria-hidden className="pointer-events-none absolute top-1 bottom-1 w-px bg-white/10" style={{ left: `${0.5 + k * INDENT_REM}rem` }} />
      ))}
      {handleProps
        ? <button type="button" {...handleProps} aria-label={`Arrastrar: ${texto}`} className="shrink-0 cursor-grab touch-none rounded text-slate-500 transition hover:text-slate-200 focus-visible:text-sky-300 active:cursor-grabbing"><GripVertical className="h-4 w-4" /></button>
        : <GripVertical className="h-4 w-4 shrink-0 text-slate-500" />}
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre font-mono text-[13px] leading-6 text-slate-100">{resaltarLinea(texto)}</pre>
      {estado === 'ok' && <CheckCircle className="h-4 w-4 shrink-0 text-[#22C55E]" />}
      {estado === 'mal' && <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />}
    </div>
  );
}

/* ── Revisión: marca verde/ámbar y, si hay error, "vuela" al orden correcto ── */
function Revision({ opciones, correctas, reduce }: { opciones: Opcion[]; correctas: string; reduce: boolean }) {
  const correctOrder = useMemo(() => correctas.split(',').map((s) => s.trim().toUpperCase()), [correctas]);
  const [orden, setOrden] = useState<Opcion[]>(opciones);
  const revelado = useRef(false);

  const todoBien = orden.every((o, i) => correctOrder[i] === o.id.trim().toUpperCase());

  useEffect(() => {
    if (todoBien || revelado.current) return;
    revelado.current = true;
    const t = setTimeout(() => {
      const porId = new Map(opciones.map((o) => [o.id.trim().toUpperCase(), o]));
      setOrden(correctOrder.map((id) => porId.get(id)).filter((o): o is Opcion => !!o));
    }, 1400);
    return () => clearTimeout(t);
  }, [todoBien, correctOrder, opciones]);

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-prexi-blue-deep">Tu solución</p>
      <div className="relative rounded-xl border border-[#0E3F7E] bg-[#04162E] p-3 shadow-lift">
        {orden.length > 1 && <span aria-hidden className="pointer-events-none absolute bottom-5 left-[26px] top-5 w-px bg-white/12" />}
        <ol className="space-y-2">
          {orden.map((o, i) => {
            const ok = correctOrder[i] === o.id.trim().toUpperCase();
            return (
              <motion.li key={o.id} layout={!reduce} transition={{ type: 'spring', stiffness: 500, damping: 34 }} className="relative flex items-stretch gap-2">
                <span className="relative z-10 mt-[9px] grid h-5 w-5 shrink-0 place-items-center self-start rounded-full bg-[#0E3F7E] text-[11px] font-bold text-white ring-2 ring-[#04162E]" style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                <TarjetaBloque opcion={o} estado={ok ? 'ok' : 'mal'} />
              </motion.li>
            );
          })}
        </ol>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5 text-[#22C55E]" /> En su lugar</span>
        <span className="inline-flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 text-amber-400" /> Fuera de lugar {todoBien ? '' : '· se reacomodan al orden correcto'}</span>
      </p>
    </div>
  );
}
