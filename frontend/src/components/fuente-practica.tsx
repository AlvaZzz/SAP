import { BookOpen } from '@/components/icons';

/** De qué práctica y ejercicio sale un reto (lo arma el backend desde el banco del autor). */
export interface FuentePracticaInfo { texto: string; practica: string; ejercicio: string | null }

/**
 * Distintivo «Práctica Nro. 1 · Secuenciales, ejercicio 4»: con él el estudiante
 * ubica el reto en su práctica impresa y estudia con ella. No se muestra en los
 * retos que crea el docente (no vienen de una práctica).
 */
export function FuentePractica({ fuente, className = '' }: { fuente?: FuentePracticaInfo | null; className?: string }) {
  if (!fuente) return null;
  return (
    <span
      title={`Este reto sale de la ${fuente.texto}`}
      className={`inline-flex items-center gap-1.5 rounded-full bg-prexi-blue/10 px-2.5 py-1 text-xs font-semibold text-prexi-blue-deep ${className}`}
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0" />
      <span>{fuente.practica}{fuente.ejercicio && <span className="font-medium"> · {fuente.ejercicio}</span>}</span>
    </span>
  );
}
