'use client';

/**
 * ÍNDICE DEL ROL DOCENTE, agrupado por las mismas secciones que la barra lateral.
 *
 * El rol docente no solo sirve para operar el curso: es la evidencia de
 * FIDELIDAD DE LA INTERVENCIÓN, la prueba de que el tratamiento se aplicó como
 * estaba diseñado. Si el tribunal pregunta "¿cómo sé que la intervención
 * realmente ocurrió y fue igual para todos?", la respuesta sale de aquí.
 *
 * Y hay algo más inmediato: cada estudiante que se detecta a tiempo y no
 * abandona es un dato salvado para la muestra.
 */

import { IndiceModulos, GrupoModulos } from '@/components/indice-modulos';
import {
  Layers, Users, AlertTriangle, ClipboardList, ShieldCheck, BarChart3,
} from '@/components/icons';

const GRUPOS: GrupoModulos[] = [
  {
    titulo: 'Seguimiento',
    modulos: [
      {
        titulo: 'Seguimiento por estudiante',
        resumen: 'Ficha completa: progreso por nivel y por tema, días activos, última conexión, intentos recientes y entregas.',
        porQue: 'Permite verificar caso por caso y responder preguntas puntuales del tribunal sobre cualquier participante.',
        href: '/docente/estudiantes',
        icon: Users,
      },
      {
        titulo: 'Estudiantes en riesgo',
        resumen: 'Inactividad prolongada, acierto en caída, sin pretest o estancados en un nivel, con los criterios a la vista.',
        porQue: 'Reduce la mortalidad experimental, que es la amenaza número uno a la validez de un estudio con muestra pequeña.',
        href: '/docente/riesgo',
        icon: AlertTriangle,
      },
      {
        titulo: 'Revisiones pendientes',
        resumen: 'Cola de entregas por revisar, con el tiempo que lleva esperando cada una.',
        porQue: 'La retroalimentación oportuna es parte del tratamiento: si un grupo esperó dos semanas, la intervención no fue uniforme.',
        href: '/docente/revisiones',
        icon: ClipboardList,
      },
    ],
  },
  {
    titulo: 'Contenido',
    modulos: [
      {
        titulo: 'Panel de control del curso',
        resumen: 'Unidades y temas publicados, con la fecha desde la que cada uno estuvo disponible.',
        porQue: 'Documenta qué contenido tuvo el estudiante y desde cuándo: es el registro de la intervención tal como se entregó.',
        href: '/docente/unidades',
        icon: Layers,
      },
      {
        titulo: 'Cobertura del banco',
        resumen: 'Ejercicios por unidad, tema y nivel, señalando los huecos donde falta material.',
        porQue: 'Si un tema no tiene ejercicios del nivel del estudiante, la adaptatividad no puede funcionar para él.',
        href: '/docente/cobertura',
        icon: ShieldCheck,
      },
    ],
  },
  {
    titulo: 'Informes',
    modulos: [
      {
        titulo: 'Reportes del curso',
        resumen: 'Avance por niveles, actividad semanal y desempeño por categoría temática.',
        porQue: 'Seguimiento pedagógico del curso y material imprimible para los anexos.',
        href: '/docente/reportes',
        icon: BarChart3,
      },
    ],
  },
];

export default function IndiceDocentePage() {
  return (
    <IndiceModulos
      titulo="Panel docente"
      subtitulo="Los módulos para conducir el curso y documentar que la intervención se aplicó como estaba diseñada."
      grupos={GRUPOS}
      nota={
        'Este rol NO muestra a qué grupo del estudio (control o experimental) pertenece cada ' +
        'estudiante, y es deliberado: si lo supieras podrías tratarlos distinto sin proponértelo, y esa ' +
        'diferencia dejaría de ser atribuible a la intervención. Hay una prueba automática que impide ' +
        'que ese dato reaparezca en cualquier pantalla de este rol.'
      }
    />
  );
}
