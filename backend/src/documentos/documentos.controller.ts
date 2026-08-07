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
    // El buscador REAL vive en el cliente (filtra en tiempo real sobre el listado
    // ya cargado). Este `q` se conserva para consumidores directos de la API y
    // cubre los mismos campos que la UI: título, descripción, tema, unidad y docente.
    const termino = q?.trim();
    const where: Prisma.DocumentoWhereInput = {
      ...(nivel ? { nivel: { numero: Number(nivel) } } : {}),
      ...(termino
        ? {
            OR: [
              { titulo: { contains: termino, mode: 'insensitive' } },
              { descripcion: { contains: termino, mode: 'insensitive' } },
              { subidoPor: { nombre: { contains: termino, mode: 'insensitive' } } },
              { tema: { titulo: { contains: termino, mode: 'insensitive' } } },
              { tema: { numero: { contains: termino, mode: 'insensitive' } } },
              { tema: { unidad: { titulo: { contains: termino, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const docs = await this.prisma.documento.findMany({
      where,
      include: {
        subidoPor: { select: { nombre: true } },
        nivel: { select: { numero: true, titulo: true } },
        // Un SUBTEMA es un Tema con `padre`. Por eso el documento apunta siempre a
        // `temaId` y aquí deducimos si ese tema es un tema raíz o un subtema; la
        // unidad se alcanza por la relación en cualquiera de los dos casos.
        tema: {
          select: {
            id: true, numero: true, titulo: true, orden: true,
            unidad: { select: { id: true, numero: true, titulo: true } },
            padre: { select: { id: true, numero: true, titulo: true, orden: true } },
          },
        },
      },
    });

    const salida = docs.map((d) => {
      const esSubtema = !!d.tema?.padre;
      const temaRaiz = esSubtema ? d.tema!.padre! : d.tema ?? null;
      return {
        id: d.id,
        titulo: d.titulo,
        descripcion: d.descripcion,
        archivo: `/api/documentos/${d.id}/archivo`, // URL de stream, no la ruta física
        tamano_bytes: d.tamanoBytes,
        nivel: d.nivel?.titulo ?? null,
        subido_por: d.subidoPor.nombre,
        fecha: d.creadoEn,
        unidad: d.tema ? d.tema.unidad : null,
        tema: temaRaiz ? { id: temaRaiz.id, numero: temaRaiz.numero, titulo: temaRaiz.titulo } : null,
        subtema: esSubtema ? { id: d.tema!.id, numero: d.tema!.numero, titulo: d.tema!.titulo } : null,
        // Claves de ordenamiento/agrupación (no se pintan): mantienen el mismo
        // criterio académico que el resto del sistema.
        _orden: {
          unidad: d.tema?.unidad.numero ?? Number.MAX_SAFE_INTEGER, // sin tema → "General", al final
          tema: (esSubtema ? d.tema!.padre!.orden : d.tema?.orden) ?? 0,
          subtema: esSubtema ? d.tema!.orden : -1, // el tema en sí va antes que sus subtemas
        },
      };
    });

    // UNIDAD → TEMA → SUBTEMA → título. `numero` es texto ("1.10" < "1.9" al
    // comparar como cadena), así que ordenamos por `orden`, que es el campo
    // numérico que ya usa el temario.
    salida.sort((a, b) =>
      a._orden.unidad - b._orden.unidad
      || a._orden.tema - b._orden.tema
      || a._orden.subtema - b._orden.subtema
      || a.titulo.localeCompare(b.titulo, 'es'));

    return { documentos: salida.map(({ _orden, ...d }) => d) };
  }

  /**
   * Sirve el PDF (inline) a cualquier usuario autenticado. El binario vive en la
   * columna `contenido`; se lee del disco solo como RESPALDO, para los
   * documentos subidos antes de que el almacenamiento se moviera a la base.
   */
  @Get(':id/archivo')
  async archivo(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const doc = await this.prisma.documento.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    const nombreDescarga = `${doc.titulo.replace(/[^\w\-. ]+/g, '_')}.pdf`;
    res.setHeader('Content-Type', PDF_MIME);
    res.setHeader('Content-Disposition', `inline; filename="${nombreDescarga}"`);

    if (doc.contenido) {
      res.end(Buffer.from(doc.contenido));
      return;
    }

    // basename evita cualquier path traversal por más que el registro se altere.
    const ruta = join(UPLOAD_DIR, basename(doc.archivo));
    await access(ruta).catch(() => { throw new NotFoundException('Archivo no disponible'); });
    createReadStream(ruta).pipe(res);
  }
}
