/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ⬇️  AQUÍ SE PEGAN LOS ÍTEMS OFICIALES DEL MSLQ  ⬇️
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  ESTE ES EL ÚNICO ARCHIVO QUE HAY QUE EDITAR para cargar el instrumento.
 *  La lógica (aplicación, puntuación, alfa de Cronbach, contrastes) ya está
 *  hecha y no se toca.
 *
 *  ── QUÉ CARGAR ────────────────────────────────────────────────────────────
 *  Solo los ítems de la SECCIÓN DE MOTIVACIÓN del MSLQ correspondientes a las
 *  tres subescalas que usa esta tesis:
 *
 *    · valoracion_tarea   → Valoración de la tarea (Task Value)
 *    · metas_intrinsecas  → Metas de orientación intrínseca (Intrinsic Goal Orientation)
 *    · autoeficacia       → Autoeficacia / expectativas (Self-Efficacy for Learning
 *                           and Performance)
 *
 *  NO cargues la sección de estrategias de aprendizaje: queda fuera del alcance.
 *
 *  ── CÓMO CARGARLO ─────────────────────────────────────────────────────────
 *  Un objeto por ítem, con:
 *
 *    codigo         Código interno estable. Es lo que se guarda en la base, así
 *                   que NO se cambia una vez aplicada la encuesta (cambiarlo
 *                   dejaría huérfanas las respuestas ya recogidas).
 *                   Convención sugerida: vt1, vt2… / mi1, mi2… / ae1, ae2…
 *    subescala      Una de las tres claves de arriba.
 *    texto          El texto TAL CUAL de la adaptación al español aprobada.
 *                   No lo parafrasees ni lo "mejores": cambiar la redacción
 *                   invalida la equivalencia con el instrumento validado.
 *    inverso        true solo si el ítem está redactado en negativo y el manual
 *                   indica recodificarlo. Si no estás seguro, consúltalo en el
 *                   manual: marcarlo mal distorsiona el puntaje de la subescala.
 *    numeroOriginal Nº del ítem en el MSLQ original, para poder rastrear cada
 *                   ítem hasta el manual cuando el tribunal lo pida.
 *
 *  ── Y DESPUÉS ─────────────────────────────────────────────────────────────
 *  1. Completa `ADAPTACION_ESPANOL` con la referencia exacta que apruebe la
 *     tutora metodológica.
 *  2. Sube `VERSION_INSTRUMENTO_ITEMS` si cambias los ítems más adelante: las
 *     respuestas guardan su versión y así no se mezclan dos aplicaciones
 *     distintas en un mismo análisis.
 *
 *  ⚠️ Mientras esta lista esté vacía, la encuesta NO se aplica: el backend
 *  responde con un error explícito. Es intencional — mejor que falle a que
 *  aplique un instrumento vacío a un participante real.
 *
 *  ⚠️ USO LEGÍTIMO: el MSLQ se distribuye para uso académico y debe solicitarse
 *  a la University of Michigan. Si este repositorio se hace público, este
 *  archivo NO debe publicarse con el texto íntegro de los ítems.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { ItemMslq } from './instrumento';

/**
 * Referencia de la adaptación al español utilizada. PENDIENTE de aprobación de
 * la tutora metodológica. Adaptaciones disponibles:
 *
 *  · Roces, C., Tourón, J., & González Torres, M. C. (1995). España — CEAM.
 *  · Donolo, D., Chiecher, A., Paolini, P., & Rinaudo, M. C. (2008). Argentina — MSLQe.
 *  · Validaciones adicionales en Chile, Colombia, México, Venezuela y Uruguay.
 *
 * Está parametrizado a propósito: completarlo NO requiere tocar ninguna lógica.
 */
export const ADAPTACION_ESPANOL =
  'PENDIENTE — completar con la referencia de la adaptación al español aprobada ' +
  'por la tutora metodológica (autores, año, país y publicación).';

/**
 * Versión del instrumento tal como se aplica en este estudio.
 * Súbela si cambian los ítems, la adaptación o la escala.
 */
export const VERSION_INSTRUMENTO_ITEMS = 'MSLQ-motivacion-2026-v1';

/**
 * ⬇️ PEGA AQUÍ LOS ÍTEMS. Ejemplo del formato (borra este comentario al cargar):
 *
 *   { codigo: 'vt1', subescala: 'valoracion_tarea',  numeroOriginal: 4,
 *     texto: '<texto oficial del ítem 4>' },
 *   { codigo: 'ae1', subescala: 'autoeficacia',      numeroOriginal: 5,
 *     texto: '<texto oficial del ítem 5>' },
 *   { codigo: 'mi1', subescala: 'metas_intrinsecas', numeroOriginal: 1,
 *     texto: '<texto oficial del ítem 1>' },
 */
export const ITEMS_MSLQ: ItemMslq[] = [
  // ── Valoración de la tarea ──

  // ── Metas de orientación intrínseca ──

  // ── Autoeficacia y expectativas ──
];
