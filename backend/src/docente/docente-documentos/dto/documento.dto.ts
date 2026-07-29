import { IsInt, IsString, Min, Max, IsOptional, MinLength, MaxLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Metadatos del documento. Vienen como campos de un multipart/form-data junto
 * al archivo, por eso los numéricos se transforman explícitamente con @Type.
 */
export class CrearDocumentoDto {
  @IsString() @MinLength(3) @MaxLength(160)
  titulo!: string;

  @IsOptional() @IsString() @MaxLength(600)
  descripcion?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  nivel?: number; // número de nivel asociado (opcional)

  // Tema (jerarquía académica) asociado: fuente de contexto para ALVARO y para
  // "Generar preguntas desde este PDF".
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  temaId?: number;
}

export class EditarDocumentoDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160)
  titulo?: string;

  @IsOptional() @IsString() @MaxLength(600)
  descripcion?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  nivel?: number;

  // `null` explícito desasigna el tema (el documento vuelve a "General");
  // omitirlo deja el valor como estaba. Por eso admite null además de número.
  @ValidateIf((_, v) => v !== null)
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  temaId?: number | null;
}
