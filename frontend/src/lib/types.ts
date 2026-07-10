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
  // Gate de unidad por dominio agregado (≥ Intermedio en la anterior).
  desbloqueada: boolean;
  dominio_pct: number; nivel_dominio: NivelDificultad; nivel_dominio_label: string;
  requiere_nivel: NivelDificultad; requiere_nivel_label: string; habilita_siguiente: boolean;
  temas: TemaEstudiante[];
}

// Nombres/colores de los niveles adaptativos (paleta sobria) — reutilizable en la UI.
export const NIVEL_LABEL: Record<NivelDificultad, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };
export const NIVEL_COLOR: Record<NivelDificultad, string> = { basico: '#B5822E', intermedio: '#2C4A6E', avanzado: '#2E7D5B' };

export interface TemaDocente {
  id: number; numero: string; titulo: string; descripcion: string | null; orden: number;
  umbral: number; publicado: boolean; ejercicios_activos: number; ejercicios_minimos: number;
  puede_publicarse: boolean;
  en_diagnostico: boolean; items_diagnostico: number; puede_diagnosticar: boolean;
  subtemas: TemaDocente[];
}
export interface UnidadDocente {
  id: number; numero: number; titulo: string; descripcion: string | null; introduccion: string | null; xp: number; orden: number;
  temas: TemaDocente[];
}
export interface OpcionTema { id: number; etiqueta: string; publicado: boolean }

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
  estrellas: number;
  tipo: TipoEjercicio;
  enunciado: string;
  codigoInicial: string | null;
  ejemploEntrada: string | null;
  ejemploSalida: string | null;
  xp: number;
  fechaLimite: string | null;
  activo: boolean;
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
