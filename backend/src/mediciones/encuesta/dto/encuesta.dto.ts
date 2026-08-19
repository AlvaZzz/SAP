import { IsArray, IsInt, IsString, Max, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ESCALA_MAX, ESCALA_MIN } from '../instrumento';

class RespuestaItemDto {
  /** Código del ítem en el instrumento (p. ej. "vt1"). */
  @IsString()
  itemId!: string;

  /**
   * Valor CRUDO de la escala MSLQ (1–7). La recodificación de los ítems
   * inversos es posterior, al puntuar: aquí se valida solo el rango.
   */
  @IsInt() @Min(ESCALA_MIN) @Max(ESCALA_MAX)
  valor!: number;
}

export class ResponderEncuestaDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RespuestaItemDto)
  respuestas!: RespuestaItemDto[];
}
