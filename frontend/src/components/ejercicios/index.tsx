'use client';

import { Ejercicio, ResultadoIntento } from '@/lib/types';
import { MultipleChoice } from './opcion-multiple';
import { PredecirSalida } from './predecir-salida';
import { CompletarCodigo } from './completar-codigo';
import { OrdenarLineas } from './ordenar-lineas';

/**
 * Interfaz COMÚN a los 4 tipos de ejercicio. El reproductor es dueño del envío y
 * de la calificación (backend); cada componente solo:
 *  - gestiona su interacción interna,
 *  - reporta la respuesta actual con `onChange(respuesta | null)` (null = aún no
 *    hay respuesta → "Comprobar" deshabilitado),
 *  - y, cuando llega `resultado` (ya enviado), muestra el feedback correcto/incorrecto.
 *
 * El formato del string de `onChange` respeta el contrato del backend
 * (`ejercicios/correccion.ts`): id de opción para opción/predicción, texto para
 * completar, e ids separados por coma para ordenar líneas.
 */
export interface ExerciseProps {
  ejercicio: Ejercicio;
  /** null hasta enviar; luego trae la corrección del backend (feedback). */
  resultado: ResultadoIntento | null;
  /** Reporta la respuesta actual (o null si aún no está lista). */
  onChange: (respuesta: string | null) => void;
}

/** Renderiza el componente correcto según el tipo del ejercicio. */
export function VistaEjercicio(props: ExerciseProps) {
  switch (props.ejercicio.tipo) {
    case 'ordenar_lineas':
      return <OrdenarLineas {...props} />;
    case 'completar_codigo':
      return <CompletarCodigo {...props} />;
    case 'predecir_salida':
      return <PredecirSalida {...props} />;
    case 'opcion_multiple':
    default:
      return <MultipleChoice {...props} />;
  }
}
