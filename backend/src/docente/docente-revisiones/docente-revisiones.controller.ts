import { Controller, Get, Post, Param, Body, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { DocenteRevisionesService } from './docente-revisiones.service';
import { RevisarEntregaDto, SugerirFeedbackDto } from './dto/revision.dto';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

/**
 * Rutas /docente/revisiones — SOLO docente/admin (guard de rol server-side).
 * Lista entregas pendientes, califica con feedback+XP y notifica al estudiante.
 */
@Controller('docente/revisiones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteRevisionesController {
  constructor(private readonly service: DocenteRevisionesService) {}

  @Get()
  async listar(@CurrentUser('sub') autorId: number, @Query('todas') todas?: string) {
    return { entregas: await this.service.listar(autorId, todas !== '1') };
  }

  @Post(':retoId/:estudianteId/sugerir')
  async sugerir(
    @CurrentUser('sub') autorId: number,
    @Param('retoId', ParseIntPipe) retoId: number,
    @Param('estudianteId', ParseIntPipe) estudianteId: number,
    @Body() dto: SugerirFeedbackDto,
  ) {
    return this.service.sugerirFeedback(retoId, estudianteId, autorId, dto.aprobado);
  }

  @Post(':retoId/:estudianteId')
  async revisar(
    @CurrentUser('sub') autorId: number,
    @Param('retoId', ParseIntPipe) retoId: number,
    @Param('estudianteId', ParseIntPipe) estudianteId: number,
    @Body() dto: RevisarEntregaDto,
  ) {
    return this.service.revisar(retoId, estudianteId, autorId, dto);
  }
}
