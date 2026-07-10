import { IsInt, IsString, Min, Max, IsOptional, IsBoolean, MaxLength } from 'class-validator';

/** Revisión de una entrega de reto: aprobar (con XP) o pedir mejoras. */
export class RevisarEntregaDto {
  @IsBoolean()
  aprobado!: boolean;

  // XP a otorgar si se aprueba (0 si se pide mejorar). Acotado al máximo del reto en el backend.
  @IsOptional() @IsInt() @Min(0) @Max(500)
  xp?: number;

  @IsOptional() @IsString() @MaxLength(1000)
  feedback?: string;
}

/** Petición de borrador de feedback a ALVARO (opcional, orienta el tono). */
export class SugerirFeedbackDto {
  @IsOptional() @IsBoolean()
  aprobado?: boolean;
}
