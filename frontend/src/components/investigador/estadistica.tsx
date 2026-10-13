'use client';

/**
 * Piezas compartidas de las pantallas del rol INVESTIGADOR.
 *
 * Criterio de diseño de todo este rol: cada cifra viaja con QUÉ significa, CÓMO
 * se calculó y CÓMO se interpreta. El tesista tiene que poder defender cualquier
 * número de la pantalla sin buscar en otro lado.
 *
 * Y cuando el tamaño de muestra no da, la pantalla lo dice en lugar de mostrar
 * un número que invite a una conclusión prematura.
 */

import { ReactNode, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, SectionTitle } from '@/components/ui';
import { AlertCircle, AlertTriangle, CheckCircle, HelpCircle, X } from '@/components/icons';

// ── Tipos que devuelve el backend (common/estadistica/contraste.ts) ──

export interface Descriptivos {
  n: number; media: number; sd: number; ee: number;
  min: number; max: number; mediana: number; etiqueta: string;
}
export interface Supuesto {
  nombre: string; estadistico: number | null; p: number | null;
  cumple: boolean | null; detalle: string;
}
export interface ResultadoContraste {
  estadistico: number; gl: number | null; p: number;
  ic95: [number, number] | null; diferencia: number | null;
}
export interface TamanoEfecto { d: number; g: number; magnitud: string }
export interface Comparacion {
  variable: string;
  grupoA: Descriptivos; grupoB: Descriptivos;
  calculado: boolean; bloqueo: string | null;
  interpretable: boolean; advertencia: string | null;
  supuestos: Supuesto[];
  prueba: string | null; justificacion: string | null;
  resultado: ResultadoContraste | null;
  efecto: TamanoEfecto | null;
  significativo: boolean | null;
  interpretacion: string;
}

// ── Formato ──

export function num(v: number | null | undefined, dec = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(dec);
}

