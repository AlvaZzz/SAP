import { IsInt, IsString, Min, Max, IsOptional, MinLength, MaxLength, IsEnum, IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoEjercicio, NivelDificultad } from '@prisma/client';
import { OpcionDto } from '../../docente-ejercicios/dto/ejercicio.dto';
import { XP_MAX_ITEM } from '../../../common/xp/tope';

/**
 * Pide a PREXI proponer preguntas BORRADOR. Dos destinos:
 *  - un TEMA o subtema (`temaId`): ejercicios de práctica del nivel pedido;
 *  - el EXAMEN de una unidad (`unidadId`): preguntas integradoras de nivel
 *    intermedio, cada una combinando 2 o 3 temas de la unidad.
 * El material es opcional: un PDF ya subido, un texto pegado o nada (PREXI se
 * guía por el título del tema).
 */
export class GenerarPreguntasDto {
  @IsOptional() @IsInt() @Min(1)
  temaId?: number;

  @IsOptional() @IsInt() @Min(1)
  unidadId?: number;

  @IsOptional() @IsInt() @Min(1)
  documentoId?: number;

  @IsOptional() @IsString() @MaxLength(12000)
  texto?: string;

  @IsOptional() @IsEnum(NivelDificultad)
  nivel?: NivelDificultad; // default basico (el examen siempre es intermedio)

  @IsOptional() @IsInt() @Min(1) @Max(10)
  cantidad?: number; // default 10

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

  // Temas que combina una pregunta de examen (2 o 3 de la misma unidad).
  @IsOptional() @IsArray() @ArrayMinSize(2) @ArrayMaxSize(3) @IsInt({ each: true })
  temasIntegrados?: number[];
}

/** Aprueba el borrador: el docente asigna nivel/XP/dificultad y se crea el Ejercicio real. */
export class AprobarPreguntaIaDto {
  // Opcionales: si no llegan, se derivan del nivel con el que se generó.
  @IsOptional() @IsInt() @Min(1) @Max(5)
  estrellas?: number;

  // TOPE DE XP: 25. El rango anterior llegaba a 500, veinte veces por encima
  // del ejercicio mas generoso que existe en el banco. Un rango asi no valida
  // nada: acepta cualquier cifra que el docente teclee por error y desequilibra
  // el ranking sin avisar. 25 es el techo pedagogico acordado.
  @IsOptional() @IsInt() @Min(5) @Max(XP_MAX_ITEM)
  xp?: number;
}
