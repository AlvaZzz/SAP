import { Body, Controller, Get, Param, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { MomentoEncuesta } from '@prisma/client';
import { EncuestaService } from './encuesta.service';
import { ResponderEncuestaDto } from './dto/encuesta.dto';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

/** Encuesta de motivación académica (instrumento de la variable dependiente). */
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
  cuestionario(@CurrentUser('sub') usuarioId: number, @Param('momento') momento: string) {
    return this.service.cuestionario(usuarioId, this.momento(momento));
  }

  @Post(':momento')
  responder(
    @CurrentUser('sub') usuarioId: number,
    @Param('momento') momento: string,
    @Body() dto: ResponderEncuestaDto,
  ) {
    return this.service.responder(usuarioId, this.momento(momento), dto.respuestas);
  }
}
