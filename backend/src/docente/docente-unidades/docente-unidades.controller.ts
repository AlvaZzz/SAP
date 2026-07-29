import {
  Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocenteUnidadesService } from './docente-unidades.service';
import { CrearUnidadDto, EditarUnidadDto, CrearTemaDto, EditarTemaDto } from './dto/unidad.dto';
import { MAX_IMG_BYTES, ArchivoSubido } from '../../common/config/upload.config';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

/** Rutas /docente/unidades — SOLO docente/admin (guard de rol server-side). */
@Controller('docente/unidades')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteUnidadesController {
  constructor(private readonly service: DocenteUnidadesService) {}

  @Get()
  async listar() {
    return { unidades: await this.service.listarUnidades() };
  }

  @Get('temas/opciones')
  async opcionesTema() {
    return { temas: await this.service.opcionesTema() };
  }

  @Post()
  async crearUnidad(@Body() dto: CrearUnidadDto) {
    return { unidad: await this.service.crearUnidad(dto) };
  }

  @Put(':id')
  async editarUnidad(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarUnidadDto) {
    return { unidad: await this.service.editarUnidad(id, dto) };
  }

  @Delete(':id')
  async eliminarUnidad(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarUnidad(id);
  }

  // ── Portada de la unidad ── (subir/reemplazar y quitar)
  @Post(':id/imagen')
  // Buffer en memoria + límite duro de tamaño en el interceptor (defensa extra).
  @UseInterceptors(FileInterceptor('imagen', { limits: { fileSize: MAX_IMG_BYTES } }))
  async subirImagen(@Param('id', ParseIntPipe) id: number, @UploadedFile() imagen?: ArchivoSubido) {
    return this.service.subirImagen(id, imagen);
  }

  @Delete(':id/imagen')
  async eliminarImagen(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarImagen(id);
  }

  @Post(':id/temas')
  async crearTema(@Param('id', ParseIntPipe) unidadId: number, @Body() dto: CrearTemaDto) {
    return { tema: await this.service.crearTema(unidadId, dto) };
  }

  @Put('temas/:id')
  async editarTema(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarTemaDto) {
    return { tema: await this.service.editarTema(id, dto) };
  }

  @Delete('temas/:id')
  async eliminarTema(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminarTema(id);
  }
}
