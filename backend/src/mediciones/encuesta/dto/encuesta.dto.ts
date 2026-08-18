import { IsArray, IsInt, IsString, Max, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { LIKERT_MAX, LIKERT_MIN } from '../instrumento';

class RespuestaItemDto {
  @IsString()
  itemId!: string;

  /** Valor CRUDO de la escala Likert; la recodificación de inversos es posterior. */
  @IsInt() @Min(LIKERT_MIN) @Max(LIKERT_MAX)
  valor!: number;
}

export class ResponderEncuestaDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RespuestaItemDto)
  respuestas!: RespuestaItemDto[];
}
