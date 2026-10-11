import { Body, Controller, Get, Param, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { MomentoEncuesta } from '@prisma/client';
import { EncuestaService } from './encuesta.service';
import { ResponderEncuestaDto } from './dto/encuesta.dto';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

/**
 * Encuesta de motivación académica (MSLQ).
 *
 * FUNCIONALIDAD DEL SISTEMA NO EMPLEADA EN ESTA INVESTIGACIÓN: la motivación no
 * es una variable de la tesis (diseño no experimental transversal). El código
 * del instrumento se conserva, pero queda APAGADO por configuración
 * (ConfiguracionSistema.encuestaMotivacionActiva = false) y sin pantalla en el
 * frontend. Ver docs/INSTRUMENTO_MOTIVACION.md.
 */
@Controller('encuesta')
@UseGuards(JwtAuthGuard)
export class EncuestaController {
  constructor(private readonly service: EncuestaService) {}

  private momento(valor: string): MomentoEncuesta {
    if (valor !== 'pre' && valor !== 'post') {
      throw new BadRequestException('El momento debe ser "pre" o "post".');
    }
    return valor;
  }

  /** Metadatos del instrumento (subescalas, escala, referencia). */
  @Get('info')
  info() {
    return this.service.info();
  }

  /** ¿Le toca responderla? Lo consulta el gate de la interfaz. */
  @Get('estado')
  estado(@CurrentUser('sub') usuarioId: number) {
    return this.service.estado(usuarioId);
  }

  @Get(':momento')
  async cuestionario(@CurrentUser('sub') usuarioId: number, @Param('momento') momento: string) {
    await this.service.exigirActiva();
    return this.service.cuestionario(usuarioId, this.momento(momento));
  }

  @Post(':momento')
  async responder(
    @CurrentUser('sub') usuarioId: number,
    @Param('momento') momento: string,
    @Body() dto: ResponderEncuestaDto,
  ) {
    await this.service.exigirActiva();
    return this.service.responder(usuarioId, this.momento(momento), dto.respuestas);
  }
}
