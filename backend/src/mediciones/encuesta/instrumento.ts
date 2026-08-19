/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  INSTRUMENTO: MOTIVACIÓN ACADÉMICA — MSLQ (sección de motivación)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Motivated Strategies for Learning Questionnaire (MSLQ)
 *  Pintrich, P. R., Smith, D. A. F., García, T., & McKeachie, W. J. (1991).
 *  "A Manual for the Use of the Motivated Strategies for Learning Questionnaire
 *  (MSLQ)". Ann Arbor: University of Michigan, NCRIPTAL.
 *
 *  Se emplea la SECCIÓN DE MOTIVACIÓN y, dentro de ella, tres subescalas (ver
 *  `SUBESCALAS`). NO se incluye la sección de estrategias de aprendizaje (50
 *  ítems): excede el alcance de la tesis y alargaría la aplicación sin aportar
 *  a la hipótesis.
 *
 *  ── USO LEGÍTIMO ──────────────────────────────────────────────────────────
 *  El MSLQ se distribuye para USO ACADÉMICO y debe solicitarse a la University
 *  of Michigan. Aquí se emplea con fines de investigación académica, citando la
 *  fuente. Si este repositorio llegara a ser público, NO debe publicarse el
 *  texto íntegro de los ítems: `items-mslq.ts` contiene el instrumento y debe
 *  mantenerse fuera de una publicación abierta.
 *
 *  ── POR QUÉ ESTE ARCHIVO NO CONTIENE LOS ÍTEMS ────────────────────────────
 *  Aquí vive solo la ESTRUCTURA. Los textos se cargan en `items-mslq.ts`, que
 *  se completa con el instrumento oficial en la adaptación al español que
 *  apruebe la tutora metodológica.
 *
 *  Antes hubo aquí 11 ítems redactados por IA. Se ELIMINARON por completo el
 *  2026-08-19 —ni siquiera comentados— porque un instrumento sin validez de
 *  contenido es indefendible en una tesis, y porque dejarlos "por si acaso"
 *  abría la puerta a que alguien los reactivara sin darse cuenta.
 *
 *  Consecuencia deliberada: mientras `items-mslq.ts` esté vacío, la encuesta NO
 *  ARRANCA y devuelve un error explícito. Es preferible que el sistema falle de
 *  forma ruidosa a que aplique un instrumento vacío o de prueba a participantes
 *  reales.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { ADAPTACION_ESPANOL, ITEMS_MSLQ, VERSION_INSTRUMENTO_ITEMS } from './items-mslq';

/**
 * ESCALA DE 7 PUNTOS — no de 5.
 *
 * El MSLQ se responde en una escala de 1 ("no me describe en absoluto") a 7
 * ("me describe totalmente"). El rango importa por dos motivos concretos:
 * los puntajes por subescala que reporta la literatura asumen ese rango, y sin
 * él no se pueden comparar los resultados con los baremos publicados.
 *
 * La primera versión de este módulo se implementó con 5 puntos por error; se
 * corrigió antes de aplicar la encuesta a nadie, así que no hay respuestas de
 * la escala antigua con las que mezclar (verificado: 0 filas).
 */
export const ESCALA_MIN = 1;
export const ESCALA_MAX = 7;

/** Anclajes que ve el estudiante. Solo se etiquetan los extremos y el centro,
 *  como en la aplicación original: los intermedios son numéricos. */
export const ANCLAJES: { valor: number; etiqueta: string | null }[] = [
  { valor: 1, etiqueta: 'No me describe en absoluto' },
  { valor: 2, etiqueta: null },
  { valor: 3, etiqueta: null },
  { valor: 4, etiqueta: 'Me describe a medias' },
  { valor: 5, etiqueta: null },
  { valor: 6, etiqueta: null },
  { valor: 7, etiqueta: 'Me describe totalmente' },
];

export type Subescala = 'valoracion_tarea' | 'metas_intrinsecas' | 'autoeficacia';

export interface DefinicionSubescala {
  clave: Subescala;
  nombre: string;
  /** Qué mide, en lenguaje llano: se muestra junto al resultado. */
  descripcion: string;
  /** Por qué esta tesis la incluye. */
  justificacion: string;
  /**
   * Alfa de Cronbach REPORTADO EN LA LITERATURA para esta subescala, como
   * referencia con la que contrastar el obtenido en la muestra propia.
   * `null` cuando no se dispone de un valor citable: NO se inventa un número
   * para rellenar la comparación.
   */
  alfaReferencia: number | null;
  fuenteAlfa: string | null;
}

