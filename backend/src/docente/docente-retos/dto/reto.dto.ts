import {
  IsInt, IsString, Min, Max, IsOptional, MinLength, MaxLength, IsEnum, IsBoolean, IsDateString, ValidateIf, IsIn,
} from 'class-validator';
import { TipoEjercicio, NivelDificultad } from '@prisma/client';
import { XP_MAX_ITEM } from '../../../common/xp/tope';

/**
 * Crear/editar un reto extra (fuera de los 5 niveles). El estudiante lo resuelve
 * en la Zona de Práctica. ENGANCHE: al publicar (activo=true) aparece en
 * /estudiante/retos con el nombre del autor y la fecha.
 */
export class CrearRetoDto {
  @IsString() @MinLength(3) @MaxLength(160)
  titulo!: string;

  @IsString() @MinLength(2) @MaxLength(80)
  categoria!: string;

  // Nivel temático asociado (1-5), opcional.

  // Tema (o subtema) académico al que pertenece el reto. Ubica el reto en el
  // temario para agruparlo en la vista del estudiante.
  @IsOptional() @IsInt() @Min(1)
  temaId?: number;

  @IsInt() @Min(1) @Max(5)
  estrellas!: number; // dificultad 1-5

  @IsOptional() @IsEnum(TipoEjercicio)
  tipo?: TipoEjercicio;

  @IsString() @MinLength(3)
  enunciado!: string;

  @IsOptional() @IsString()
  codigoInicial?: string;

  @IsOptional() @IsString() @MaxLength(500)
  ejemploEntrada?: string;

  @IsOptional() @IsString() @MaxLength(500)
  ejemploSalida?: string;

  // TOPE DE XP: 25. El rango anterior llegaba a 500, veinte veces por encima
  // del ejercicio mas generoso que existe en el banco. Un rango asi no valida
  // nada: acepta cualquier cifra que el docente teclee por error y desequilibra
  // el ranking sin avisar. 25 es el techo pedagogico acordado.
  @IsInt() @Min(5) @Max(XP_MAX_ITEM)
  xp!: number;

  // Fecha límite opcional (ISO 8601).
  @IsOptional() @IsDateString()
  fechaLimite?: string;

  @IsOptional() @IsBoolean()
  activo?: boolean;

  // Misión de depuración: auto‑valida por comparación de salida (requiere ejemploSalida).
  @IsOptional() @IsBoolean()
  esBugHunt?: boolean;
}

/** Pide a PREXI propuestas de reto para un tema, un tipo y un nivel. */
export class SugerirRetosDto {
  @IsIn(['bug', 'codigo'])
  tipo!: 'bug' | 'codigo';

  @IsInt() @Min(1)
  temaId!: number;

  @IsEnum(NivelDificultad)
  nivel!: NivelDificultad;

  // Pista opcional del docente: "que use notas de un curso", "con listas"…
  @IsOptional() @IsString() @MaxLength(400)
  indicacion?: string;
}

export class EditarRetoDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  titulo?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  categoria?: string;


  // `null` explícito desasigna el tema (el reto vuelve a "General"); omitirlo lo
  // deja como estaba. Por eso admite null además de número.
  @ValidateIf((_, v) => v !== null)
  @IsOptional() @IsInt() @Min(1)
  temaId?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  estrellas?: number;

  @IsOptional() @IsEnum(TipoEjercicio)
  tipo?: TipoEjercicio;

  @IsOptional() @IsString() @MinLength(3)
  enunciado?: string;

  @IsOptional() @IsString()
  codigoInicial?: string;

  @IsOptional() @IsString() @MaxLength(500)
  ejemploEntrada?: string;

  @IsOptional() @IsString() @MaxLength(500)
  ejemploSalida?: string;

  @IsOptional() @IsInt() @Min(5) @Max(XP_MAX_ITEM)
  xp?: number;

  // Cadena vacía = quitar la fecha límite.
  @ValidateIf((_, v) => v !== '')
  @IsOptional() @IsDateString()
  fechaLimite?: string;

  @IsOptional() @IsBoolean()
  activo?: boolean;

  // Misión de depuración: auto‑valida por comparación de salida (requiere ejemploSalida).
  @IsOptional() @IsBoolean()
  esBugHunt?: boolean;
}
