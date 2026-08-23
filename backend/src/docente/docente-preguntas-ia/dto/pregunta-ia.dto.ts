import { IsInt, IsString, Min, Max, IsOptional, MinLength, MaxLength, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoEjercicio } from '@prisma/client';
import { OpcionDto } from '../../docente-ejercicios/dto/ejercicio.dto';
import { XP_MAX_ITEM } from '../../../common/xp/tope';

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

  // TOPE DE XP: 25. El rango anterior llegaba a 500, veinte veces por encima
  // del ejercicio mas generoso que existe en el banco. Un rango asi no valida
  // nada: acepta cualquier cifra que el docente teclee por error y desequilibra
  // el ranking sin avisar. 25 es el techo pedagogico acordado.
  @IsInt() @Min(5) @Max(XP_MAX_ITEM)
  xp!: number;
}
