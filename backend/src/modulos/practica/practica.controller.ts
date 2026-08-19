import { Body, Controller, Get, GoneException, Post, Put, Query, UseGuards } from '@nestjs/common';
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
/** Persistencia del código + la salida que produjo el NAVEGADOR (no se ejecuta aquí). */
class GuardarEjecucionDto {
  @IsString() @MinLength(1) codigo!: string;
  @IsEnum(ContextoCodigo) contexto!: ContextoCodigo;
  @IsOptional() @IsInt() refId?: number;
  @IsOptional() @IsString() salida?: string;
}
class AsistirDto {
  @IsString() @MinLength(1) codigo!: string;
  @IsOptional() @IsString() enunciado?: string;
  @IsOptional() @IsString() pregunta?: string;
}
class VerificarRetoDto {
  @IsInt() @Min(1) retoId!: number;
  /** Salida que produjo la ejecución en el NAVEGADOR (el código no se envía). */
  @IsOptional() @IsString() salida?: string;
}

// El editor de código solo se usa dentro de un reto → requiere acceso a retos
// (nivel Intermedio/Avanzado habilitado por el docente), validado en el backend.
@Controller('practica')
@UseGuards(JwtAuthGuard, RetosAccessGuard)
export class PracticaController {
  constructor(private readonly practica: PracticaService) {}

  // TODO: REVISAR_ANTES_DE_ELIMINAR — el editor de retos guarda con POST /practica/ejecucion y no vuelve a cargar el borrador; GET/PUT de código quedaron sin consumidor.
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

  /**
   * Guarda el código y su última salida. La EJECUCIÓN ya no ocurre en el servidor:
   * corre en el navegador con Pyodide (frontend/src/lib/python-runtime.ts), así que
   * el código del estudiante nunca viaja aquí para ejecutarse.
   */
  @Post('ejecucion')
  guardarEjecucion(@CurrentUser('sub') usuarioId: number, @Body() dto: GuardarEjecucionDto) {
    return this.practica.guardarEjecucion(usuarioId, dto.codigo, dto.salida ?? '', dto.contexto, dto.refId);
  }

  // ALVARO contextual sobre el código: cuenta para el límite de IA.
  @Post('asistir')
  @UseGuards(AiRateLimitGuard)
  asistir(@Body() dto: AsistirDto) {
    return this.practica.asistir(dto.codigo, dto.enunciado, dto.pregunta);
  }

  /**
   * COMPATIBILIDAD: la traza paso a paso se calcula ahora en el navegador. Se
   * mantiene la ruta para que un cliente antiguo reciba un mensaje claro en vez
   * de un 404, pero NUNCA se ejecuta código en el servidor.
   */
  @Post('traza')
  traza() {
    throw new GoneException('La ejecución paso a paso ahora ocurre en tu navegador. Actualiza la página.');
  }

  /**
   * AUTOCOMPROBACIÓN de un reto: compara la salida que reporta el navegador con la
   * esperada. NO otorga XP (ver PracticaService.comprobarReto): esa salida la
   * genera el cliente y sería falsificable.
   */
  @Post('verificar-reto')
  verificarReto(@Body() dto: VerificarRetoDto) {
    return this.practica.comprobarReto(dto.retoId, dto.salida ?? '');
  }
}
