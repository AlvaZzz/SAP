import { Body, Controller, Get, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { IsInt, IsString, Min, MinLength, IsOptional } from 'class-validator';
import { PretestService } from './pretest.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

class ResponderPretestDto {
  @IsInt() @Min(1) ejercicioId!: number;
  @IsString() @MinLength(1) opcion!: string;
}
class FinalizarDto {
  @IsOptional() @IsInt() @Min(0) tiempoSeg?: number;
}

@Controller('pretest')
@UseGuards(JwtAuthGuard)
export class PretestController {
  constructor(
    private readonly pretest: PretestService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('estado')
  estado(@CurrentUser('sub') usuarioId: number) {
    return this.pretest.estado(usuarioId);
  }

  @Get('preguntas')
  async preguntas(@CurrentUser('sub') usuarioId: number) {
    const est = await this.pretest.estado(usuarioId);
    if (est.completado) throw new BadRequestException('Ya completaste el diagnóstico');
    // Gate: el diagnóstico solo se habilita tras revisar la introducción.
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { introduccionCompletada: true } });
    if (!u?.introduccionCompletada) throw new BadRequestException('Revisa la introducción antes de comenzar el diagnóstico');
    const preguntas = await this.pretest.preguntas(usuarioId);
    return { preguntas, total: preguntas.length };
  }

  @Post('responder')
  async responder(@CurrentUser('sub') usuarioId: number, @Body() dto: ResponderPretestDto) {
    // No se pueden alterar respuestas de un diagnóstico ya cerrado.
    const est = await this.pretest.estado(usuarioId);
    if (est.completado) throw new BadRequestException('Ya completaste el diagnóstico');
    return this.pretest.responder(usuarioId, dto.ejercicioId, dto.opcion);
  }

  @Post('finalizar')
  async finalizar(@CurrentUser('sub') usuarioId: number, @Body() dto: FinalizarDto) {
    return { resultado: await this.pretest.finalizar(usuarioId, dto.tiempoSeg ?? 0) };
  }

  @Get('revision')
  async revision(@CurrentUser('sub') usuarioId: number) {
    // Seguridad: la revisión expone las respuestas correctas → solo tras finalizar.
    const est = await this.pretest.estado(usuarioId);
    if (!est.completado) throw new BadRequestException('La revisión está disponible al finalizar el pretest');
    return { revision: await this.pretest.revision(usuarioId) };
  }
}
