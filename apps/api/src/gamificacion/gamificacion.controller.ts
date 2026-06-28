import { Controller, Get, UseGuards } from '@nestjs/common';
import { GamificacionService } from './gamificacion.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

@Controller('gamificacion')
@UseGuards(JwtAuthGuard)
export class GamificacionController {
  constructor(private readonly gami: GamificacionService) {}

  @Get('resumen')
  resumen(@CurrentUser('sub') id: number) {
    return this.gami.resumen(id);
  }

  @Get('logros')
  async logros(@CurrentUser('sub') id: number) {
    return { logros: await this.gami.logros(id) };
  }

  @Get('recomendados')
  async recomendados(@CurrentUser('sub') id: number) {
    return { recomendados: await this.gami.recomendados(id) };
  }

  @Get('actividad')
  async actividad(@CurrentUser('sub') id: number) {
    return { actividad: await this.gami.actividad(id) };
  }
}
