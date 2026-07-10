import { Badge } from '@/components/ui';
import { EstadoEstudiante } from '@/lib/types';

// Mapa de estado del estudiante → tono del badge + etiqueta legible.
const MAPA: Record<EstadoEstudiante, { tone: 'green' | 'blue' | 'slate' | 'red' | 'amber'; label: string }> = {
  completado: { tone: 'green', label: 'Completado' },
  en_progreso: { tone: 'blue', label: 'En progreso' },
  inactivo: { tone: 'slate', label: 'Inactivo' },
  en_riesgo: { tone: 'red', label: 'En riesgo' },
};

export function EstadoBadge({ estado }: { estado: EstadoEstudiante }) {
  const { tone, label } = MAPA[estado] ?? MAPA.en_progreso;
  return <Badge tone={tone}>{label}</Badge>;
}
