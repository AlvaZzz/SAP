'use client';

/**
 * ÍNDICE DEL ROL INVESTIGADOR — los módulos del estudio (diseño no experimental
 * transversal), agrupados por las mismas secciones que la barra lateral.
 * Es la pantalla de entrada del rol.
 */

import { IndiceModulos, GrupoModulos } from '@/components/indice-modulos';
import { Users, FlaskConical, Layers, Download, ClipboardList, BarChart3 } from '@/components/icons';

const GRUPOS: GrupoModulos[] = [
  {
    titulo: 'El estudio',
    modulos: [
      {
        titulo: 'Diseño y muestra',
        resumen: 'Diseño no experimental transversal, población, muestreo, paralelos y período de uso, más la ficha metodológica completa.',
        porQue: 'Es lo primero que se describe en metodología y lo primero que el tribunal contrasta.',
        href: '/investigador/panel',
        icon: ClipboardList,
      },
      {
        titulo: 'Participantes y uso',
        resumen: 'Cascada registrados → diagnóstico → uso real → evaluación final, datos faltantes y cuánto se usó el sistema.',
        porQue: 'Cada indicador se sostiene sobre los estudiantes que de verdad usaron el sistema: conviene decir cuántos son.',
        href: '/investigador/validez',
        icon: Users,
      },
    ],
  },
  {
    titulo: 'Resultados',
    modulos: [
      {
        titulo: 'Validación del sistema',
        resumen: 'Precisión del motor adaptativo con IC 95 % por bootstrap, latencia de reajuste, puntaje SUS, calidad ISO/IEC 25010 y la tabla de criterios de aceptación.',
        porQue: 'Son los tres indicadores de la hipótesis: se acepta solo si los tres criterios se cumplen a la vez.',
        href: '/investigador/validacion',
        icon: BarChart3,
      },
    ],
  },
  {
    titulo: 'Instrumentos',
    modulos: [
      {
        titulo: 'Fiabilidad del diagnóstico',
        resumen: 'KR-20 del diagnóstico inicial y de la evaluación final, dificultad y discriminación por ítem, e infit/outfit del modelo de Rasch.',
        porQue: 'Si el instrumento no es fiable, ningún resultado posterior mide nada. Es la primera pregunta ante un instrumento propio.',
        href: '/investigador/fiabilidad',
        icon: FlaskConical,
      },
      {
        titulo: 'Mecanismo adaptativo',
        resumen: 'Validación de la clasificación por niveles: distribución de θ, validez predictiva, movilidad entre niveles y sensibilidad de los umbrales.',
        porQue: 'Sostiene que el sistema ADAPTÓ el contenido, no que solo lo entregó.',
        href: '/investigador/clasificacion',
        icon: Layers,
      },
    ],
  },
  {
    titulo: 'Entrega',
    modulos: [
      {
        titulo: 'Exportación y reproducibilidad',
        resumen: 'CSV anonimizado, diccionario de variables, metadatos del corte con hash SHA-256 y declaración de ética.',
        porQue: 'Permite que un tercero reproduzca exactamente los resultados reportados. Es lo que separa una tesis seria de una colección de capturas.',
        href: '/investigador/exportacion',
        icon: Download,
      },
    ],
  },
];

export default function IndiceInvestigadorPage() {
  return (
    <IndiceModulos
      titulo="Análisis del estudio"
      subtitulo="El estudio evalúa si el sistema funciona bien: precisión del motor adaptativo, usabilidad y calidad del software."
      grupos={GRUPOS}
      nota={
        'Cada módulo trae, junto a cada cifra, qué significa, cómo se calculó y cómo se interpreta, ' +
        'para que puedas defender cualquier número sin buscar en otro lado. Cuando la muestra todavía ' +
        'no alcanza, la pantalla lo dice en vez de mostrar cifras. Todo el rol es de solo lectura y ' +
        'trabaja sobre datos anonimizados.'
      }
    />
  );
}
