import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RankingService, Ambito, Periodo } from './ranking.service';

/**
 * RANKING del estudiante. Todo el cálculo (posiciones, XP del periodo, movimiento
 * y rango cruzado) vive en el BACKEND; el cliente solo pinta lo que recibe.
 *
 * `ambito=paralelo` filtra por el paralelo del PROPIO usuario y no devuelve el
 * paralelo de nadie: los grupos del estudio se asignan por paralelo completo, así
 * que etiquetarlos permitiría deducirlos (ver la nota en RankingService).
 */
@Controller('ranking')
@UseGuards(JwtAuthGuard)
export class RankingController {
  constructor(private readonly ranking: RankingService) {}

  @Get()
  async tabla(
    @CurrentUser('sub') usuarioId: number,
    @Query('ambito') ambito?: string,
    @Query('periodo') periodo?: string,
    @Query('limite') limite?: string,
  ) {
    return this.ranking.tabla(usuarioId, {
      ambito: ambito as Ambito,
      periodo: periodo as Periodo,
      limite: Number(limite) || 20,
    });
  }
}
