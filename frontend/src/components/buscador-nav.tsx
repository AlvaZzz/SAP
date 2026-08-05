'use client';

import { useEffect, useId, useMemo, useRef, useState, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from '@/components/icons';

export interface ItemBuscable { href: string; label: string; icon: ComponentType<{ className?: string }> }

/**
 * Normaliza para comparar sin tildes ni mayúsculas ("Práctica" ≡ "practica").
 * El rango va con escapes unicode (no con las marcas literales) para que no se
 * corrompa al pasar por editores o herramientas con otra codificación.
 */
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
}

/**
 * BUSCADOR DE NAVEGACIÓN — filtra los apartados del ROL ACTIVO y salta al elegido.
 *
 * Alcance deliberado: solo navega entre las secciones que ya tiene el usuario en su
 * menú. NO busca contenido del banco (ejercicios/temas): el estudiante solo puede
 * ver los ítems de su nivel en cada tema, y un buscador libre sería justo la vía
 * para saltarse ese gating. Extenderlo exigiría un endpoint de búsqueda que aplique
 * las mismas reglas en el backend, no un filtro en el cliente.
 *
 * Teclado: ↑/↓ mueven, Enter abre, Escape cierra. Accesible como `combobox` con
 * `listbox`, y el nº de resultados se anuncia por una región `aria-live`.
 */
export function BuscadorNav({ items, onNavegar, className = '' }: {
  items: ItemBuscable[];
  /** Se llama al navegar (el drawer móvil lo usa para cerrarse). */
  onNavegar?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const cajaRef = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const resultados = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    return items.filter((i) => norm(i.label).includes(t));
  }, [q, items]);

  // El índice activo nunca debe quedar fuera de la lista al re-filtrar.
  useEffect(() => { setActivo(0); }, [q]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  function ir(item: ItemBuscable) {
    setQ(''); setAbierto(false);
    onNavegar?.();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setQ(''); setAbierto(false); e.currentTarget.blur(); return; }
    if (!resultados.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => (i + 1) % resultados.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => (i - 1 + resultados.length) % resultados.length); }
    else if (e.key === 'Enter') { e.preventDefault(); ir(resultados[activo]); }
  }

  const desplegado = abierto && q.trim().length > 0;

  return (
    <div ref={cajaRef} className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        onKeyDown={onKeyDown}
        placeholder="Buscar sección…"
        aria-label="Buscar una sección del menú"
        role="combobox"
        aria-expanded={desplegado}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={desplegado && resultados.length ? `${listaId}-${activo}` : undefined}
        className="w-full rounded-xl border border-line bg-subtle py-2.5 pl-10 pr-3 text-sm text-fg outline-none transition placeholder:text-muted focus:border-prexi-blue focus:bg-card focus:ring-2 focus:ring-prexi-blue/20"
      />

      {desplegado && (
        <ul
          id={listaId}
          role="listbox"
          aria-label="Secciones encontradas"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lift"
        >
          {resultados.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">Sin resultados para «{q.trim()}»</li>
          )}
          {resultados.map((item, i) => {
            const Icono = item.icon;
            return (
              <li key={item.href} id={`${listaId}-${i}`} role="option" aria-selected={i === activo}>
                <button
                  type="button"
                  // onMouseDown: se adelanta al blur del input, que si no cerraría
                  // la lista antes de que llegue el click.
                  onMouseDown={(e) => { e.preventDefault(); ir(item); }}
                  onMouseEnter={() => setActivo(i)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition ${
                    i === activo ? 'bg-subtle text-fg' : 'text-muted hover:bg-subtle'
                  }`}
                >
                  <Icono className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Anuncio para lector de pantalla al filtrar. */}
      <p className="sr-only" role="status" aria-live="polite">
        {q.trim()
          ? `${resultados.length} ${resultados.length === 1 ? 'sección encontrada' : 'secciones encontradas'}`
          : ''}
      </p>
    </div>
  );
}
