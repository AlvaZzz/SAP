export type Rol = 'estudiante' | 'docente' | 'admin';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  carrera: string | null;
  diagnostico_completado: boolean;
}

export interface DiagnosticoPregunta {
  id: number;
  categoria: string;
  enunciado: string;
  pseudocodigo?: string;
  opciones: { id: string; texto: string }[];
}

export interface DiagnosticoResultado {
  puntaje: number;
  nivel: 'Principiante' | 'Intermedio' | 'Avanzado';
  fortalezas: string[];
  debilidades: string[];
  recomendaciones: { nivel_id: number; titulo: string; prioridad: string }[];
  analisis_ia: string;
}

export interface Opcion {
  id: string;
  texto: string;
}

export interface EjercicioPublico {
  id: number;
  titulo: string;
  categoria: string;
  nivel_id: number;
  dificultad: 'facil' | 'media' | 'dificil';
  enunciado: string;
  pseudocodigo: string | null;
  opciones: Opcion[];
  xp: number;
  max_pistas: number;
  respuesta_correcta?: string; // solo presente para docente/admin
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
  xp: { xpBase: number; multiplicador: number; xpOtorgado: number; rachaDias: number; xpTotal: number };
  nivel: { nivelCompletado: boolean; nivelDesbloqueadoNumero: number | null };
  logros_nuevos: string[];
  recomendacion: {
    aciertosConsecutivos: number;
    fallosConsecutivos: number;
    dificultadSugerida: string;
    pistaSugerida: 0 | 1 | 2 | 3;
    mensaje: string;
  };
}

export interface DashboardData {
  puntos: number;
  posicion: number | null;
  racha_dias: number;
  ejercicios: { completados: number; total: number };
  desempeno_categorias: { categoria: string; porcentaje: number }[];
  logros: { clave: string; nombre: string; icono: string; fecha_obtenido: string }[];
}

export interface RankingFila {
  posicion: number | null;
  usuario_id: number;
  nombre: string;
  xp_total: number;
  racha_dias: number;
}
