import {
  Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, ParseIntPipe, UseGuards,
} from '@nestjs/common';
import { DocenteEjerciciosService } from './docente-ejercicios.service';
import { CrearEjercicioDto, EditarEjercicioDto, BANCOS_DOCENTE } from './dto/ejercicio.dto';
import { Banco } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

/**
 * Rutas /docente/ejercicios — SOLO docente/admin (guard de rol server-side).
 * Un estudiante que conozca la URL recibe 403.
 */
@Controller('docente/ejercicios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteEjerciciosController {
  constructor(private readonly service: DocenteEjerciciosService) {}

  /** Normaliza el query `banco` a uno gestionable (practica | examen). */
  private banco(b?: string): Banco | undefined {
    return b && (BANCOS_DOCENTE as string[]).includes(b) ? (b as Banco) : undefined;
  }

  @Get()
  async listar(
    @Query('nivel') nivel?: string,
    @Query('categoria') categoria?: string,
    @Query('dificultad') dificultad?: string,
    @Query('tema') tema?: string,
    @Query('banco') banco?: string,
  ) {
    const ejercicios = await this.service.listar({
      nivel: nivel ? Number(nivel) : undefined,
      categoria: categoria || undefined,
      dificultad: dificultad ? Number(dificultad) : undefined,
      temaId: tema ? Number(tema) : undefined,
      banco: this.banco(banco),
    });
    return { ejercicios };
  }

  @Get('categorias')
  async categorias(@Query('banco') banco?: string) {
    return { categorias: await this.service.categorias(this.banco(banco)) };
  }

  @Get(':id')
  async detalle(@Param('id', ParseIntPipe) id: number) {
    return { ejercicio: await this.service.detalle(id) };
  }

  @Post()
  async crear(@Body() dto: CrearEjercicioDto) {
    return { ejercicio: await this.service.crear(dto) };
  }

  @Put(':id')
  async editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarEjercicioDto) {
    return { ejercicio: await this.service.editar(id, dto) };
  }

  @Patch(':id/activo')
  async alternar(@Param('id', ParseIntPipe) id: number) {
    return { ejercicio: await this.service.alternarActivo(id) };
  }

  @Delete(':id')
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminar(id);
  }
}
