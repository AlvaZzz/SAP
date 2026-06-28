import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';

/**
 * Documentos del curso (PDFs subidos por docentes) — vista estudiante (lectura).
 * La subida la hará el rol docente (módulo posterior).
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
        id: d.id, titulo: d.titulo, descripcion: d.descripcion, archivo: d.archivo,
        tamano_bytes: d.tamanoBytes, nivel: d.nivel?.titulo ?? null,
        subido_por: d.subidoPor.nombre, fecha: d.creadoEn,
      })),
    };
  }
}
