import { ReactNode, useEffect, useState, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { X } from './icons';

/**
 * Sistema de diseño compartido de PREXI.
 * Primitivas coherentes (Card, StatCard, Badge, ProgressBar, encabezados…)
 * que usan los tokens semánticos del tema (claro/oscuro) en un solo lugar.
 */

/* ── Card ─────────────────────────────────────────────── */
export function Card({ children, hover = false, className = '', as: Tag = 'div', ...rest }: {
  children: ReactNode; hover?: boolean; className?: string; as?: any; [k: string]: any;
}) {
  return (
    <Tag className={`card ${hover ? 'card-hover' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/* ── Encabezados de página y sección (escala mobile-first) ── */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-7">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl lg:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-muted sm:text-base">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-display text-lg font-bold text-fg sm:text-xl ${className}`}>{children}</h2>;
}

/* ── StatCard ─────────────────────────────────────────── */
const ACCENTS: Record<string, string> = {
  blue: 'bg-prexi-blue/10 text-prexi-blue-deep',
  amber: 'bg-amber-500/10 text-prexi-amber',
  green: 'bg-emerald-500/10 text-prexi-green',
  navy: 'bg-prexi-navy/10 text-prexi-navy dark:text-blue-300',
};

export function StatCard({ icon, label, value, accent = 'blue' }: {
  icon: ReactNode; label: string; value: ReactNode; accent?: keyof typeof ACCENTS;
}) {
  return (
    // Padding horizontal e ícono algo más compactos que una Card normal: así el
    // texto (ícono + etiqueta + número) cabe completo desde ~215px de ancho, que
    // es el mínimo que usa StatGrid para decidir cuántas columnas caben.
    <Card hover className="flex items-center gap-3 !px-4">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${ACCENTS[accent]}`}>{icon}</div>
      <div className="min-w-0">
        {/* break-words: red de seguridad. Si la tarjeta quedara más angosta que
            la palabra más larga, la etiqueta se parte en dos líneas en vez de
            desbordar/cortarse (p. ej. "COMPLETADOS HOY"). */}
        <p className="stat-label break-words">{label}</p>
        <p className="font-display text-2xl font-extrabold leading-tight text-fg sm:text-3xl">{value}</p>
      </div>
    </Card>
  );
}

/**
 * Rejilla responsiva para filas de StatCard. Usa auto-fit + minmax: cada tarjeta
 * mantiene un ancho MÍNIMO legible (215px) y, si no caben todas en la fila,
 * envuelven a la siguiente en vez de comprimirse hasta cortar el texto. Reacomoda
 * de forma fluida al redimensionar, sin depender de breakpoints fijos que ignoran
 * el ancho real disponible (el sidebar reduce el ancho útil en escritorio):
 *   · móvil: 1 columna a todo el ancho (etiqueta en una sola línea);
 *   · tablet: 2-3 columnas; · escritorio amplio: hasta 5.
 */
export function StatGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(210px,1fr))] ${className}`}>
      {children}
    </div>
  );
}

/* ── Badge ────────────────────────────────────────────── */
const TONES: Record<string, string> = {
  blue: 'bg-prexi-blue/10 text-prexi-blue-deep',
  green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  red: 'bg-red-500/15 text-red-600 dark:text-red-400',
  slate: 'bg-subtle text-muted',
};

export function Badge({ children, tone = 'slate', className = '' }: {
  children: ReactNode; tone?: keyof typeof TONES; className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wide ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

/* ── ProgressBar ──────────────────────────────────────── */
export function ProgressBar({ value, tone = 'blue', size = 'md', className = '' }: {
  value: number; tone?: 'blue' | 'green' | 'amber' | 'white'; size?: 'sm' | 'md'; className?: string;
}) {
  const fill = {
    blue: 'bg-gradient-to-r from-prexi-blue to-blue-400',
    green: 'bg-gradient-to-r from-prexi-green to-emerald-400',
    amber: 'bg-gradient-to-r from-prexi-amber to-amber-300',
    white: 'bg-white',
  }[tone];
  const track = tone === 'white' ? 'bg-white/20' : 'bg-subtle';
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';
  return (
    <div className={`${h} w-full overflow-hidden rounded-full ${track} ${className}`}>
      <div className={`h-full origin-left rounded-full ${fill} animate-grow-x transition-all duration-700`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ── Skeleton ─────────────────────────────────────────── */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/* ── EmptyState ───────────────────────────────────────── */
export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 py-14 text-center">
      {icon && <div className="grid h-14 w-14 place-items-center rounded-2xl bg-prexi-blue/10 text-prexi-blue-deep">{icon}</div>}
      <p className="font-display text-lg font-bold text-fg">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
    </div>
  );
}

/* ── Modal ────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg';
}) {
  // El modal se monta en un PORTAL a <body>. Es imprescindible: las páginas
  // envuelven su contenido en `.animate-fade-up`, cuyo `transform` residual
  // (translateY(0) con fill "both") convierte a ese <div> en el containing
  // block de cualquier descendiente `position: fixed`. Sin el portal, el
  // overlay se posiciona respecto a la página (no al viewport) y el diálogo
  // queda centrado fuera de pantalla → "el fondo se oscurece pero no aparece".
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open || !montado) return null;
  const max = size === 'lg' ? 'max-w-3xl' : 'max-w-xl';
  // Diálogo con alto máximo propio (flex-col): header y footer fijos, el cuerpo
  // scrollea. Así nunca desborda la pantalla ni corta el footer, en cualquier
  // tamaño. En móvil ocupa casi todo el ancho con márgenes (p-3).
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-6" onMouseDown={onClose}>
      <div className={`flex max-h-[calc(100dvh-1.5rem)] w-full ${max} animate-fade-up flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-lift sm:max-h-[calc(100dvh-3rem)]`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <h2 className="min-w-0 truncate font-display text-lg font-bold text-fg sm:text-xl">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-fg"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2.5 border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ── Tabla responsiva: tabla clásica en md+, TARJETAS apiladas en móvil ── */
//  Evita el scroll horizontal en celular: cada fila se convierte en una tarjeta
//  legible (la primera columna encabeza; el resto se muestra como pares
//  etiqueta→valor). `card` permite personalizar la tarjeta si el layout
//  automático no alcanza; `cardHidden` oculta una columna en la tarjeta
//  (útil para acciones que se colocan a mano dentro de `card`).
export interface ColumnaRT<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  cardHidden?: boolean;
}

export function ResponsiveTable<T>({ cols, rows, rowKey, onRowClick, card, footer }: {
  cols: ColumnaRT<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  /** Render personalizado de la tarjeta móvil (si el automático no alcanza). */
  card?: (row: T) => ReactNode;
  /** Contenido opcional bajo la tabla/tarjetas (notas, totales). */
  footer?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden !p-0">
      {/* md+: tabla clásica */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
              {cols.map((c, i) => (
                <th key={i} className={`px-3 py-3 first:pl-5 last:pr-5 ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`transition hover:bg-subtle ${onRowClick ? 'cursor-pointer' : ''}`}>
                {cols.map((c, i) => (
                  <td key={i} className={`px-3 py-3 first:pl-5 last:pr-5 ${c.align === 'right' ? 'text-right' : ''}`}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* móvil: tarjetas apiladas, sin scroll horizontal */}
      <div className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <div key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
            className={`p-4 ${onRowClick ? 'cursor-pointer transition active:bg-subtle' : ''}`}>
            {card ? card(r) : (
              <div className="space-y-3">
                <div>{cols[0].cell(r)}</div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {cols.slice(1).filter((c) => !c.cardHidden).map((c, i) => (
                    <div key={i} className="min-w-0">
                      <dt className="text-2xs font-semibold uppercase tracking-wider text-muted">{c.header}</dt>
                      <dd className="mt-0.5 text-sm text-fg">{c.cell(r)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        ))}
      </div>
      {footer}
    </Card>
  );
}

/* ── Campos de formulario ─────────────────────────────── */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-prexi-red">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input min-h-[90px] resize-y ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  // Un <select> se dimensiona a su opción más larga (p. ej. "Unidad 1:
  // Fundamentos de la Programación") y, con `white-space: pre`, esa anchura no
  // puede partirse. `max-w-full` NO basta: limita el ancho USADO, pero no la
  // CONTRIBUCIÓN de min-content del elemento, que es lo que usa la rejilla o el
  // flex de arriba para dimensionar su pista. El resultado era una columna de
  // 758px dentro de un contenedor de 329px: la página de documentos del docente
  // desbordaba 401px a 375px de ancho, y ningún `min-w-0` en los ancestros lo
  // arreglaba porque el mínimo lo imponía el propio select.
  //
  // `w-full` (width: 100%) sí lo resuelve: un ancho en porcentaje se resuelve
  // contra el contenedor y aporta CERO al tamaño intrínseco, así que el select
  // pasa a seguir al contenedor en vez de imponerle su anchura.
  // `min-w-0` acompaña para que tampoco imponga mínimo dentro de un flex.
  return <select {...props} className={`input w-full min-w-0 max-w-full ${props.className ?? ''}`}>{props.children}</select>;
}
