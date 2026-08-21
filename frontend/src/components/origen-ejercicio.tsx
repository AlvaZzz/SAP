'use client';

import { useState } from 'react';
import { CodeViewer } from '@/components/code-viewer';
import { BookOpen, ChevronDown } from '@/components/icons';

export interface OrigenReto {
  ejercicio_id: number;
  codigo: string | null;
  enunciado: string;
  tipo: 'opcion_multiple' | 'predecir_salida' | 'completar_codigo' | 'ordenar_lineas';
  nivel: 'basico' | 'intermedio' | 'avanzado';
  codigo_python: string | null;
  opciones: { id: string; texto: string }[] | null;
  unidad: number | null;
  tema: string | null;
}

/** Siglas del banco (misma convención que los documentos de ejercicios). */
const SIGLA: Record<OrigenReto['tipo'], { sigla: string; nombre: string }> = {
  opcion_multiple: { sigla: 'OM', nombre: 'Opción múltiple' },
  predecir_salida: { sigla: 'PS', nombre: 'Predecir salida' },
  completar_codigo: { sigla: 'CC', nombre: 'Completar código' },
  ordenar_lineas: { sigla: 'OL', nombre: 'Ordenar líneas' },
};

const NIVEL_LABEL: Record<OrigenReto['nivel'], string> = {
  basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado',
};

/**
 * TRAZABILIDAD DEL RETO — de qué ejercicio del banco salió.
 *
 * El mensaje es "esto pone a prueba lo que ya practicaste aquí", no una cita
 * académica: si el estudiante falla, este es el material concreto que debe
 * repasar. Por eso se muestra el ejercicio de verdad (enunciado completo, su
 * snippet y sus opciones) y no una referencia suelta.
 *
 * Va PLEGADO por defecto: la pantalla del reto ya carga editor, consola y PREXI.
 *
 * Nunca llega aquí la respuesta correcta del ejercicio origen — el backend no la
 * envía a propósito (ver RetosController.detalle).
 */
export function OrigenEjercicio({ origen }: { origen: OrigenReto }) {
  const [abierto, setAbierto] = useState(false);
  const tipo = SIGLA[origen.tipo] ?? { sigla: '—', nombre: origen.tipo };
  const ubicacion = [origen.unidad ? `U${origen.unidad}` : null, origen.tema].filter(Boolean).join(' · ');

  return (
    <section className="mt-2 overflow-hidden rounded-xl border border-line bg-subtle">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="detalle-origen"
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-card/60"
      >
        <BookOpen className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 text-sm text-fg">
          Pone a prueba lo que practicaste en{' '}
          {origen.codigo && <span className="font-mono font-semibold text-prexi-blue-deep">{origen.codigo}</span>}
          {ubicacion && <span className="text-muted"> · {ubicacion}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {abierto && (
        <div id="detalle-origen" className="border-t border-line px-4 py-3">
          {/* Metadatos del ejercicio origen */}
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-prexi-blue/15 px-2 py-0.5 text-[11px] font-bold text-prexi-blue-deep"
              title={tipo.nombre}>
              {tipo.sigla} · {tipo.nombre}
            </span>
            <span className="rounded-md bg-card px-2 py-0.5 text-[11px] font-semibold text-muted">
              {NIVEL_LABEL[origen.nivel] ?? origen.nivel}
            </span>
          </div>

          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Enunciado original</p>
          {/* Completo, sin recortar: es el material de repaso. */}
          <p className="whitespace-pre-wrap text-sm text-fg">{origen.enunciado}</p>

          {origen.codigo_python && (
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">Código del ejercicio</p>
              <CodeViewer code={origen.codigo_python} titulo={`${origen.codigo ?? 'ejercicio'}.py`} />
            </div>
          )}

          {origen.opciones && origen.opciones.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                Opciones que se planteaban
              </p>
              <ul className="space-y-1">
                {origen.opciones.map((o) => (
                  <li key={o.id} className="flex gap-2 rounded-lg bg-card px-2.5 py-1.5 text-sm text-fg">
                    <span className="font-mono font-bold text-muted">{o.id})</span>
                    <span className="min-w-0 whitespace-pre-wrap">{o.texto}</span>
                  </li>
                ))}
              </ul>
              {/* Se muestran las opciones, NO cuál era la correcta: descubrirlo
                  es justamente el trabajo del reto. */}
              <p className="mt-1.5 text-xs text-muted">
                La respuesta no se muestra: resolver el reto es la forma de comprobarla.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
