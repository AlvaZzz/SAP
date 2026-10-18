import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AdminCursosService } from './admin-cursos.service';
import { AsignarDocenteDto, CrearMateriaDto, CrearParaleloDto } from './dto/cursos.dto';

@Controller('admin/cursos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminCursosController {
  constructor(private readonly service: AdminCursosService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Put('paralelos/:id/docente')
  asignar(@CurrentUser('sub') actorId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: AsignarDocenteDto) {
    return this.service.asignarDocente(actorId, id, dto.docenteId ?? null);
  }

  @Post('materias')
  crearMateria(@CurrentUser('sub') actorId: number, @Body() dto: CrearMateriaDto) {
    return this.service.crearMateria(actorId, dto);
  }

  @Post('paralelos')
  crearParalelo(@CurrentUser('sub') actorId: number, @Body() dto: CrearParaleloDto) {
    return this.service.crearParalelo(actorId, dto);
  }
}
