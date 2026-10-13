'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RangoEscudo } from '@/components/rango-icon';
import { Lock } from '@/components/icons';

interface RangoCatalogo { clave: string; nombre: string; orden: number; umbral: number; svgKey: string; color: string }
interface RangoInfo { clave: string; nombre: string; orden: number; svgKey: string; color: string }
interface RangoResumen {
  global: { puntaje: number; rango: RangoInfo; siguiente: { nombre: string; umbral: number; faltan: number } | null };
}

/**
 * ESCALERA DE RANGOS — los 6 rangos a la vez, como el árbol de ligas de un juego.
 *
 * Datos: `GET /gamificacion/rangos/catalogo` (los 6 peldaños) + `GET
 * /gamificacion/rangos` (dónde está el estudiante y cuánto le falta). NO se
 * recalcula nada en el cliente: el umbral y el rango alcanzado los decide el
 * backend (RangosService), aquí solo se comparan órdenes para pintar.
 */
export function EscaleraRangos() {
  const [catalogo, setCatalogo] = useState<RangoCatalogo[] | null>(null);
  const [resumen, setResumen] = useState<RangoResumen | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ rangos: RangoCatalogo[] }>('/gamificacion/rangos/catalogo').then((r) => r.rangos),
      api.get<RangoResumen>('/gamificacion/rangos'),
    ])
      .then(([c, r]) => { setCatalogo(c); setResumen(r); })
      .catch(() => { setCatalogo([]); });
  }, []);

  if (!catalogo?.length || !resumen) return null;

  const actual = resumen.global.rango;
  const siguiente = resumen.global.siguiente;
  const puntaje = resumen.global.puntaje;

  return (
    <section aria-labelledby="titulo-escalera" className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="titulo-escalera" className="font-display text-lg font-bold text-fg">Escalera de rangos</h2>
        <p className="text-sm text-muted">
          Tu puntaje: <b className="text-fg">{puntaje}</b>/100
        </p>
      </div>
      <p className="mb-4 text-sm text-muted">
        {siguiente
          ? <>Eres <b style={{ color: actual.color }}>{actual.nombre}</b>. Te faltan <b className="text-fg">{siguiente.faltan}</b> puntos para <b>{siguiente.nombre}</b>.</>
          : <>Alcanzaste el rango máximo: <b style={{ color: actual.color }}>{actual.nombre}</b>.</>}
      </p>

      {/* 2 columnas en móvil → 6 en escritorio; nunca hay scroll horizontal. */}
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {catalogo.map((r) => {
          const alcanzado = r.orden <= actual.orden;
          const esActual = r.clave === actual.clave;
          return (
            <li key={r.clave}
              aria-current={esActual ? 'step' : undefined}
              className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition ${
                esActual
                  ? 'border-transparent bg-subtle shadow-lift ring-2'
                  : alcanzado ? 'border-line bg-card' : 'border-dashed border-line bg-subtle/40'
              }`}
              style={esActual ? { boxShadow: `0 0 0 2px ${actual.color}55`, borderColor: actual.color } : undefined}>

              <RangoEscudo svgKey={r.svgKey} color={r.color} bloqueado={!alcanzado} className="h-14 w-14" />

              <span className={`text-xs font-bold leading-tight ${alcanzado ? 'text-fg' : 'text-muted'}`}>
                {r.nombre}
              </span>

              {/* El umbral es la meta concreta de cada peldaño. */}
              <span className="inline-flex items-center gap-1 text-2xs text-muted">
                {!alcanzado && <Lock className="h-3 w-3" aria-hidden />}
                {r.umbral === 0 ? 'Inicio' : `${r.umbral} pts`}
              </span>

              {esActual && (
                <span className="rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-accent-on"
                  style={{ backgroundColor: actual.color }}>
                  Tu rango
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Lectura para lector de pantalla: la escalera es visual, esto la narra. */}
      <p className="sr-only" role="status">
        Rango actual {actual.nombre}, {puntaje} de 100 puntos.
        {siguiente ? ` Faltan ${siguiente.faltan} puntos para ${siguiente.nombre}.` : ' Es el rango máximo.'}
      </p>
    </section>
  );
}
