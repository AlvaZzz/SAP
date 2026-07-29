import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ExamenUnidadService } from './examen-unidad.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

class RespuestaExamenDto {
  @IsInt() @Min(1) ejercicioId!: number;
  @IsString() @MinLength(1) respuesta!: string;
}
class EvaluarExamenDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => RespuestaExamenDto)
  respuestas!: RespuestaExamenDto[];
}

/**
 * Examen de fin de unidad (rol estudiante). Todo cálculo (IRT, aprobación,
 * cooldown) en el backend; el frontend solo repasa, rinde y muestra el resultado.
 */
@Controller('examen-unidad')
@UseGuards(JwtAuthGuard)
export class ExamenUnidadController {
  constructor(private readonly examen: ExamenUnidadService) {}

  @Get(':unidadId/estado')
  estado(@CurrentUser('sub') usuarioId: number, @Param('unidadId', ParseIntPipe) unidadId: number) {
    return this.examen.estado(usuarioId, unidadId);
  }

  @Get(':unidadId/repaso')
  async repaso(@Param('unidadId', ParseIntPipe) unidadId: number) {
    return { temas: await this.examen.repaso(unidadId) };
  }

  @Post(':unidadId/repaso/completar')
  completarRepaso(@CurrentUser('sub') usuarioId: number, @Param('unidadId', ParseIntPipe) unidadId: number) {
    return this.examen.completarRepaso(usuarioId, unidadId);
  }

  @Get(':unidadId/iniciar')
  iniciar(@CurrentUser('sub') usuarioId: number, @Param('unidadId', ParseIntPipe) unidadId: number) {
    return this.examen.iniciar(usuarioId, unidadId);
  }

  @Post(':unidadId/evaluar')
  async evaluar(
    @CurrentUser('sub') usuarioId: number,
    @Param('unidadId', ParseIntPipe) unidadId: number,
    @Body() dto: EvaluarExamenDto,
  ) {
    return { resultado: await this.examen.evaluar(usuarioId, unidadId, dto.respuestas) };
  }
}
