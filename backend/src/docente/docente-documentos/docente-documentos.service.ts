import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  UPLOAD_DIR, MAX_PDF_BYTES, PDF_MIME, PDF_MAGIC, ArchivoSubido,
} from '../../common/config/upload.config';
import { extraerTextoPdf } from '../../common/pdf/pdf-texto';
import { CrearDocumentoDto, EditarDocumentoDto } from './dto/documento.dto';

/**
 * Gestión de documentos (rol docente): subir/listar/editar/eliminar PDFs.
 * Cada docente solo administra los suyos (autor validado contra el JWT).
 * El archivo físico se guarda con un nombre opaco (UUID) fuera del alcance del
 * cliente; la ruta interna NUNCA se expone.
 */
@Injectable()
export class DocenteDocumentosService {
  constructor(private readonly prisma: PrismaService) {}

  private async nivelId(numero?: number): Promise<number | null> {
    if (!numero) return null;
    const nivel = await this.prisma.nivel.findUnique({ where: { numero } });
    if (!nivel) throw new BadRequestException(`No existe el nivel ${numero}`);
    return nivel.id;
  }

  /** El tema (o subtema) asociado debe existir: de él cuelga la unidad con la
   *  que se agrupa el material en la vista del estudiante. */
  private async validarTema(temaId?: number) {
    if (!temaId) return;
    const tema = await this.prisma.tema.findUnique({ where: { id: temaId } });
    if (!tema) throw new BadRequestException('El tema seleccionado no existe');
  }

  /** Valida el PDF (tipo declarado, firma binaria y tamaño). */
  private validarPdf(archivo?: ArchivoSubido) {
    if (!archivo) throw new BadRequestException('Falta el archivo PDF');
    if (archivo.mimetype !== PDF_MIME) throw new BadRequestException('Solo se aceptan archivos PDF');
    if (archivo.size > MAX_PDF_BYTES) {
      throw new BadRequestException(`El PDF supera el límite de ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB`);
    }
    if (!archivo.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      throw new BadRequestException('El archivo no es un PDF válido');
    }
  }

  async listar(autorId: number) {
    const docs = await this.prisma.documento.findMany({
      where: { subidoPorId: autorId },
      orderBy: { creadoEn: 'desc' },
      include: { nivel: { select: { numero: true, titulo: true } }, tema: { select: { numero: true, titulo: true } } },
    });
    return docs.map((d) => ({
      id: d.id, titulo: d.titulo, descripcion: d.descripcion,
      tamano_bytes: d.tamanoBytes, nivel: d.nivel?.numero ?? null,
      nivel_titulo: d.nivel?.titulo ?? null,
      temaId: d.temaId, tema_titulo: d.tema ? `${d.tema.numero} ${d.tema.titulo}` : null,
      tiene_texto: !!d.textoExtraido,
      fecha: d.creadoEn,
    }));
  }

  async subir(autorId: number, dto: CrearDocumentoDto, archivo?: ArchivoSubido) {
    this.validarPdf(archivo);
    const nivelId = await this.nivelId(dto.nivel);
    await this.validarTema(dto.temaId);

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const nombreArchivo = `${randomUUID()}.pdf`;
    await fs.writeFile(join(UPLOAD_DIR, nombreArchivo), archivo!.buffer);

    // Extracción de texto best-effort (para ALVARO y la generación de preguntas).
    // Nunca bloquea la subida si el PDF no tiene texto extraíble (ej. escaneado).
    const textoExtraido = await extraerTextoPdf(archivo!.buffer);

    const doc = await this.prisma.documento.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion ?? null,
        archivo: nombreArchivo, // solo el nombre opaco, nunca la ruta absoluta
        tamanoBytes: archivo!.size,
        nivelId,
        temaId: dto.temaId ?? null,
        textoExtraido: textoExtraido || null,
        subidoPorId: autorId,
      },
    });
    return { id: doc.id, texto_extraido: !!textoExtraido };
  }

  private async propio(id: number, autorId: number) {
    const d = await this.prisma.documento.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Documento no encontrado');
    if (d.subidoPorId !== autorId) throw new ForbiddenException('No puedes gestionar documentos de otro docente');
    return d;
  }

  async editar(id: number, autorId: number, dto: EditarDocumentoDto) {
    await this.propio(id, autorId);
    const nivelId = dto.nivel !== undefined ? await this.nivelId(dto.nivel) : undefined;
    // `null` explícito = DESASIGNAR (el documento pasa a "General / Sin categoría");
    // `undefined` = no tocar el campo.
    await this.validarTema(dto.temaId ?? undefined);
    await this.prisma.documento.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
        ...(nivelId !== undefined ? { nivelId } : {}),
        ...(dto.temaId !== undefined ? { temaId: dto.temaId } : {}),
      },
    });
    return { ok: true };
  }

  async eliminar(id: number, autorId: number) {
    const d = await this.propio(id, autorId);
    // Borra el binario del disco (best-effort) y luego el registro.
    await fs.unlink(join(UPLOAD_DIR, basename(d.archivo))).catch(() => undefined);
    await this.prisma.documento.delete({ where: { id } });
    return { ok: true };
  }
}
