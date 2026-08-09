'use client';

/**
 * ÍNDICE DEL ROL DOCENTE — seis módulos numerados.
 *
 * El rol docente no solo sirve para operar el curso: es la evidencia de
 * FIDELIDAD DE LA INTERVENCIÓN, la prueba de que el tratamiento se aplicó como
 * estaba diseñado. Si el tribunal pregunta "¿cómo sé que la intervención
 * realmente ocurrió y fue igual para todos?", la respuesta sale de aquí.
 *
 * Y hay algo más inmediato: cada estudiante que se detecta a tiempo y no
 * abandona es un dato salvado para la muestra.
 */

import { IndiceModulos, Modulo } from '@/components/indice-modulos';
import {
  Layers, Users, AlertTriangle, ClipboardList, Code, BarChart3,
} from '@/components/icons';

const MODULOS: Modulo[] = [
  {
    n: 1,
    titulo: 'Panel de control del curso',
    resumen: 'Unidades y temas publicados, con la fecha desde la que cada uno estuvo disponible.',
    porQue: 'Documenta qué contenido tuvo el estudiante y desde cuándo: es el registro de la intervención tal como se entregó.',
    href: '/docente/unidades',
    icon: Layers,
  },
  {
    n: 2,
    titulo: 'Seguimiento por estudiante',
    resumen: 'Ficha completa: progreso por nivel y por tema, días activos, última conexión, intentos recientes y entregas.',
    porQue: 'Permite verificar caso por caso y responder preguntas puntuales del tribunal sobre cualquier participante.',
    href: '/docente/estudiantes',
    icon: Users,
  },
  {
    n: 3,
    titulo: 'Estudiantes en riesgo',
    resumen: 'Inactividad prolongada, acierto en caída, sin pretest o estancados en un nivel, con los criterios a la vista.',
    porQue: 'Reduce la mortalidad experimental, que es la amenaza número uno a la validez de un estudio con muestra pequeña.',
    href: '/docente/riesgo',
    icon: AlertTriangle,
  },
  {
    n: 4,
    titulo: 'Revisiones pendientes',
    resumen: 'Cola de entregas por revisar, con el tiempo que lleva esperando cada una.',
    porQue: 'La retroalimentación oportuna es parte del tratamiento: si un grupo esperó dos semanas, la intervención no fue uniforme.',
    href: '/docente/revisiones',
    icon: ClipboardList,
  },
  {
    n: 5,
    titulo: 'Cobertura del banco',
    resumen: 'Ejercicios por unidad, tema y nivel, señalando los huecos donde falta material.',
    porQue: 'Si un tema no tiene ejercicios del nivel del estudiante, la adaptatividad no puede funcionar para él.',
    href: '/docente/cobertura',
    icon: Code,
  },
  {
    n: 6,
    titulo: 'Reportes del curso',
    resumen: 'Avance por niveles, actividad semanal y desempeño por categoría temática.',
    porQue: 'Seguimiento pedagógico del curso y material imprimible para los anexos.',
    href: '/docente/reportes',
    icon: BarChart3,
  },
];

export default function IndiceDocentePage() {
  return (
    <IndiceModulos
      titulo="Panel docente"
      subtitulo="Seis módulos para conducir el curso y documentar que la intervención se aplicó como estaba diseñada."
      modulos={MODULOS}
      nota={
        'Este rol NO muestra a qué grupo del estudio (control o experimental) pertenece cada ' +
        'estudiante, y es deliberado: si lo supieras podrías tratarlos distinto sin proponértelo, y esa ' +
        'diferencia dejaría de ser atribuible a la intervención. Hay una prueba automática que impide ' +
        'que ese dato reaparezca en cualquier pantalla de este rol.'
      }
    />
  );
}
