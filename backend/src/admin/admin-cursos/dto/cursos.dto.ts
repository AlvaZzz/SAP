import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class AsignarDocenteDto {
  /** id del docente, o null para dejar el paralelo sin docente. */
  @ValidateIf((_, v) => v !== null) @IsInt({ message: 'Elige un docente de la lista.' }) @Min(1)
  docenteId!: number | null;
}

export class CrearMateriaDto {
  @IsString() @MinLength(3, { message: 'Escribe el nombre de la materia (al menos 3 letras).' }) @MaxLength(120, { message: 'El nombre es demasiado largo.' })
  nombre!: string;

  @IsOptional() @IsString() @MaxLength(20, { message: 'La sigla es demasiado larga.' })
  sigla?: string;

  @IsString({ message: 'Escribe la gestión, por ejemplo 2026-II.' }) @MaxLength(10, { message: 'La gestión va como 2026-I o 2026-II.' })
  gestion!: string;
}

export class CrearParaleloDto {
  @IsInt({ message: 'Elige la materia.' }) @Min(1)
  materiaId!: number;

  @IsString() @MinLength(1, { message: 'Escribe el paralelo (A, B, 1…).' }) @MaxLength(12, { message: 'El paralelo es una letra o un número corto.' })
  nombre!: string;

  @IsOptional() @IsInt({ message: 'Elige un docente de la lista.' }) @Min(1)
  docenteId?: number;
}
