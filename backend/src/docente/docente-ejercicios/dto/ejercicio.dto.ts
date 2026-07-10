import {
  IsInt, IsString, Min, Max, IsOptional, MinLength, MaxLength,
  IsEnum, IsBoolean, IsArray, ValidateNested, ArrayMinSize, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoEjercicio } from '@prisma/client';

/**
 * Una opción de respuesta:
 *  - opcion_multiple: alternativa de respuesta ("A", "15").
 *  - ordenar_lineas: una línea de código a reordenar (Parsons); `id` es la
 *    etiqueta que se usa en `respuestaCorrecta` (ej. "B,A,D,C").
 */
export class OpcionDto {
  @IsString() @MinLength(1)
  id!: string;

  @IsString() @MinLength(1) @MaxLength(300)
  texto!: string;
}

const REQUIERE_OPCIONES: TipoEjercicio[] = ['opcion_multiple', 'ordenar_lineas'];

/**
 * Crear/editar un ejercicio de los 5 niveles (banco = practica).
 * La corrección/XP los sigue calculando el backend cuando el estudiante responde;
 * aquí el docente solo define el contenido.
 *
 * Formato de `respuestaCorrecta` según `tipo`:
 *  - opcion_multiple / predecir_salida: el id de la opción correcta.
 *  - completar_codigo: el valor esperado; variantes equivalentes separadas
 *    por "|" (ej. "for i in range(10)|for i in range(0,10)").
 *  - ordenar_lineas: ids de `opciones` en el orden correcto, separados por
 *    coma (ej. "B,A,D,C").
 */
export class CrearEjercicioDto {
  @IsString() @MinLength(3) @MaxLength(160)
  titulo!: string;

  @IsString() @MinLength(2) @MaxLength(80)
  categoria!: string;

  @IsInt() @Min(1) @Max(5)
  nivel!: number; // número de nivel (1-5), para XP/gamificación

  // Tema (jerarquía académica Unidad → Tema → Subtema) al que pertenece. Opcional.
  @IsOptional() @IsInt() @Min(1)
  temaId?: number;

  @IsInt() @Min(1) @Max(5)
  estrellas!: number; // dificultad 1-5

  @IsEnum(TipoEjercicio)
  tipo!: TipoEjercicio;

  @IsString() @MinLength(3)
  enunciado!: string;

  @IsOptional() @IsString()
  codigoPython?: string;

  // Requerido (mínimo 2) solo para opcion_multiple/ordenar_lineas; completar_codigo no las usa.
  @ValidateIf((o: CrearEjercicioDto) => REQUIERE_OPCIONES.includes(o.tipo))
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => OpcionDto)
  opciones?: OpcionDto[];

  @IsString() @MinLength(1) @MaxLength(300)
  respuestaCorrecta!: string;

  @IsInt() @Min(5) @Max(500)
  xp!: number;

  @IsOptional() @IsString()
  explicacionIa?: string;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}

/** Edición: todos los campos opcionales. */
export class EditarEjercicioDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  titulo?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  categoria?: string;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  nivel?: number;

  @IsOptional() @IsInt() @Min(1)
  temaId?: number;

  @IsOptional() @IsInt() @Min(1) @Max(5)
  estrellas?: number;

  @IsOptional() @IsEnum(TipoEjercicio)
  tipo?: TipoEjercicio;

  @IsOptional() @IsString() @MinLength(3)
  enunciado?: string;

  @IsOptional() @IsString()
  codigoPython?: string;

  @IsOptional() @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => OpcionDto)
  opciones?: OpcionDto[];

  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  respuestaCorrecta?: string;

  @IsOptional() @IsInt() @Min(5) @Max(500)
  xp?: number;

  @IsOptional() @IsString()
  explicacionIa?: string;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}
