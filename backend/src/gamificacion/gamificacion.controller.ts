import { Controller, Get, UseGuards } from '@nestjs/common';
import { GamificacionService } from './gamificacion.service';
import { EmblemasService } from './emblemas.service';
import { RangosService } from './rangos.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

@Controller('gamificacion')
@UseGuards(JwtAuthGuard)
export class GamificacionController {
  constructor(
    private readonly gami: GamificacionService,
    private readonly emblemas: EmblemasService,
    private readonly rangos: RangosService,
  ) {}

  @Get('resumen')
  resumen(@CurrentUser('sub') id: number) {
    return this.gami.resumen(id);
  }

  // TODO: REVISAR_ANTES_DE_ELIMINAR — ningún cliente llama a /gamificacion/logros; el frontend usa emblemas y rangos. Confirmar que no lo consuma el tour o un informe antes de quitarlo.
  @Get('logros')
  async logros(@CurrentUser('sub') id: number) {
    return { logros: await this.gami.logros(id) };
  }

  // Emblemas con estado (desbloqueado/bloqueado + requisito) para ranking/perfil.
  @Get('emblemas')
  listarEmblemas(@CurrentUser('sub') id: number) {
    return this.emblemas.listar(id);
  }

  // Rango por unidad + rango global con progreso al siguiente (banner de progreso).
  @Get('rangos')
  resumenRangos(@CurrentUser('sub') id: number) {
    return this.rangos.resumen(id);
  }

  @Get('rangos/catalogo')
  catalogoRangos() {
    return { rangos: this.rangos.catalogo() };
  }

  @Get('recomendados')
  async recomendados(@CurrentUser('sub') id: number) {
    return { recomendados: await this.gami.recomendados(id) };
  }

  @Get('actividad')
  async actividad(@CurrentUser('sub') id: number) {
    return { actividad: await this.gami.actividad(id) };
  }

  // Últimos intentos del propio estudiante (lista "Actividad reciente") + tasa de acierto global.
  @Get('recientes')
  recientes(@CurrentUser('sub') id: number) {
    return this.gami.recientes(id);
  }
}
