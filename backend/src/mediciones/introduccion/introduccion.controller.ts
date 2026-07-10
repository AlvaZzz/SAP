import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IntroduccionService } from './introduccion.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

/**
 * Fase de introducción didáctica (previa al diagnóstico). Todo cálculo/estado en
 * el backend; el frontend solo renderiza las pestañas y marca la lectura.
 */
@Controller('introduccion')
@UseGuards(JwtAuthGuard)
export class IntroduccionController {
  constructor(private readonly introduccion: IntroduccionService) {}

  @Get()
  async unidades() {
    return { unidades: await this.introduccion.unidades() };
  }

  @Get('estado')
  estado(@CurrentUser('sub') usuarioId: number) {
    return this.introduccion.estado(usuarioId);
  }

  @Post('completar')
  completar(@CurrentUser('sub') usuarioId: number) {
    return this.introduccion.completar(usuarioId);
  }
}
