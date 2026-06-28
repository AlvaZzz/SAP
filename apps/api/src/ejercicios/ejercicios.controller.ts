import { Controller, Get, Post, Param, Query, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { EjerciciosService } from './ejercicios.service';
import { ResponderDto } from './dto/responder.dto';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class EjerciciosController {
  constructor(private readonly ejercicios: EjerciciosService) {}

  @Get('niveles')
  async niveles(@CurrentUser('sub') usuarioId: number) {
    return { niveles: await this.ejercicios.niveles(usuarioId) };
  }

  @Get('ejercicios')
  async listar(@Query('nivel') nivel?: string, @Query('categoria') categoria?: string) {
    return { ejercicios: await this.ejercicios.listar(nivel ? Number(nivel) : undefined, categoria) };
  }

  // Debe declararse ANTES de :id para no chocar con el ParseIntPipe.
  @Get('ejercicios/resueltos')
  async resueltos(@CurrentUser('sub') usuarioId: number) {
    return { ids: await this.ejercicios.resueltos(usuarioId) };
  }

  @Get('ejercicios/:id')
  async detalle(@Param('id', ParseIntPipe) id: number) {
    return { ejercicio: await this.ejercicios.detalle(id) };
  }

  @Post('intentos')
  async responder(@CurrentUser('sub') usuarioId: number, @Body() dto: ResponderDto) {
    return this.ejercicios.responder(usuarioId, dto);
  }
}
