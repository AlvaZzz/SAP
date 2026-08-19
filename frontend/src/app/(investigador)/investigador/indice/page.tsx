'use client';

/**
 * ÍNDICE DEL ROL INVESTIGADOR — los módulos en el orden de un capítulo de
 * resultados de tesis, agrupados por las mismas secciones que la barra lateral.
 * Es la pantalla de entrada del rol.
 */

import { IndiceModulos, GrupoModulos } from '@/components/indice-modulos';
import {
  BarChart3, Users, FlaskConical, ShieldCheck, Activity, Layers, Download, ClipboardList,
} from '@/components/icons';

const GRUPOS: GrupoModulos[] = [
  {
    titulo: 'El estudio',
    modulos: [
      {
        titulo: 'Diseño y muestra',
        resumen: 'Tipo de diseño, población, muestreo, tamaño por grupo, instituciones, paralelos y fechas de recolección, más la ficha metodológica completa.',
        porQue: 'Es lo primero que se describe en metodología y lo primero que el tribunal contrasta.',
        href: '/investigador/panel',
        icon: ClipboardList,
      },
      {
        titulo: 'Flujo de participantes',
        resumen: 'Cascada CONSORT (registrados → pretest → intervención → postest → análisis), mortalidad por grupo, datos faltantes y dosis.',
        porQue: 'El abandono diferencial sesga el resultado. Reportarlo tú es señal de rigor; que lo descubra el tribunal es una objeción grave.',
        href: '/investigador/validez',
        icon: ShieldCheck,
      },
    ],
  },
  {
    titulo: 'Validez',
    modulos: [
      {
        titulo: 'Fiabilidad del instrumento',
        resumen: 'KR-20 del pretest y del postest, dificultad y discriminación por ítem, e infit/outfit del modelo de Rasch.',
        porQue: 'Si el instrumento no es fiable, ningún resultado posterior mide nada. Es la primera pregunta ante un instrumento propio.',
        href: '/investigador/fiabilidad',
        icon: FlaskConical,
      },
      {
        titulo: 'Equivalencia inicial',
        resumen: 'Contraste del pretest entre control y experimental, θ inicial y composición de cada grupo, con veredicto citable.',
        porQue: 'Sin demostrar que los grupos partían iguales, cualquier diferencia final se puede atribuir a que uno ya era mejor.',
        href: '/investigador/equivalencia',
        icon: Users,
      },
    ],
  },
  {
    titulo: 'Resultados',
    modulos: [
      {
        titulo: 'Resultados principales',
        resumen: 'Pruebas t independientes y pareadas con supuestos verificados, IC 95 %, d de Cohen, g de Hedges, ⟨g⟩ de Hake y Δθ entre grupos.',
        porQue: 'Es el corazón de la tesis. El intervalo de confianza y el tamaño del efecto importan tanto como el valor p, y casi siempre se omiten.',
        href: '/investigador/resultados',
        icon: BarChart3,
      },
      {
        titulo: 'Dosis-respuesta',
        resumen: 'Relación entre el uso real del sistema (días activos, sesiones, regularidad) y la ganancia, con su valor p.',
        porQue: 'Demuestra que la mejora escala con el uso: el argumento causal más fuerte disponible sin aleatorización estricta.',
        href: '/investigador/datos',
        icon: Activity,
      },
      {
        titulo: 'Mecanismo adaptativo',
        resumen: 'Validación de la clasificación por niveles: distribución de θ, validez predictiva, movilidad entre niveles y sensibilidad de los umbrales.',
        porQue: 'Diferencia esta tesis de una que solo compara notas: demuestra que el sistema ADAPTÓ, no que solo entregó contenido.',
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
      subtitulo="Los módulos siguen el orden del capítulo de resultados: recorrerlos de arriba abajo es recorrer la tesis."
      grupos={GRUPOS}
      nota={
        'Cada módulo trae, junto a cada cifra, qué significa, cómo se calculó y cómo se interpreta, ' +
        'para que puedas defender cualquier número sin buscar en otro lado. Cuando la muestra todavía ' +
        'no alcanza, la pantalla lo dice y NO emite un valor p: un número calculado con pocos casos no ' +
        'es un resultado débil, es ruido presentado como evidencia. Todo el rol es de solo lectura y ' +
        'trabaja sobre datos anonimizados.'
      }
    />
  );
}
