import { api } from './api';
import { NivelDificultad } from './types';

/**
 * FLASHCARDS — apoyo al estudio (repaso libre / memorización activa).
 *
 * FRONTERA CON LA INVESTIGACIÓN: las flashcards NO puntúan, NO cronometran y NO
 * afectan al θ (IRT) ni a ninguna métrica de medición (pretest/postest/nivel). Se
 * derivan del banco de ejercicios en el backend (única fuente de verdad). Su
 * disponibilidad debe ser coherente con el diseño experimental (mismo tratamiento
 * para quienes correspondan); no registran desempeño evaluado.
 */
export interface Flashcard {
  id: string;
  unidadId: string;
  temaId: string;
  subtemaId?: string;
  frente: string;            // pregunta o concepto
  reverso: string;           // respuesta
  explicacion?: string;      // explicación breve
  codigo?: string;           // fragmento Python opcional
  nivel?: NivelDificultad;
}

export interface MazoTema {
  tema: { id: number; numero: string; titulo: string; unidadId: number; unidadNumero: number } | null;
  flashcards: Flashcard[];
  /** Nivel del estudiante en el tema (sesión automática "a tu nivel"). */
  nivel_defecto: NivelDificultad;
}
export interface MazoUnidad {
  unidad: { id: number; numero: number; titulo: string } | null;
  flashcards: Flashcard[];
  /** null = mezcla "a tu nivel" (varía por tema dentro de la unidad). */
  nivel_defecto: null;
}

// El NIVEL no es elegible: el backend entrega el mazo ESTRICTAMENTE al nivel
// actual del estudiante en cada tema (el mismo que usa la adaptatividad).
export const fetchFlashcardsTema = (temaId: number | string) => api.get<MazoTema>(`/flashcards/tema/${temaId}`);
export const fetchFlashcardsUnidad = (unidadId: number | string) => api.get<MazoUnidad>(`/flashcards/unidad/${unidadId}`);
export const fetchFlashcardsExamen = (unidadId: number | string, limit = 12) => api.get<MazoUnidad>(`/flashcards/examen/${unidadId}?limit=${limit}`);

/**
 * Configuración del REPASO PREVIO con flashcards, POR TIPO DE EXAMEN. Metodología
 * del estudio (cuasi-experimento): un repaso formativo justo antes de un
 * instrumento de MEDICIÓN contaminaría la medida, por eso:
 *  - examen_unidad → ✅ ACTIVADO: es formativo, ayuda a consolidar antes del gate.
 *  - pretest       → ❌ SIEMPRE DESACTIVADO: mide el nivel de ENTRADA en crudo; un
 *                      repaso previo invalidaría la medición del estudio. Jamás.
 *  - postest       → ❌ por defecto: es instrumento de medición (evaluación final);
 *                      la bandera existe pero no se activa sin decisión explícita.
 *  - subir_nivel   → ❌ por defecto: el mini-diagnóstico también mide.
 */
export type TipoExamen = 'examen_unidad' | 'pretest' | 'postest' | 'subir_nivel';
export const mostrarRepasoPrevio: Record<TipoExamen, boolean> = {
  examen_unidad: true,
  pretest: false,
  postest: false,
  subir_nivel: false,
};

/** Clave de persistencia (localStorage) del progreso de un mazo. */
export const claveMazo = (scope: string) => `prexi_flashcards_${scope}`;
