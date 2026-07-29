export type Rol = 'estudiante' | 'docente' | 'admin' | 'investigador';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  carrera: string | null;
  introduccionCompletada: boolean;
  pretestCompletado: boolean;
  nivelInicial: number;
  grupo?: 'control' | 'experimental';
  paralelo?: string | null;
  semestre?: number;
  // Preferencias de audio (persistidas por usuario en el backend).
  sonidosActivados?: boolean;
  vozAutomatica?: boolean;
}

export interface Opcion {
  id: string;
  texto: string;
}

export type TipoEjercicio = 'opcion_multiple' | 'predecir_salida' | 'completar_codigo' | 'ordenar_lineas';

export interface Ejercicio {
  id: number;
  titulo: string;
  categoria: string;
  nivelId: number;
  temaId?: number | null;
  estrellas: number;
  // Nivel de dificultad adaptativo (reemplaza a las estrellas en la UI).
  nivelDificultad?: NivelDificultad;
  tipo: TipoEjercicio;
  enunciado: string;
  codigoPython: string | null;
  opciones: Opcion[];
  xp: number;
  maxPistas: number;
  banco?: string;
  // Presentes en el detalle (para los badges de la vista de resolver).
  tema?: { numero: string; titulo: string; unidad: { numero: number; titulo: string } } | null;
  nivel?: { numero: number; titulo: string } | null;
}

export interface EmblemaOtorgado { clave: string; nombre: string; descripcion: string; svgKey: string; icono: string }

/* ── Unidad → Tema → Subtema (estructura académica) ────── */
export type NivelDificultad = 'basico' | 'intermedio' | 'avanzado';

export interface TemaEstudiante {
  id: number; numero: string; titulo: string; descripcion: string | null;
  umbral: number; total_ejercicios: number; ejercicios_completados: number;
  desbloqueado: boolean; estado: 'completado' | 'en_progreso' | 'bloqueado';
  // Adaptatividad por niveles (Básico/Intermedio/Avanzado) POR TEMA.
  total_ejercicios_nivel: number;
  nivel_actual: NivelDificultad; nivel_actual_label: string;
  nivel_objetivo: NivelDificultad | null; nivel_objetivo_label: string | null;
  puede_subir: boolean;
  // El estudiante ya está en el nivel máximo (Avanzado) en este tema.
  nivel_maximo: boolean;
  // Solo presente en temas de primer nivel; los subtemas no traen subtemas propios.
  subtemas?: TemaEstudiante[];
}
export interface UnidadEstudiante {
  id: number; numero: number; titulo: string; descripcion: string | null; xp: number;
  imagen_url: string | null;
  // Gate de unidad: se desbloquea cuando la anterior tiene su EXAMEN aprobado.
  desbloqueada: boolean;
  dominio_pct: number; nivel_dominio: NivelDificultad; nivel_dominio_label: string;
  requiere_nivel: NivelDificultad; requiere_nivel_label: string; habilita_siguiente: boolean;
  // Examen de fin de unidad (gate de avance).
  examen_aprobado: boolean; examen_disponible: boolean; repaso_revisado: boolean; puede_rendir_examen: boolean;
  temas: TemaEstudiante[];
}

// Nombres/colores de los NIVELES de dominio — MISMO color en todo el sistema
// (badge Y barra de progreso, en cualquier vista): Básico=ámbar (en camino),
// Intermedio=azul acento, Avanzado=verde (dominado).
export const NIVEL_LABEL: Record<NivelDificultad, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };
export const NIVEL_COLOR: Record<NivelDificultad, string> = { basico: '#F59E0B', intermedio: '#3B82F6', avanzado: '#10B981' };

// Color de ACENTO por UNIDAD (barra superior de la tarjeta, número de unidad,
// barra de progreso de la unidad) — nunca como fondo grande. Único lugar de la
// verdad para que todas las vistas coloreen las unidades igual.
export const UNIDAD_COLOR: Record<number, string> = {
  1: '#3B82F6', // azul
  2: '#8B5CF6', // morado
  3: '#06B6D4', // cian
  4: '#F59E0B', // ámbar
  5: '#EC4899', // rosa
};
/** Color de la unidad `n` (cae al azul si excede el catálogo). */
export const colorUnidad = (n: number): string => UNIDAD_COLOR[n] ?? '#3B82F6';

