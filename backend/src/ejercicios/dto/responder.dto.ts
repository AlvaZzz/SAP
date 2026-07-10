import { IsInt, IsString, Min, IsOptional, MinLength } from 'class-validator';

/**
 * Lo que el cliente envía al responder un ejercicio.
 * REGLA: nunca incluye `correcto`, `xp` ni `usuario_id`. La corrección y el XP
 * se calculan SIEMPRE en el backend; el usuario sale del JWT.
 */
export class ResponderDto {
  @IsInt() @Min(1)
  ejercicioId!: number;

  @IsString() @MinLength(1)
  respuestaDada!: string;

  @IsOptional() @IsInt() @Min(0)
  tiempoSeg?: number;

  @IsOptional() @IsInt() @Min(0)
  pistasUsadas?: number;
}
