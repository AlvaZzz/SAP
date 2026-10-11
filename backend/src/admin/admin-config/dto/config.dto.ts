import { IsString, IsInt, IsBoolean, IsNumber, IsOptional, Min, Max, MaxLength, IsIn } from 'class-validator';

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

  // Inteligencia Artificial (PREXI).
  @IsOptional() @IsBoolean() iaActiva?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10) maxPistasIa?: number;
  @IsOptional() @IsInt() @Min(1) @Max(500) rateLimitIaHora?: number;
  @IsOptional() @IsIn(['inmediata', 'al_finalizar']) modoRetroalimentacion?: string;

  // Evaluación final.
  @IsOptional() @IsInt() @Min(1) @Max(5) postestDesdeNivel?: number;
  @IsOptional() @IsBoolean() encuestaMotivacionActiva?: boolean;
  // Rango objetivo del motor adaptativo (% de probabilidad de acierto esperada).
  @IsOptional() @IsInt() @Min(0) @Max(100) rangoObjetivoMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) rangoObjetivoMax?: number;
  // Fase de evaluación (SUS / ISO 25010) y criterios de aceptación de la hipótesis.
  @IsOptional() @IsBoolean() faseEvaluacionActiva?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) criterioPrecisionMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) criterioSusMin?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(5) nivelAceptableCalidad?: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) riesgoDiasInactivo?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) riesgoTasaAciertoMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) riesgoMinIntentos?: number;
}
