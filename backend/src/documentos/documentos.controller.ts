import {
  Controller, Get, Param, Query, Res, ParseIntPipe, NotFoundException, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { access } from 'fs/promises';
import { join, basename } from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { UPLOAD_DIR, PDF_MIME } from '../common/config/upload.config';
import { JwtAuthGuard } from '../common/auth/jwt.guard';

/**
 * Documentos del curso (PDFs subidos por docentes) — vista estudiante (lectura).
 * El binario se sirve por streaming desde un endpoint controlado; el cliente
 * nunca ve la ruta interna del servidor (solo /api/documentos/:id/archivo).
 */
@Controller('documentos')
@UseGuards(JwtAuthGuard)
export class DocumentosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@Query('nivel') nivel?: string, @Query('q') q?: string) {
    const where: Prisma.DocumentoWhereInput = {
      ...(nivel ? { nivel: { numero: Number(nivel) } } : {}),
      ...(q ? { titulo: { contains: q, mode: 'insensitive' } } : {}),
    };
    const docs = await this.prisma.documento.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      include: { subidoPor: { select: { nombre: true } }, nivel: { select: { numero: true, titulo: true } } },
    });
    return {
      documentos: docs.map((d) => ({
        id: d.id, titulo: d.titulo, descripcion: d.descripcion,
        archivo: `/api/documentos/${d.id}/archivo`, // URL de stream, no la ruta física
        tamano_bytes: d.tamanoBytes, nivel: d.nivel?.titulo ?? null,
        subido_por: d.subidoPor.nombre, fecha: d.creadoEn,
      })),
    };
  }

  // Sirve el PDF por streaming (inline). Accesible a cualquier usuario autenticado.
  @Get(':id/archivo')
  async archivo(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const doc = await this.prisma.documento.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    // basename evita cualquier path traversal por más que el registro se altere.
    const ruta = join(UPLOAD_DIR, basename(doc.archivo));
    await access(ruta).catch(() => { throw new NotFoundException('Archivo no disponible'); });

    const nombreDescarga = `${doc.titulo.replace(/[^\w\-. ]+/g, '_')}.pdf`;
    res.setHeader('Content-Type', PDF_MIME);
    res.setHeader('Content-Disposition', `inline; filename="${nombreDescarga}"`);
    createReadStream(ruta).pipe(res);
  }
}
