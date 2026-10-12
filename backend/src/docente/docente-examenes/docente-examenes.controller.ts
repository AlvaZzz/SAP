import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt } from 'class-validator';
import { DocenteExamenesService } from './docente-examenes.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

class HabilitarDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsInt({ each: true })
  ids!: number[];
}

/** Exámenes de unidad: estado por estudiante y habilitación manual del docente. */
@Controller('docente/examenes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteExamenesController {
  constructor(private readonly service: DocenteExamenesService) {}

  @Get()
  resumen(@CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string, @Query('unidadId') unidadId?: string) {
    return this.service.resumen(docenteId, rol, unidadId ? Number(unidadId) : undefined);
  }

  @Post(':unidadId/habilitar')
  habilitar(
    @CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string,
    @Param('unidadId', ParseIntPipe) unidadId: number, @Body() dto: HabilitarDto,
  ) {
    return this.service.habilitar(docenteId, rol, unidadId, dto.ids);
  }

  @Delete(':unidadId/habilitar/:usuarioId')
  retirar(
    @CurrentUser('sub') docenteId: number, @CurrentUser('rol') rol: string,
    @Param('unidadId', ParseIntPipe) unidadId: number, @Param('usuarioId', ParseIntPipe) usuarioId: number,
  ) {
    return this.service.retirar(docenteId, rol, unidadId, usuarioId);
  }
}
