import { Body, Controller, Get, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { IsInt, IsString, Min, MinLength, IsOptional } from 'class-validator';
import { PostestService, TOTAL_POSTEST } from './postest.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

class ResponderPostestDto {
  @IsInt() @Min(1) ejercicioId!: number;
  @IsString() @MinLength(1) opcion!: string;
}
class FinalizarDto {
  @IsOptional() @IsInt() @Min(0) tiempoSeg?: number;
}

@Controller('postest')
@UseGuards(JwtAuthGuard)
export class PostestController {
  constructor(private readonly postest: PostestService) {}

  @Get('estado')
  estado(@CurrentUser('sub') usuarioId: number) {
    return this.postest.estado(usuarioId);
  }

  @Get('repaso')
  async repaso() {
    return { unidades: await this.postest.repaso() };
  }

  @Post('repaso/completar')
  completarRepaso(@CurrentUser('sub') usuarioId: number) {
    return this.postest.completarRepaso(usuarioId);
  }

  @Get('preguntas')
  async preguntas(@CurrentUser('sub') usuarioId: number) {
    return { preguntas: await this.postest.preguntas(usuarioId), total: TOTAL_POSTEST };
  }

  @Get('revision')
  async revision(@CurrentUser('sub') usuarioId: number) {
    // Seguridad: la revisión expone las respuestas correctas → solo tras finalizar.
    const est = await this.postest.estado(usuarioId);
    if (!est.completado) throw new BadRequestException('La revisión está disponible al finalizar el postest');
    return { revision: await this.postest.revision(usuarioId) };
  }

  @Post('responder')
  async responder(@CurrentUser('sub') usuarioId: number, @Body() dto: ResponderPostestDto) {
    // No se pueden alterar respuestas de un postest ya cerrado.
    const est = await this.postest.estado(usuarioId);
    if (est.completado) throw new BadRequestException('Ya completaste el postest');
    return this.postest.responder(usuarioId, dto.ejercicioId, dto.opcion);
  }

  @Post('finalizar')
  async finalizar(@CurrentUser('sub') usuarioId: number, @Body() dto: FinalizarDto) {
    const est = await this.postest.estado(usuarioId);
    if (est.completado) throw new BadRequestException('Ya completaste el postest');
    return { resultado: await this.postest.finalizar(usuarioId, dto.tiempoSeg ?? 0) };
  }
}
