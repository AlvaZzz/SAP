import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { IsOptional, IsBoolean } from 'class-validator';
import { DocenteRetosService } from './docente-retos.service';
import { CrearRetoDto, EditarRetoDto } from './dto/reto.dto';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

class ConfigRetosDto {
  /** Interruptor único del módulo Retos (el nivel lo decide el motor adaptativo). */
  @IsOptional() @IsBoolean() habilitado?: boolean;
  // Compat con la interfaz anterior (habilitación por nivel). Ya no gobiernan.
  @IsOptional() @IsBoolean() intermedio?: boolean;
  @IsOptional() @IsBoolean() avanzado?: boolean;
}

@Controller('docente/retos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteRetosController {
  constructor(private readonly service: DocenteRetosService) {}

  @Get()
  async listar(@CurrentUser('sub') autorId: number) {
    return { retos: await this.service.listar(autorId) };
  }

  /** Habilitación de retos por nivel (Intermedio / Avanzado). */
  @Get('config')
  async configuracion() {
    return this.service.configuracion();
  }

  @Put('config')
  async actualizarConfig(@Body() dto: ConfigRetosDto) {
    return this.service.actualizarConfiguracion(dto);
  }

  @Post()
  async crear(@CurrentUser('sub') autorId: number, @Body() dto: CrearRetoDto) {
    return this.service.crear(autorId, dto);
  }

  @Put(':id')
  async editar(@CurrentUser('sub') autorId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: EditarRetoDto) {
    return this.service.editar(id, autorId, dto);
  }

  @Patch(':id/activo')
  async alternar(@CurrentUser('sub') autorId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.alternarActivo(id, autorId);
  }

  @Delete(':id')
  async eliminar(@CurrentUser('sub') autorId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.eliminar(id, autorId);
  }
}