export interface TemaDocente {
  id: number; numero: string; titulo: string; descripcion: string | null; repaso: string | null; orden: number;
  umbral: number; publicado: boolean; ejercicios_activos: number; ejercicios_minimos: number;
  puede_publicarse: boolean;
  en_diagnostico: boolean; items_diagnostico: number; puede_diagnosticar: boolean;
  subtemas: TemaDocente[];
}
export interface UnidadDocente {
  id: number; numero: number; titulo: string; descripcion: string | null; introduccion: string | null; repaso: string | null;
  dashObjetivos: string | null; dashAnalogias: string | null;
  xp: number; orden: number;
  imagen_url: string | null;
  temas: TemaDocente[];
}
/**
 * Tema para selectores. `etiqueta` sirve para selects planos; los campos de
 * estructura (unidad/padre/orden) permiten armar desplegables dependientes
 * Unidad → Tema → Subtema. Un SUBTEMA es un tema con `padre_id`.
 */
export interface OpcionTema {
  id: number;
  etiqueta: string;
  publicado: boolean;
  numero: string;
  titulo: string;
  orden: number;
  padre_id: number | null;
  unidad_id: number;
  unidad_numero: number;
  unidad_titulo: string;
}

/* ── Hábitos de estudio (vista de progreso, Bloque B) ── */

/** 'baja'/'sube' describen el MOVIMIENTO del dato, no si es bueno o malo:
 *  en autonomía, 'baja' (menos pistas) es la buena noticia. */
export type Tendencia = 'baja' | 'sube' | 'estable' | 'sin_datos';

export interface Habitos {
  constancia: {
    racha_dias: number;
    dias: { dia: string; resueltos: number; intentos: number }[];
    dias_activos_semana: number;
  };
  autonomia: {
    total_pistas: number;
    total_consultas: number;
    sin_pistas_pct: number;
    pistas_por_ejercicio: number;
    serie: { bloque: number; n: number; pistas_por_ejercicio: number; sin_pistas_pct: number }[];
    /** Negativo = cada vez usa menos pistas. */
    delta: number | null;
    tendencia: Tendencia;
  };
  eficiencia: {
    tasa_acierto: number;
    tiempo_medio_seg: number | null;
    total_intentos: number;
    serie: { bloque: number; n: number; tasa_acierto: number; tiempo_medio_seg: number | null }[];
    delta_tasa: number | null;
    delta_tiempo_seg: number | null;
    tendencia_tasa: Tendencia;
  };
}

/** Referencia académica de un documento (deriva del tema asociado). */
export interface RefAcademica { id: number; numero: string; titulo: string }

export type EstadoReto = 'nuevo' | 'pendiente' | 'aprobado' | 'necesita_mejorar';

export interface RetoEstudiante {
  id: number;
  titulo: string;
  categoria: string;
  nivel: number | null;
  /** Nivel adaptativo del reto; coincide con el del estudiante en ese tema. */
  nivel_dificultad?: NivelDificultad;
  nivel_label?: string;
  estrellas: number;
  enunciado: string;
  xp: number;
  fecha_limite: string | null;
  autor: string;
  fecha: string;
  estado: EstadoReto;
  xp_obtenido: number;
  feedback: string | null;
  es_bug_hunt: boolean;
  /** Se corrige solo comparando la salida (derivado del banco o bug-hunt). */
  auto_calificable?: boolean;
  /** Ya aprobado por este estudiante. */
  completado?: boolean;
  /** Ejercicio del banco del que se derivó (trazabilidad). */
  origen_ejercicio?: { id: number; codigo: string | null } | null;
  unidad: { id: number; numero: number; titulo: string } | null;
  tema: RefAcademica | null;
  subtema: RefAcademica | null;
}

export interface DocumentoEstudiante {
  id: number;
  titulo: string;
  descripcion: string | null;
  archivo: string;
  tamano_bytes: number;
  nivel: string | null;
  subido_por: string;
  fecha: string;
  unidad: { id: number; numero: number; titulo: string } | null;
  tema: RefAcademica | null;
  subtema: RefAcademica | null;
}

export interface Nivel {
  id: number;
  numero: number;
  titulo: string;
  descripcion: string | null;
  umbral: number;
  total_ejercicios: number;
  ejercicios_completados: number;
  desbloqueado: boolean;
}

