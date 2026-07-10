import { IsArray, IsInt, ArrayNotEmpty, IsEnum, IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';
import { Grupo } from '@prisma/client';

/** Asignación de grupo de investigación (individual o masiva). */
export class AsignarGrupoDto {
  @IsArray() @ArrayNotEmpty() @IsInt({ each: true })
  ids!: number[];

  @IsEnum(Grupo, { message: 'Grupo inválido (control | experimental)' })
  grupo!: Grupo;

  // Etiqueta de institución/cohorte opcional a aplicar junto con el grupo.
  @IsOptional() @IsString() @MaxLength(120)
  institucion?: string;

  // Requerido para forzar el cambio cuando los grupos están bloqueados.
  @IsOptional() @IsBoolean()
  forzar?: boolean;
}

/** Asigna un paralelo COMPLETO (ej. "A") a un grupo de investigación de una sola vez. */
export class AsignarGrupoParaleloDto {
  @IsString() @MaxLength(10)
  paralelo!: string;

  @IsEnum(Grupo, { message: 'Grupo inválido (control | experimental)' })
  grupo!: Grupo;

  @IsOptional() @IsBoolean()
  forzar?: boolean;
}
