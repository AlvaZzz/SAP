import { IsInt, IsString, Min, Max, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { XP_MAX_ITEM } from '../../../common/xp/tope';

/** Revisión de una entrega de reto: aprobar (con XP) o pedir mejoras. */
export class RevisarEntregaDto {
  @IsBoolean()
  aprobado!: boolean;

  // XP a otorgar si se aprueba (0 si se pide mejorar). Acotado al máximo del reto en el backend.
  // No puede superar el tope de XP de un reto (25): lo que se otorga al
  // revisar es el XP de ESE reto, no una cifra libre.
  @IsOptional() @IsInt() @Min(0) @Max(XP_MAX_ITEM)
  xp?: number;

  @IsOptional() @IsString() @MaxLength(1000)
  feedback?: string;
}

/** Petición de borrador de feedback a PREXI (opcional, orienta el tono). */
export class SugerirFeedbackDto {
  @IsOptional() @IsBoolean()
  aprobado?: boolean;
}
