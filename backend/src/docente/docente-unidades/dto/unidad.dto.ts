import { IsInt, IsString, Min, Max, IsOptional, MinLength, MaxLength, IsBoolean } from 'class-validator';

export class CrearUnidadDto {
  @IsInt() @Min(1) @Max(999)
  numero!: number;

  @IsString() @MinLength(3) @MaxLength(160)
  titulo!: string;

  @IsOptional() @IsString() @MaxLength(600)
  descripcion?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  xp?: number;

  @IsOptional() @IsInt() @Min(0)
  orden?: number;
}

export class EditarUnidadDto {
  @IsOptional() @IsInt() @Min(1) @Max(999)
  numero?: number;

  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  titulo?: string;

  @IsOptional() @IsString() @MaxLength(600)
  descripcion?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  xp?: number;

  @IsOptional() @IsInt() @Min(0)
  orden?: number;

  // Introducción teórica didáctica de la unidad (Markdown) para la fase previa
  // al diagnóstico. Amplia (hasta ~8k caracteres) porque incluye ejemplos.
  @IsOptional() @IsString() @MaxLength(8000)
  introduccion?: string;

  // Repaso/cierre de la unidad (Markdown) para la fase previa al postest.
  @IsOptional() @IsString() @MaxLength(8000)
  repaso?: string;

  // Dashboard de Destino: objetivos y analogías (Markdown), editables por el docente.
  @IsOptional() @IsString() @MaxLength(8000)
  dashObjetivos?: string;

  @IsOptional() @IsString() @MaxLength(8000)
  dashAnalogias?: string;
}

export class CrearTemaDto {
  // Si se omite, el tema se crea directamente bajo la unidad (no es subtema).
  @IsOptional() @IsInt() @Min(1)
  padreId?: number;

  @IsString() @MinLength(1) @MaxLength(20)
  numero!: string; // ej. "1.5" o "1.5.2"

  @IsString() @MinLength(3) @MaxLength(160)
  titulo!: string;

  @IsOptional() @IsString() @MaxLength(600)
  descripcion?: string;

  @IsOptional() @IsInt() @Min(1) @Max(1000)
  umbral?: number;

  @IsOptional() @IsInt() @Min(0)
  orden?: number;
}

export class EditarTemaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20)
  numero?: string;

  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  titulo?: string;

  @IsOptional() @IsString() @MaxLength(600)
  descripcion?: string;

  @IsOptional() @IsInt() @Min(1) @Max(1000)
  umbral?: number;

  @IsOptional() @IsInt() @Min(0)
  orden?: number;

  // Publicar/despublicar explícitamente (valida el mínimo de 10 ejercicios al publicar).
  @IsOptional() @IsBoolean()
  publicado?: boolean;

  // El docente marca/desmarca este tema para el DIAGNÓSTICO inicial.
  @IsOptional() @IsBoolean()
  enDiagnostico?: boolean;

  // Repaso/cierre del tema (Markdown) para la fase previa al examen de fin de unidad.
  @IsOptional() @IsString() @MaxLength(8000)
  repaso?: string;
}
