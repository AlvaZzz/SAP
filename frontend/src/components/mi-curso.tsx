'use client';

import { useAuth } from '@/providers/auth-provider';
import { GraduationCap } from '@/components/icons';

/**
 * Curso del estudiante: Materia · Paralelo · Docente. Se arma con lo que el
 * docente registró (su paralelo y quién está a cargo). Si el estudiante aún no
 * pertenece a un paralelo, no se muestra nada.
 */
export function MiCurso({ className = '' }: { className?: string }) {
  const { usuario } = useAuth();
  const curso = usuario?.paraleloRef;
  if (!curso) return null;
  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-card px-3.5 py-2 text-sm ${className}`}>
      <GraduationCap className="h-4 w-4 shrink-0 text-prexi-blue-deep" />
      <span className="font-semibold text-fg">{curso.materia.nombre}{curso.materia.sigla ? ` (${curso.materia.sigla})` : ''}</span>
      <span className="text-muted">·</span>
      <span className="text-fg">Paralelo {curso.nombre}</span>
      <span className="text-muted">·</span>
      <span className="text-muted">{curso.docente ? <>Docente: <b className="font-semibold text-fg">{curso.docente.nombre}</b></> : 'Docente por asignar'}</span>
    </div>
  );
}
