'use client';

import { useMemo } from 'react';
import { Field, Select } from '@/components/ui';
import { OpcionTema } from '@/lib/types';

/**
 * Selector académico DEPENDIENTE: Unidad → Tema → Subtema.
 *
 * Sustituye al select plano de temas (una lista larguísima con la unidad metida
 * dentro de la etiqueta). El valor que viaja al backend sigue siendo UN solo
 * `temaId`, porque en el modelo un SUBTEMA es un Tema con `padre_id`: si se
 * elige subtema manda el id del subtema; si no, el del tema.
 *
 * Las unidades/temas se derivan de la misma lista `OpcionTema`, así que no hace
 * falta ninguna petición extra.
 */
export function SelectorTema({ temas, valor, onChange, hint }: {
  temas: OpcionTema[];
  /** id del tema o subtema elegido; null = sin asignar ("General"). */
  valor: number | null;
  onChange: (temaId: number | null) => void;
  hint?: string;
}) {
  const seleccionado = useMemo(() => temas.find((t) => t.id === valor) ?? null, [temas, valor]);

  // Si el valor apunta a un subtema, el tema "padre" es quien manda en el 2º select.
  const temaActual = useMemo(() => {
    if (!seleccionado) return null;
    return seleccionado.padre_id ? temas.find((t) => t.id === seleccionado.padre_id) ?? null : seleccionado;
  }, [seleccionado, temas]);

  const unidadActual = seleccionado?.unidad_id ?? null;

  const unidades = useMemo(() => {
    const m = new Map<number, { id: number; numero: number; titulo: string }>();
    for (const t of temas) if (!m.has(t.unidad_id)) m.set(t.unidad_id, { id: t.unidad_id, numero: t.unidad_numero, titulo: t.unidad_titulo });
    return [...m.values()].sort((a, b) => a.numero - b.numero);
  }, [temas]);

  const temasDeUnidad = useMemo(
    () => temas.filter((t) => t.unidad_id === unidadActual && !t.padre_id).sort((a, b) => a.orden - b.orden),
    [temas, unidadActual],
  );
  const subtemas = useMemo(
    () => (temaActual ? temas.filter((t) => t.padre_id === temaActual.id).sort((a, b) => a.orden - b.orden) : []),
    [temas, temaActual],
  );

  // Cambiar de unidad o de tema INVALIDA lo que hubiera debajo: se limpia la
  // selección en vez de dejar un subtema que ya no pertenece al tema elegido.
  const cambiarUnidad = (id: string) => {
    if (!id) { onChange(null); return; }
    const primero = temas.filter((t) => t.unidad_id === Number(id) && !t.padre_id).sort((a, b) => a.orden - b.orden)[0];
    onChange(primero ? primero.id : null);
  };

  return (
    <div className="space-y-3">
      <Field label="Unidad" hint={hint}>
        <Select value={unidadActual ?? ''} onChange={(e) => cambiarUnidad(e.target.value)}>
          <option value="">Sin asignar (General)</option>
          {unidades.map((u) => <option key={u.id} value={u.id}>Unidad {u.numero} · {u.titulo}</option>)}
        </Select>
      </Field>

      {unidadActual != null && (
        <Field label="Tema">
          <Select value={temaActual?.id ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
            {temasDeUnidad.length === 0 && <option value="">Esta unidad no tiene temas</option>}
            {temasDeUnidad.map((t) => <option key={t.id} value={t.id}>{t.numero} {t.titulo}</option>)}
          </Select>
        </Field>
      )}

      {/* El 3.º solo aparece si el tema elegido REALMENTE tiene subtemas. */}
      {subtemas.length > 0 && (
        <Field label="Subtema (opcional)">
          <Select
            value={seleccionado?.padre_id ? seleccionado.id : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : temaActual?.id ?? null)}
          >
            <option value="">Todo el tema {temaActual?.numero}</option>
            {subtemas.map((s) => <option key={s.id} value={s.id}>{s.numero} {s.titulo}</option>)}
          </Select>
        </Field>
      )}
    </div>
  );
}
