import { NivelDificultad, NIVEL_LABEL, NIVEL_COLOR } from '@/lib/types';

/**
 * Sistema de NIVELES (Básico/Intermedio/Avanzado) para la UI. Reemplaza por
 * completo a las antiguas «estrellas» de dificultad. La fuente de verdad del
 * backend sigue siendo `estrellas` (1-5), de donde se deriva el nivel con la
 * MISMA regla que backend/src/common/niveles/nivel-dificultad.ts
 * (★1-2 = Básico, ★3 = Intermedio, ★4-5 = Avanzado). Aquí se centraliza esa
 * conversión para que ninguna pantalla vuelva a pintar estrellas.
 */
export function nivelDesdeEstrellas(estrellas: number): NivelDificultad {
  if (estrellas <= 2) return 'basico';
  if (estrellas === 3) return 'intermedio';
  return 'avanzado';
}

/**
 * Estrella REPRESENTATIVA de cada nivel (para formularios que siguen enviando
 * `estrellas` al backend): Básico → 2, Intermedio → 3, Avanzado → 4. Así el
 * docente elige NIVEL y el backend mantiene su lógica (nivelDificultad + b IRT).
 */
export function estrellasDesdeNivel(nivel: NivelDificultad): number {
  return nivel === 'basico' ? 2 : nivel === 'intermedio' ? 3 : 4;
}

/** Orden estable para poblar selectores de nivel. */
export const NIVELES: NivelDificultad[] = ['basico', 'intermedio', 'avanzado'];

/**
 * Insignia de nivel. Acepta el `nivel` directo (cuando el backend lo expone,
 * p. ej. en ejercicios) o lo deriva de `estrellas` (retos y demás). Colores
 * sobrios del sistema de diseño (NIVEL_COLOR).
 */
export function NivelBadge({
  nivel,
  estrellas,
  size = 'md',
  className = '',
}: {
  nivel?: NivelDificultad | null;
  estrellas?: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const n: NivelDificultad = nivel ?? (estrellas != null ? nivelDesdeEstrellas(estrellas) : 'basico');
  const color = NIVEL_COLOR[n];
  const pad = size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-0.5 text-2xs';
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold uppercase tracking-wide ${pad} ${className}`}
      style={{ color, backgroundColor: `${color}1f` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {NIVEL_LABEL[n]}
    </span>
  );
}