export const SUBESCALAS: DefinicionSubescala[] = [
  {
    clave: 'valoracion_tarea',
    nombre: 'Valoración de la tarea',
    descripcion: 'Interés, importancia y utilidad que el estudiante atribuye a la materia.',
    justificacion:
      'Corresponde directamente al indicador "nivel de interés" que la tesis operacionaliza como ' +
      'dimensión de la motivación académica.',
    alfaReferencia: 0.87,
    fuenteAlfa: 'Validación chilena con universitarios de primer año',
  },
  {
    clave: 'metas_intrinsecas',
    nombre: 'Metas de orientación intrínseca',
    descripcion: 'Si el estudiante estudia por interés propio o movido por recompensas externas.',
    justificacion:
      'Es el núcleo de la motivación académica: distingue al que aprende por querer aprender del ' +
      'que solo persigue la nota.',
    alfaReferencia: null,
    fuenteAlfa: null,
  },
  {
    clave: 'autoeficacia',
    nombre: 'Autoeficacia y expectativas',
    descripcion: 'Confianza del estudiante en su propia capacidad de aprender y rendir en la materia.',
    justificacion:
      'Especialmente pertinente en programación de primer semestre, donde la percepción de "esto no ' +
      'es para mí" es un factor de abandono conocido.',
    alfaReferencia: 0.83,
    fuenteAlfa: 'Validación chilena con universitarios de primer año',
  },
];

export interface ItemMslq {
  /** Código interno estable (p. ej. "vt1"). Es lo que se guarda en la base. */
  codigo: string;
  subescala: Subescala;
  texto: string;
  /** true = redactado en negativo; se recodifica al puntuar, nunca al guardar. */
  inverso?: boolean;
  /** Nº del ítem en el MSLQ original, para trazabilidad con el manual. */
  numeroOriginal: number;
}

export const ITEMS: ItemMslq[] = ITEMS_MSLQ;

/** Versión del instrumento: cambia cuando cambian los ítems o la adaptación. */
export const VERSION_INSTRUMENTO = VERSION_INSTRUMENTO_ITEMS;

/** Referencia bibliográfica completa, para el marco metodológico y la pantalla. */
export const REFERENCIA = {
  original:
    'Pintrich, P. R., Smith, D. A. F., García, T., & McKeachie, W. J. (1991). A Manual for the Use ' +
    'of the Motivated Strategies for Learning Questionnaire (MSLQ). Ann Arbor: University of ' +
    'Michigan, National Center for Research to Improve Postsecondary Teaching and Learning.',
  adaptacion: ADAPTACION_ESPANOL,
  uso:
    'Instrumento empleado con fines de investigación académica. El MSLQ se distribuye para uso ' +
    'académico y debe solicitarse a la University of Michigan.',
};

// ── Estado del instrumento ─────────────────────────────────────────────────

/** ¿Están cargados los ítems oficiales? */
export function instrumentoCargado(): boolean {
  return ITEMS.length > 0;
}

/**
 * Mensaje único que explica qué falta. Se usa tanto en el error del backend
 * como en la pantalla, para que nadie tenga que adivinar por qué no arranca.
 */
export const MENSAJE_SIN_INSTRUMENTO =
  'La encuesta de motivación no está disponible: los ítems del MSLQ aún no se han cargado. ' +
  'Cárgalos en backend/src/mediciones/encuesta/items-mslq.ts con el texto oficial de la adaptación ' +
  'al español aprobada. El sistema se niega a aplicar un instrumento vacío a propósito.';

/** Ítem por su código (undefined si no pertenece a este instrumento). */
export function itemPorCodigo(codigo: string): ItemMslq | undefined {
  return ITEMS.find((i) => i.codigo === codigo);
}

/**
 * Puntuación de un ítem, recodificando los inversos.
 * En una escala de 1 a 7 la recodificación es 8 − valor.
 */
export function puntuar(item: ItemMslq, valor: number): number {
  return item.inverso ? ESCALA_MIN + ESCALA_MAX - valor : valor;
}

export function definicionSubescala(clave: Subescala): DefinicionSubescala {
  return SUBESCALAS.find((s) => s.clave === clave)!;
}
