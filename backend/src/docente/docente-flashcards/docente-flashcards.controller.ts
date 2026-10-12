import { Controller, Get, Post, Put, Delete, Param, Query, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { DocenteFlashcardsService, CrearFlashcardDto, EditarFlashcardDto, GenerarFlashcardsDto } from './docente-flashcards.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';

/** Rutas /docente/flashcards — tarjetas de repaso de un tema. SOLO docente/admin. */
@Controller('docente/flashcards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteFlashcardsController {
  constructor(private readonly service: DocenteFlashcardsService) {}

  @Get()
  listar(@Query('tema', ParseIntPipe) temaId: number) {
    return this.service.listar(temaId);
  }

  @Post()
  crear(@Body() dto: CrearFlashcardDto) {
    return this.service.crear(dto);
  }

  /** Una flashcard por cada ejercicio del tema que aún no tenga la suya. */
  @Post('generar')
  generar(@Body() dto: GenerarFlashcardsDto) {
    return this.service.generar(dto.temaId);
  }

  @Put(':id')
  editar(@Param('id', ParseIntPipe) id: number, @Body() dto: EditarFlashcardDto) {
    return this.service.editar(id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.service.eliminar(id);
  }
}
