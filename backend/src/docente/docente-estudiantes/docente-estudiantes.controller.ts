import { Controller, Get, Put, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { DocenteEstudiantesService } from './docente-estudiantes.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

class NotaDto {
  @IsString() @MaxLength(2000)
  texto!: string;
}

/** Seguimiento de los estudiantes de los paralelos del docente. */
@Controller('docente/estudiantes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteEstudiantesController {
  constructor(private readonly service: DocenteEstudiantesService) {}

  /** Todos los estudiantes del docente con nivel, promedio y estado. */
  @Get()
  listar(@CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string) {
    return this.service.listar(docenteId, rol);
  }

  /** Ficha completa de un estudiante. */
  @Get(':id')
  detalle(@CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.detalle(id, docenteId, rol);
  }

  @Put(':id/nota')
  nota(
    @CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string,
    @Param('id', ParseIntPipe) id: number, @Body() dto: NotaDto,
  ) {
    return this.service.guardarNota(id, docenteId, rol, dto.texto);
  }
}