/** Valor p con la convención académica (p < 0.001 para valores muy pequeños). */
export function pTexto(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—';
  return p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`;
}

// ── Bloques reutilizables ──

/**
 * Nota explicativa de un indicador. Es la respuesta anticipada a "¿y esto qué
 * significa?" en la defensa.
 */
export function Explicacion({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex gap-2 rounded-xl bg-subtle p-3 text-xs leading-relaxed text-muted">
      <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

/** Aviso de que un resultado no es confiable todavía por tamaño de muestra. */
export function AvisoMuestra({ texto }: { texto: string }) {
  return (
    <div className="mt-3 flex gap-2 rounded-xl border border-prexi-amber/40 bg-prexi-amber/10 p-3 text-xs leading-relaxed text-fg">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-prexi-amber" />
      <p>{texto}</p>
    </div>
  );
}

/** Bloqueo: no hay datos para emitir un resultado, y se explica por qué. */
export function Bloqueo({ motivo, explicacion }: { motivo: string; explicacion: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-subtle/50 p-5">
      <div className="mb-2 flex items-center gap-2">
        <X className="h-4 w-4 text-muted" />
        <p className="font-display text-sm font-bold text-fg">Sin resultado: no hay datos suficientes</p>
      </div>
      <p className="text-sm text-fg">{motivo}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted">{explicacion}</p>
    </div>
  );
}

/** Fila de descriptivos de un grupo. */
function FilaDescriptivos({ d }: { d: Descriptivos }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{d.etiqueta}</p>
      <div className="grid grid-cols-3 gap-1.5 text-center sm:grid-cols-6">
        {[
          ['n', d.n], ['Media', num(d.media, 1)], ['DE', num(d.sd, 2)],
          ['EE', num(d.ee, 2)], ['Mín', num(d.min, 0)], ['Máx', num(d.max, 0)],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded-lg bg-subtle px-1 py-1.5">
            <p className="text-2xs uppercase text-muted">{l}</p>
            <p className="text-sm font-semibold text-fg">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Verificación de un supuesto, con su veredicto visible. */
function FilaSupuesto({ s }: { s: Supuesto }) {
  const icono = s.cumple === null
    ? <AlertCircle className="h-4 w-4 shrink-0 text-muted" />
    : s.cumple
      ? <CheckCircle className="h-4 w-4 shrink-0 text-prexi-green" />
      : <AlertTriangle className="h-4 w-4 shrink-0 text-prexi-amber" />;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="mt-0.5">{icono}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{s.nombre}</p>
        <p className="text-xs leading-relaxed text-muted">{s.detalle}</p>
      </div>
    </div>
  );
}

/**
 * TARJETA DE CONTRASTE — el componente central del rol.
 *
 * Presenta un contraste completo en el orden en que se defiende: descriptivos,
 * supuestos verificados, prueba elegida y por qué, resultado con IC y tamaño
 * del efecto, y la lectura en lenguaje llano. Si el contraste está bloqueado,
 * muestra el bloqueo en lugar de números.
 */
export function ContrasteCard({ c, titulo }: { c: Comparacion; titulo?: string }) {
  return (
    <Card className="mb-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>{titulo ?? `Contraste sobre ${c.variable}`}</SectionTitle>
        {c.calculado && c.significativo !== null && (
          <Badge tone={c.significativo ? 'green' : 'slate'}>
            {c.significativo ? 'Diferencia significativa' : 'Sin diferencia significativa'}
          </Badge>
        )}
      </div>

      {/* Descriptivos: siempre visibles, aunque el contraste esté bloqueado. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilaDescriptivos d={c.grupoA} />
        <FilaDescriptivos d={c.grupoB} />
      </div>

      {!c.calculado ? (
        <div className="mt-4">
          <Bloqueo motivo={c.bloqueo ?? ''} explicacion={c.interpretacion} />
        </div>
      ) : (
        <>
          {/* Supuestos ANTES del resultado: es el orden metodológico correcto. */}
          <div className="mt-5 rounded-2xl border border-line p-4">
            <p className="mb-2 font-display text-sm font-bold text-fg">Verificación de supuestos</p>
            <div className="divide-y divide-line">
              {c.supuestos.map((s) => <FilaSupuesto key={s.nombre} s={s} />)}
            </div>
          </div>

          {/* Prueba aplicada y justificación */}
          <div className="mt-4 rounded-2xl bg-subtle p-4">
            <p className="text-sm font-semibold text-fg">Prueba aplicada: {c.prueba}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{c.justificacion}</p>
          </div>

          {/* Resultado numérico */}
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <Metrica etiqueta="Estadístico" valor={num(c.resultado?.estadistico ?? null, 3)} />
            <Metrica etiqueta="gl" valor={c.resultado?.gl !== null && c.resultado?.gl !== undefined ? num(c.resultado.gl, 2) : '—'} />
            <Metrica etiqueta="Valor p" valor={pTexto(c.resultado?.p)} destacado={c.significativo === true} />
            <Metrica
              etiqueta="IC 95 % de la diferencia"
              valor={c.resultado?.ic95 ? `[${num(c.resultado.ic95[0], 2)}, ${num(c.resultado.ic95[1], 2)}]` : 'no aplica'}
            />
          </div>

          {c.efecto && (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Metrica etiqueta="d de Cohen" valor={num(c.efecto.d, 3)} />
              <Metrica etiqueta="g de Hedges" valor={num(c.efecto.g, 3)} />
              <Metrica etiqueta="Magnitud del efecto" valor={c.efecto.magnitud} />
            </div>
          )}

          {/* Lectura en lenguaje llano: lo que se dice en la defensa. */}
          <div className="mt-4 rounded-2xl border border-line p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Cómo se interpreta</p>
            <p className="text-sm leading-relaxed text-fg">{c.interpretacion}</p>
          </div>

          {c.advertencia && <AvisoMuestra texto={c.advertencia} />}
        </>
      )}
    </Card>
  );
}

export function Metrica({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${destacado ? 'border-prexi-green/40 bg-prexi-green/10' : 'border-line'}`}>
      <p className="text-2xs uppercase tracking-wide text-muted">{etiqueta}</p>
      <p className={`mt-0.5 font-display text-sm font-bold ${destacado ? 'text-prexi-green' : 'text-fg'}`}>{valor}</p>
    </div>
  );
}

/**
 * BOTÓN "ACTUALIZAR DATOS" + hora del último cálculo.
 *
 * El dataset del estudio se cachea unos minutos para no reconstruirlo en cada
 * pantalla (la capa gratuita de Neon lo agradece). Mostrar la hora del último
 * cálculo es más honesto que refrescar en silencio: deja claro sobre qué
 * momento se está mirando, y el botón devuelve el control al investigador.
 */
export function ActualizarDatos({ calculadoEn, onActualizado }: {
  calculadoEn: string | null;
  onActualizado: () => void;
}) {
  const [cargando, setCargando] = useState(false);

  async function actualizar() {
    setCargando(true);
    try {
      await api.get('/investigador/exportacion/actualizar');
      onActualizado();
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {calculadoEn && (
        <span className="text-xs text-muted">
          Datos calculados a las{' '}
          {new Date(calculadoEn).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      <button
        type="button"
        onClick={() => void actualizar()}
        disabled={cargando}
        className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-fg transition hover:bg-subtle disabled:opacity-50"
      >
        {cargando ? 'Actualizando…' : 'Actualizar datos'}
      </button>
    </div>
  );
}

/** Copia un bloque de texto (tabla APA) al portapapeles. */
export function BotonCopiar({ texto, etiqueta = 'Copiar tabla (formato APA)' }: { texto: string; etiqueta?: string }) {
  return (
    <button
      type="button"
      onClick={() => { void navigator.clipboard.writeText(texto); }}
      className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-fg transition hover:bg-subtle"
    >
      {etiqueta}
    </button>
  );
}
