import { Controller, Get, Post, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private readonly service: NotificacionesService) {}

  @Get()
  listar(@CurrentUser('sub') usuarioId: number) {
    return this.service.listar(usuarioId);
  }

  // TODO: REVISAR_ANTES_DE_ELIMINAR — la campana usa /notificaciones y cuenta en el cliente; este conteo no lo llama nadie.
  @Get('conteo')
  conteo(@CurrentUser('sub') usuarioId: number) {
    return this.service.conteoNoLeidas(usuarioId);
  }

  @Post(':id/leer')
  leer(@CurrentUser('sub') usuarioId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.marcarLeida(usuarioId, id);
  }

  @Post('leer-todas')
  leerTodas(@CurrentUser('sub') usuarioId: number) {
    return this.service.marcarTodas(usuarioId);
  }
}
