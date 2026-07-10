import {
  Controller, Get, Post, Put, Patch, Param, Body, Query, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { AdminUsuariosService } from './admin-usuarios.service';
import { CrearUsuarioDto, EditarUsuarioDto } from './dto/usuario.dto';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('admin/usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminUsuariosController {
  constructor(private readonly service: AdminUsuariosService) {}

  @Get()
  async listar(@Query('rol') rol?: string, @Query('estado') estado?: string, @Query('q') q?: string) {
    return { usuarios: await this.service.listar({ rol: rol || undefined, estado: estado || undefined, q: q || undefined }) };
  }

  @Post()
  async crear(@CurrentUser('sub') actorId: number, @Body() dto: CrearUsuarioDto) {
    return this.service.crear(actorId, dto);
  }

  @Put(':id')
  async editar(@CurrentUser('sub') actorId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: EditarUsuarioDto) {
    return this.service.editar(actorId, id, dto);
  }

  @Patch(':id/estado')
  async alternar(@CurrentUser('sub') actorId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.alternarActivo(actorId, id);
  }

  @Post(':id/reset-password')
  async reset(@CurrentUser('sub') actorId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.resetPassword(actorId, id);
  }
}
