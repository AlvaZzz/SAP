import { Bug, Code } from '@/components/icons';

/** Los dos tipos de reto. En la base, `esBugHunt` distingue uno del otro. */
export type TipoReto = 'bug' | 'codigo';

export const TIPOS_RETO: Record<TipoReto, {
  nombre: string; resumen: string; calificacion: string; Icono: typeof Bug; color: string;
}> = {
  bug: {
    nombre: 'Encuentra el bug',
    resumen: 'Le das un código que tiene un error. El estudiante lo encuentra y lo corrige.',
    calificacion: 'Se califica solo: el sistema compara la salida con la correcta.',
    Icono: Bug,
    color: '#EF4444',
  },
  codigo: {
    nombre: 'Escribe tu código',
    resumen: 'Le planteas un problema. El estudiante programa la solución desde cero.',
    calificacion: 'Lo calificas tú: la entrega llega a «Revisiones de retos».',
    Icono: Code,
    color: '#3B82F6',
  },
};

export const tipoDe = (r: { esBugHunt: boolean }): TipoReto => (r.esBugHunt ? 'bug' : 'codigo');
