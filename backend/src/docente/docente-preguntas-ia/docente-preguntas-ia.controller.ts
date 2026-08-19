import { Controller, Get, Post, Put, Param, Query, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { DocentePreguntasIaService } from './docente-preguntas-ia.service';
import { GenerarPreguntasDto, EditarPreguntaIaDto, AprobarPreguntaIaDto } from './dto/pregunta-ia.dto';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

/**
 * Rutas /docente/preguntas-ia — bandeja de preguntas propuestas por ALVARO
 * desde un PDF. SOLO docente/admin. Nada se publica sin @Post(':id/aprobar').
 */
@Controller('docente/preguntas-ia')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocentePreguntasIaController {
  constructor(private readonly service: DocentePreguntasIaService) {}

  @Get()
  async listar(
    @CurrentUser('sub') autorId: number,
    @Query('tema') tema?: string,
    @Query('estado') estado?: 'borrador' | 'aprobada' | 'rechazada',
  ) {
    return { preguntas: await this.service.listar(autorId, tema ? Number(tema) : undefined, estado) };
  }

  // TODO: REVISAR_ANTES_DE_ELIMINAR — el panel de Pendientes calcula su propio conteo; esta ruta quedó sin consumidor.
  @Get('pendientes/conteo')
  async conteoPendientes(@CurrentUser('sub') autorId: number) {
    return { pendientes: await this.service.conteoPendientes(autorId) };
  }

  @Post('generar')
  async generar(@CurrentUser('sub') autorId: number, @Body() dto: GenerarPreguntasDto) {
    return this.service.generar(autorId, dto);
  }

  @Put(':id')
  async editar(@CurrentUser('sub') autorId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: EditarPreguntaIaDto) {
    return this.service.editar(id, autorId, dto);
  }

  @Post(':id/aprobar')
  async aprobar(@CurrentUser('sub') autorId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: AprobarPreguntaIaDto) {
    return this.service.aprobar(id, autorId, dto);
  }

  @Post(':id/rechazar')
  async rechazar(@CurrentUser('sub') autorId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.rechazar(id, autorId);
  }
}
