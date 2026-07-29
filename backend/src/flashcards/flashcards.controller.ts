import { Controller, Get, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { FlashcardsService } from './flashcards.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

/**
 * Endpoints de FLASHCARDS (solo lectura). Autenticado como cualquier vista del
 * estudiante. No registra desempeño ni toca métricas de medición (ver
 * FlashcardsService: frontera con la investigación).
 *
 * El NIVEL no es elegible: el mazo llega estrictamente al nivel del estudiante
 * (no existe parámetro de nivel; se eliminó a propósito).
 */
@Controller('flashcards')
@UseGuards(JwtAuthGuard)
export class FlashcardsController {
  constructor(private readonly flashcards: FlashcardsService) {}

  @Get('tema/:temaId')
  porTema(@CurrentUser('sub') usuarioId: number, @Param('temaId', ParseIntPipe) temaId: number) {
    return this.flashcards.porTema(usuarioId, temaId);
  }

  @Get('unidad/:unidadId')
  porUnidad(@CurrentUser('sub') usuarioId: number, @Param('unidadId', ParseIntPipe) unidadId: number) {
    return this.flashcards.porUnidad(usuarioId, unidadId);
  }

  /** Repaso previo a un examen de unidad (prioriza temas débiles, mazo corto). */
  @Get('examen/:unidadId')
  paraExamen(
    @CurrentUser('sub') usuarioId: number,
    @Param('unidadId', ParseIntPipe) unidadId: number,
    @Query('limit') limit?: string,
  ) {
    return this.flashcards.paraExamen(usuarioId, unidadId, limit ? Number(limit) : undefined);
  }
}
