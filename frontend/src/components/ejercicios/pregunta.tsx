import { ReactNode } from 'react';
import { CheckCircle, Terminal, Code, GripVertical } from '@/components/icons';

/**
 * Presentación COMÚN de una pregunta: la misma cabecera, el mismo enunciado y
 * la misma instrucción en la práctica, en la evaluación para subir de nivel y
 * en el examen de unidad. Así el estudiante reconoce de un vistazo qué tipo de
 * pregunta es y qué tiene que hacer, esté donde esté.
 */

type Tipo = 'opcion_multiple' | 'predecir_salida' | 'completar_codigo' | 'ordenar_lineas';

const TIPOS: Record<Tipo, { nombre: string; instruccion: string; color: string; Icono: typeof Code }> = {
  opcion_multiple: { nombre: 'Opción múltiple', instruccion: 'Elige la respuesta correcta.', color: '#3B82F6', Icono: CheckCircle },
  predecir_salida: { nombre: 'Predecir la salida', instruccion: 'Lee el código y elige qué muestra en pantalla al ejecutarse.', color: '#10B981', Icono: Terminal },
  completar_codigo: { nombre: 'Completar el código', instruccion: 'Escribe lo que falta para que el programa funcione.', color: '#8B5CF6', Icono: Code },
  ordenar_lineas: { nombre: 'Ordenar las líneas', instruccion: 'Coloca las líneas en el orden en que deben ejecutarse.', color: '#F59E0B', Icono: GripVertical },
};
const infoDe = (tipo: string) => TIPOS[(tipo in TIPOS ? tipo : 'opcion_multiple') as Tipo];

/** Número de la pregunta, tipo y, a la derecha, lo que cada pantalla quiera añadir. */
export function CabeceraPregunta({ numero, total, tipo, tema, extra }: {
  numero?: number; total?: number; tipo: string; tema?: string | null; extra?: ReactNode;
}) {
  const t = infoDe(tipo);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      {numero != null && (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-prexi-blue font-display text-lg font-extrabold text-accent-on">{numero}</span>
      )}
      <div className="min-w-0 flex-1">
        {numero != null && total != null && <p className="text-xs font-semibold text-muted">Pregunta {numero} de {total}</p>}
        <p className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: t.color, backgroundColor: `${t.color}1F` }}>
            <t.Icono className="h-3.5 w-3.5" /> {t.nombre}
          </span>
          {tema && <span className="truncate text-xs font-medium text-muted">{tema}</span>}
        </p>
      </div>
      {extra && <div className="flex shrink-0 flex-wrap items-center gap-2">{extra}</div>}
    </div>
  );
}

/** El enunciado: lo más legible de la tarjeta, con una barra que lo separa del resto. */
export function Enunciado({ children, tipo, como: Etiqueta = 'h1' }: { children: ReactNode; tipo: string; como?: 'h1' | 'h2' | 'h3' }) {
  const t = infoDe(tipo);
  return (
    <div className="mb-5 border-l-4 pl-4" style={{ borderColor: t.color }}>
      <Etiqueta className="whitespace-pre-line font-display text-xl font-bold leading-snug text-fg sm:text-[1.4rem]">{children}</Etiqueta>
      <p className="mt-1.5 text-sm text-muted">{t.instruccion}</p>
    </div>
  );
}
