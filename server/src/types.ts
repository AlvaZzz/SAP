export type Rol = 'estudiante' | 'docente' | 'admin';
export type Dificultad = 'facil' | 'media' | 'dificil';
export type TipoTest = 'pre' | 'post';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  carrera: string | null;
  diagnostico_completado: boolean;
  pretest_completado: boolean;
  nivel_inicial: number;
}

export interface OpcionEjercicio {
  id: string;   // "A", "B", ...
  texto: string;
}

export type TipoEjercicio = 'opcion_multiple' | 'completar_codigo' | 'predecir_salida';

export interface Ejercicio {
  id: number;
  titulo: string;
  categoria: string;
  nivel_id: number;
  dificultad: Dificultad;
  estrellas: number;
  tipo: TipoEjercicio;
  enunciado: string;
  pseudocodigo: string | null;
  codigo_python: string | null;
  opciones: OpcionEjercicio[];
  respuesta_correcta: string;
  xp: number;
  explicacion_ia: string | null;
  max_pistas: number;
  banco: 'practica' | 'pretest' | 'postest';
}

export interface JwtPayload {
  sub: number;        // usuario.id
  rol: Rol;
  nombre: string;
}

// El cliente nunca debe recibir respuesta_correcta en listados de resolución.
export type EjercicioPublico = Omit<Ejercicio, 'respuesta_correcta'>;
