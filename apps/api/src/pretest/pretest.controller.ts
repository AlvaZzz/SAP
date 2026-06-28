import { Body, Controller, Get, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { IsInt, IsString, Min, MinLength, IsOptional } from 'class-validator';
import { PretestService, TOTAL_PRETEST } from './pretest.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

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
  constructor(private readonly pretest: PretestService) {}

  @Get('estado')
  estado(@CurrentUser('sub') usuarioId: number) {
    return this.pretest.estado(usuarioId);
  }

  @Get('preguntas')
  async preguntas(@CurrentUser('sub') usuarioId: number) {
    const est = await this.pretest.estado(usuarioId);
    if (est.completado) throw new BadRequestException('Ya completaste el pretest');
    return { preguntas: await this.pretest.preguntas(usuarioId), total: TOTAL_PRETEST };
  }

  @Post('responder')
  responder(@CurrentUser('sub') usuarioId: number, @Body() dto: ResponderPretestDto) {
    return this.pretest.responder(usuarioId, dto.ejercicioId, dto.opcion);
  }

  @Post('finalizar')
  async finalizar(@CurrentUser('sub') usuarioId: number, @Body() dto: FinalizarDto) {
    return { resultado: await this.pretest.finalizar(usuarioId, dto.tiempoSeg ?? 0) };
  }
}
