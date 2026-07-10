import {
  Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocenteDocumentosService } from './docente-documentos.service';
import { CrearDocumentoDto, EditarDocumentoDto } from './dto/documento.dto';
import { MAX_PDF_BYTES, ArchivoSubido } from '../../common/config/upload.config';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { RolesGuard, Roles } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('docente/documentos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('docente', 'admin')
export class DocenteDocumentosController {
  constructor(private readonly service: DocenteDocumentosService) {}

  @Get()
  async listar(@CurrentUser('sub') autorId: number) {
    return { documentos: await this.service.listar(autorId) };
  }

  @Post()
  // Almacenamiento en memoria (buffer) + límite duro de tamaño en el interceptor.
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: MAX_PDF_BYTES } }))
  async subir(
    @CurrentUser('sub') autorId: number,
    @Body() dto: CrearDocumentoDto,
    @UploadedFile() archivo?: ArchivoSubido,
  ) {
    return this.service.subir(autorId, dto, archivo);
  }

  @Put(':id')
  async editar(@CurrentUser('sub') autorId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: EditarDocumentoDto) {
    return this.service.editar(id, autorId, dto);
  }

  @Delete(':id')
  async eliminar(@CurrentUser('sub') autorId: number, @Param('id', ParseIntPipe) id: number) {
    return this.service.eliminar(id, autorId);
  }
}