export interface ResultadoIntento {
  correcto: boolean;
  respuesta_correcta: string;
  explicacion_base: string | null;
  xp: { xpOtorgado: number; multiplicador: number; rachaDias: number };
  nivel: { nivelCompletado: boolean; nivelDesbloqueadoNumero: number | null };
  logros_nuevos?: string[];
  emblemas_nuevos?: EmblemaOtorgado[];
  rango_subido?: { titulo: string; rangoClave: string } | null;
}

/* ── Rol docente ─────────────────────────────────────── */
export type EstadoEstudiante = 'completado' | 'en_progreso' | 'inactivo' | 'en_riesgo';

export interface DocenteEjercicio {
  id: number;
  titulo: string;
  categoria: string;
  banco: 'practica' | 'pretest' | 'postest' | 'examen';
  nivel: number;
  nivel_titulo: string;
  temaId: number | null;
  tema_numero: string | null;
  tema_titulo: string | null;
  estrellas: number;
  tipo: TipoEjercicio;
  enunciado: string;
  codigoPython: string | null;
  opciones: Opcion[];
  respuestaCorrecta: string;
  xp: number;
  explicacionIa: string | null;
  activo: boolean;
  intentos: number;
  creadoEn: string;
}

/* ── Preguntas generadas por ALVARO desde un PDF (borrador) ── */
export interface PreguntaIa {
  id: number; temaId: number; tema: string; documento: string | null;
  tipo: TipoEjercicio; categoria: string; enunciado: string; codigoPython: string | null;
  opciones: Opcion[]; respuestaCorrecta: string; explicacionIa: string | null;
  estado: 'borrador' | 'aprobada' | 'rechazada'; fecha: string;
}

export interface DocenteReto {
  id: number;
  titulo: string;
  categoria: string;
  nivel: number | null;
  nivel_titulo: string | null;
  temaId: number | null;
  tema_titulo: string | null;
  estrellas: number;
  tipo: TipoEjercicio;
  enunciado: string;
  codigoInicial: string | null;
  ejemploEntrada: string | null;
  ejemploSalida: string | null;
  xp: number;
  fechaLimite: string | null;
  activo: boolean;
  esBugHunt: boolean;
  resueltos: number;
  pendientes: number;
  creadoEn: string;
}

export type EstadoEntregaReto = 'pendiente_revision' | 'aprobado' | 'necesita_mejorar';

export interface EntregaReto {
  retoId: number;
  retoTitulo: string;
  categoria: string;
  enunciado: string;
  xpSugerido: number;
  estudianteId: number;
  estudiante: string;
  email: string;
  estado: EstadoEntregaReto;
  codigo: string | null;
  xp_obtenido: number;
  feedback: string | null;
  entregado_en: string | null;
  revisado_en: string | null;
}

export interface DocenteDocumento {
  id: number;
  titulo: string;
  descripcion: string | null;
  tamano_bytes: number;
  nivel: number | null;
  nivel_titulo: string | null;
  temaId: number | null;
  tema_titulo: string | null;
  tiene_texto: boolean;
  fecha: string;
}

export interface EstudianteFila {
  id: number;
  nombre: string;
  email: string;
  nivel_actual: number;
  xp: number;
  ejercicios_completados: number;
  ultima_sesion: string | null;
  estado: EstadoEstudiante;
}

export interface EstudianteDetalle {
  estudiante: {
    id: number; nombre: string; email: string; carrera: string | null;
    grupo: 'control' | 'experimental'; estado: EstadoEstudiante;
    xp: number; racha_dias: number; ejercicios_completados: number;
    total_intentos: number; tasa_acierto: number; ultima_sesion: string | null;
  };
  progreso_niveles: { numero: number; titulo: string; umbral: number; ejercicios_completados: number; desbloqueado: boolean; estado: string }[];
  actividad: { dia: string; intentos: number; aciertos: number }[];
  historial: { titulo: string; categoria: string; correcto: boolean; xp: number; tiempo_seg: number; fecha: string }[];
  // Errores recurrentes detectados por ALVARO (mismo detector que usa el tutor).
  patrones_error: { clave: string; descripcion: string; frecuencia: number }[];
  pretest: { puntaje: number; tiempo_seg: number; por_categoria: unknown; fecha: string } | null;
  postest: { puntaje: number; tiempo_seg: number; por_categoria: unknown; fecha: string } | null;
  ganancia: number | null;
  nota: string;
}
