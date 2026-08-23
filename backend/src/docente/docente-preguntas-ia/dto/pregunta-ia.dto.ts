import { IsInt, IsString, Min, Max, IsOptional, MinLength, MaxLength, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoEjercicio } from '@prisma/client';
import { OpcionDto } from '../../docente-ejercicios/dto/ejercicio.dto';

/** Pide a PREXI proponer preguntas BORRADOR a partir de un PDF ya subido. */
export class GenerarPreguntasDto {
  @IsInt() @Min(1)
  documentoId!: number;

  @IsInt() @Min(1)
  temaId!: number;

  @IsOptional() @IsInt() @Min(1) @Max(10)
  cantidad?: number; // default 5

  @IsOptional() @IsEnum(TipoEjercicio)
  tipo?: TipoEjercicio; // default opcion_multiple
}

/** Edición del borrador antes de aprobar (el docente corrige lo que haga falta). */
export class EditarPreguntaIaDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  categoria?: string;

  @IsOptional() @IsString() @MinLength(3)
  enunciado?: string;

  @IsOptional() @IsString()
  codigoPython?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OpcionDto)
  opciones?: OpcionDto[];

  @IsOptional() @IsString() @MinLength(1) @MaxLength(300)
  respuestaCorrecta?: string;

  @IsOptional() @IsString()
  explicacionIa?: string;
}

/** Aprueba el borrador: el docente asigna nivel/XP/dificultad y se crea el Ejercicio real. */
export class AprobarPreguntaIaDto {

  @IsInt() @Min(1) @Max(5)
  estrellas!: number;

  @IsInt() @Min(5) @Max(500)
  xp!: number;
}
