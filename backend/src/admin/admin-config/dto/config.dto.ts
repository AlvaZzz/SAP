import { IsString, IsInt, IsBoolean, IsOptional, Min, Max, MaxLength, IsIn } from 'class-validator';

/** Actualización parcial de la configuración central del sistema (todos los tabs). */
export class ActualizarConfigDto {
  // General.
  @IsOptional() @IsString() @MaxLength(80) nombreSistema?: string;
  @IsOptional() @IsString() @MaxLength(120) institucion?: string;
  @IsOptional() @IsString() @MaxLength(60) periodo?: string;
  @IsOptional() @IsString() @MaxLength(400) logoUrl?: string;

  // Gamificación.
  @IsOptional() @IsInt() @Min(0) @Max(1000) xpPorEjercicio?: number;
  @IsOptional() @IsInt() @Min(0) @Max(500) xpBonusRacha?: number;
  @IsOptional() @IsInt() @Min(0) @Max(500) xpPorLogro?: number;
  @IsOptional() @IsInt() @Min(10) @Max(100) umbralPorcentaje?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) penalizacionPista?: number;

  // Adaptatividad por niveles (Básico/Intermedio/Avanzado).
  @IsOptional() @IsInt() @Min(1) @Max(20) subirNivelPreguntas?: number;
  @IsOptional() @IsInt() @Min(50) @Max(100) subirNivelUmbral?: number;
  @IsOptional() @IsInt() @Min(0) @Max(168) subirNivelEsperaHoras?: number;
  @IsOptional() @IsInt() @Min(100) @Max(300) xpFactorIntermedio?: number;
  @IsOptional() @IsInt() @Min(100) @Max(400) xpFactorAvanzado?: number;

  // Inteligencia Artificial (ALVARO).
  @IsOptional() @IsBoolean() iaActiva?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10) maxPistasIa?: number;
  @IsOptional() @IsInt() @Min(1) @Max(500) rateLimitIaHora?: number;
  @IsOptional() @IsIn(['inmediata', 'al_finalizar']) modoRetroalimentacion?: string;

  // Investigación.
  @IsOptional() @IsInt() @Min(1) @Max(5) postestDesdeNivel?: number;
  @IsOptional() @IsBoolean() gruposBloqueados?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(60) riesgoDiasInactivo?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) riesgoTasaAciertoMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) riesgoMinIntentos?: number;
}
