import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsInt, IsEnum, MinLength, Min } from 'class-validator';
import { ContextoCodigo } from '@prisma/client';
import { PracticaService } from './practica.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { AiRateLimitGuard } from '../../common/auth/ai-rate-limit.guard';
import { RetosAccessGuard } from '../retos/retos-access.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

class GuardarCodigoDto {
  @IsEnum(ContextoCodigo) contexto!: ContextoCodigo;
  @IsOptional() @IsInt() refId?: number;
  @IsString() codigo!: string;
}
class EjecutarDto {
  @IsString() @MinLength(1) codigo!: string;
  @IsEnum(ContextoCodigo) contexto!: ContextoCodigo;
  @IsOptional() @IsInt() refId?: number;
  @IsOptional() @IsString() stdin?: string;
}
class AsistirDto {
  @IsString() @MinLength(1) codigo!: string;
  @IsOptional() @IsString() enunciado?: string;
  @IsOptional() @IsString() pregunta?: string;
}
class TrazaDto {
  @IsString() @MinLength(1) codigo!: string;
  @IsOptional() @IsString() stdin?: string;
}
class VerificarRetoDto {
  @IsInt() @Min(1) retoId!: number;
  @IsString() @MinLength(1) codigo!: string;
}

// El editor de código solo se usa dentro de un reto → requiere acceso a retos
// (nivel Intermedio/Avanzado habilitado por el docente), validado en el backend.
@Controller('practica')
@UseGuards(JwtAuthGuard, RetosAccessGuard)
export class PracticaController {
  constructor(private readonly practica: PracticaService) {}

  @Get('codigo')
  async cargar(
    @CurrentUser('sub') usuarioId: number,
    @Query('contexto') contexto: ContextoCodigo = 'libre',
    @Query('refId') refId?: string,
  ) {
    const codigo = await this.practica.cargarCodigo(usuarioId, contexto, refId ? Number(refId) : undefined);
    return { codigo };
  }

  @Put('codigo')
  async guardar(@CurrentUser('sub') usuarioId: number, @Body() dto: GuardarCodigoDto) {
    return { codigo: await this.practica.guardarCodigo(usuarioId, dto.contexto, dto.codigo, dto.refId) };
  }

  @Post('ejecutar')
  ejecutar(@CurrentUser('sub') usuarioId: number, @Body() dto: EjecutarDto) {
    return this.practica.ejecutar(usuarioId, dto.codigo, dto.contexto, dto.refId, dto.stdin ?? '');
  }

  // ALVARO contextual sobre el código: cuenta para el límite de IA.
  @Post('asistir')
  @UseGuards(AiRateLimitGuard)
  asistir(@Body() dto: AsistirDto) {
    return this.practica.asistir(dto.codigo, dto.enunciado, dto.pregunta);
  }

  /** Visualizador de traza: ejecución paso a paso (línea + variables). */
  @Post('traza')
  traza(@Body() dto: TrazaDto) {
    return this.practica.traza(dto.codigo, dto.stdin ?? '');
  }

  /** Auto‑validación de una misión de depuración (bug‑hunt). */
  @Post('verificar-reto')
  verificarReto(@CurrentUser('sub') usuarioId: number, @Body() dto: VerificarRetoDto) {
    return this.practica.verificarReto(usuarioId, dto.retoId, dto.codigo);
  }
}
