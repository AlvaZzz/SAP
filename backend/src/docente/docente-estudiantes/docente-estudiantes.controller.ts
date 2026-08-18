import { Controller, Get, Put, Param, Body, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { DocenteEstudiantesService } from './docente-estudiantes.service';
import { DocenteRiesgoService } from './docente-riesgo.service';
import { NotaDto } from './dto/nota.dto';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('docente/estudiantes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteEstudiantesController {
  constructor(
    private readonly service: DocenteEstudiantesService,
    private readonly riesgo: DocenteRiesgoService,
  ) {}

  /** Estudiantes en riesgo, con TODOS sus motivos y los umbrales a la vista. */
  @Get('riesgo')
  async enRiesgo() {
    return this.riesgo.listar();
  }

  /**
   * Lista paginada. `pagina` arranca en 1; `porPagina` se acota a 200 para que
   * nadie pueda pedir la tabla entera con `?porPagina=99999` y anular la
   * paginación desde el cliente.
   */
  @Get()
  async listar(
    @Query('pagina') pagina?: string,
    @Query('porPagina') porPagina?: string,
  ) {
    const p = Math.max(1, Number(pagina) || 1);
    const pp = Math.min(200, Math.max(1, Number(porPagina) || 50));
    return this.service.listar(p, pp);
  }

  @Get(':id')
  async detalle(@CurrentUser('sub') docenteId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.detalle(id, docenteId);
  }

  @Put(':id/nota')
  async nota(@CurrentUser('sub') docenteId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: NotaDto) {
    return this.service.guardarNota(id, docenteId, dto.texto);
  }
}
