import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsInt, IsEnum, MinLength } from 'class-validator';
import { ContextoCodigo } from '@prisma/client';
import { PracticaService } from './practica.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { AiRateLimitGuard } from '../common/auth/ai-rate-limit.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

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

@Controller('practica')
@UseGuards(JwtAuthGuard)
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

  // ALEX contextual sobre el código: cuenta para el límite de IA.
  @Post('asistir')
  @UseGuards(AiRateLimitGuard)
  asistir(@Body() dto: AsistirDto) {
    return this.practica.asistir(dto.codigo, dto.enunciado, dto.pregunta);
  }
}
