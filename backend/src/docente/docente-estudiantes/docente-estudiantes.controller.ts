import { Controller, Get, Put, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
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

  @Get()
  async listar() {
    return { estudiantes: await this.service.listar() };
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
