import {
  Controller, Get, Param, ParseIntPipe, Res, NotFoundException, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { access } from 'fs/promises';
import { join, basename, extname } from 'path';
import { UnidadesService } from './unidades.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UPLOAD_IMG_DIR } from '../../common/config/upload.config';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

const MIME_POR_EXT: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

@Controller('unidades')
@UseGuards(JwtAuthGuard)
export class UnidadesController {
  constructor(
    private readonly unidades: UnidadesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async listar(@CurrentUser('sub') usuarioId: number) {
    return { unidades: await this.unidades.listar(usuarioId) };
  }

  /** Dashboard de Destino (Preview de Unidad): objetivos, mapa, analogías, ejemplos. */
  @Get(':id/dashboard')
  async dashboard(@CurrentUser('sub') usuarioId: number, @Param('id', ParseIntPipe) id: number) {
    return this.unidades.dashboard(usuarioId, id);
  }

  /**
   * Sirve la imagen de PORTADA por streaming (inline). El cliente solo conoce
   * esta URL, nunca la ruta física; `basename` evita cualquier path traversal.
   */
  @Get(':id/portada')
  async portada(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id }, select: { imagenUrl: true } });
    if (!unidad?.imagenUrl) throw new NotFoundException('La unidad no tiene portada');

    const ruta = join(UPLOAD_IMG_DIR, basename(unidad.imagenUrl));
    await access(ruta).catch(() => { throw new NotFoundException('Imagen no disponible'); });

    res.setHeader('Content-Type', MIME_POR_EXT[extname(unidad.imagenUrl).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    createReadStream(ruta).pipe(res);
  }
}
