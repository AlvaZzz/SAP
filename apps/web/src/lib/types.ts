export type Rol = 'estudiante' | 'docente' | 'admin';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  carrera: string | null;
  pretestCompletado: boolean;
  nivelInicial: number;
  grupo?: 'control' | 'experimental';
}

export interface Opcion {
  id: string;
  texto: string;
}

export type TipoEjercicio = 'opcion_multiple' | 'predecir_salida' | 'completar_codigo';

export interface Ejercicio {
  id: number;
  titulo: string;
  categoria: string;
  nivelId: number;
  estrellas: number;
  tipo: TipoEjercicio;
  enunciado: string;
  codigoPython: string | null;
  opciones: Opcion[];
  xp: number;
  maxPistas: number;
  banco?: string;
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
}
