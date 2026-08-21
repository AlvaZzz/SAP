import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';
import { GenerarPreguntasDto, EditarPreguntaIaDto, AprobarPreguntaIaDto } from './dto/pregunta-ia.dto';
import { nivelDesdeEstrellas } from '../../common/niveles/nivel-dificultad';
import { dificultadDesdeEstrellas } from '../../mediciones/irt/irt';

/**
 * Generación asistida de preguntas desde un PDF (PREXI/Gemini) + bandeja de
 * revisión del docente. CRÍTICO: nada de lo que genera la IA se publica solo;
 * siempre queda como PreguntaGenerada(estado=borrador) hasta que el docente la
 * edita/corrige y la aprueba explícitamente (entonces se crea el Ejercicio real).
 */
@Injectable()
export class DocentePreguntasIaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tutorIa: TutorIaService,
  ) {}

  private async nivelId(numero: number): Promise<number> {
    const nivel = await this.prisma.nivel.findUnique({ where: { numero } });
    if (!nivel) throw new BadRequestException(`No existe el nivel ${numero}`);
    return nivel.id;
  }

  private async propia(id: number, autorId: number) {
    const p = await this.prisma.preguntaGenerada.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Pregunta no encontrada');
    if (p.autorId !== autorId) throw new ForbiddenException('No puedes gestionar preguntas generadas por otro docente');
    return p;
  }

  /** Pide a PREXI proponer N preguntas BORRADOR desde el texto ya extraído del PDF. */
  async generar(autorId: number, dto: GenerarPreguntasDto) {
    const doc = await this.prisma.documento.findUnique({ where: { id: dto.documentoId } });
    if (!doc) throw new NotFoundException('Documento no encontrado');
    if (doc.subidoPorId !== autorId) throw new ForbiddenException('No puedes usar documentos de otro docente');
    if (!doc.textoExtraido) {
      throw new BadRequestException('Este PDF no tiene texto extraíble (¿es una imagen escaneada?). Sube un PDF con texto seleccionable.');
    }
    const tema = await this.prisma.tema.findUnique({ where: { id: dto.temaId } });
    if (!tema) throw new BadRequestException('El tema seleccionado no existe');

    const tipo = dto.tipo ?? 'opcion_multiple';
    const cantidad = dto.cantidad ?? 5;
    const propuestas = await this.tutorIa.generarPreguntas(doc.textoExtraido, cantidad, tipo);

    const creadas = await this.prisma.preguntaGenerada.createManyAndReturn({
      data: propuestas.map((p) => ({
        temaId: dto.temaId,
        autorId,
        documentoId: dto.documentoId,
        tipo,
        categoria: p.categoria,
        enunciado: p.enunciado,
        codigoPython: p.codigoPython,
        opciones: p.opciones as unknown as Prisma.InputJsonValue,
        respuestaCorrecta: p.respuestaCorrecta,
        explicacionIa: p.explicacionIa,
      })),
    });
    return { generadas: creadas.length, preguntas: creadas };
  }

  /** Bandeja de revisión: borradores (y opcionalmente ya decididas) del docente. */
  async listar(autorId: number, temaId?: number, estado?: 'borrador' | 'aprobada' | 'rechazada') {
    const preguntas = await this.prisma.preguntaGenerada.findMany({
      where: { autorId, ...(temaId ? { temaId } : {}), ...(estado ? { estado } : {}) },
      orderBy: { creadoEn: 'desc' },
      include: { tema: { select: { numero: true, titulo: true } }, documento: { select: { titulo: true } } },
    });
    return preguntas.map((p) => ({
      id: p.id, temaId: p.temaId, tema: `${p.tema.numero} ${p.tema.titulo}`,
      documento: p.documento?.titulo ?? null, tipo: p.tipo, categoria: p.categoria,
      enunciado: p.enunciado, codigoPython: p.codigoPython, opciones: p.opciones,
      respuestaCorrecta: p.respuestaCorrecta, explicacionIa: p.explicacionIa,
      estado: p.estado, fecha: p.creadoEn,
    }));
  }

  /** Conteo de borradores pendientes (para la campana/pendientes del docente). */
  async conteoPendientes(autorId: number): Promise<number> {
    return this.prisma.preguntaGenerada.count({ where: { autorId, estado: 'borrador' } });
  }

  /** El docente corrige el borrador (enunciado, opciones, respuesta, etc.) antes de aprobar. */
  async editar(id: number, autorId: number, dto: EditarPreguntaIaDto) {
    const p = await this.propia(id, autorId);
    if (p.estado !== 'borrador') throw new BadRequestException('Solo se pueden editar preguntas en borrador');
    return this.prisma.preguntaGenerada.update({
      where: { id },
      data: {
        ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
        ...(dto.enunciado !== undefined ? { enunciado: dto.enunciado } : {}),
        ...(dto.codigoPython !== undefined ? { codigoPython: dto.codigoPython } : {}),
        ...(dto.opciones !== undefined ? { opciones: dto.opciones as unknown as Prisma.InputJsonValue } : {}),
        ...(dto.respuestaCorrecta !== undefined ? { respuestaCorrecta: dto.respuestaCorrecta } : {}),
        ...(dto.explicacionIa !== undefined ? { explicacionIa: dto.explicacionIa } : {}),
      },
    });
  }

  /** Aprueba: crea el Ejercicio real (banco=practica) con el nivel/XP que decide el docente. */
  async aprobar(id: number, autorId: number, dto: AprobarPreguntaIaDto) {
    const p = await this.propia(id, autorId);
    if (p.estado !== 'borrador') throw new BadRequestException('Esta pregunta ya fue revisada');
    const nivelId = await this.nivelId(dto.nivel);

    const ejercicio = await this.prisma.$transaction(async (tx) => {
      const ej = await tx.ejercicio.create({
        data: {
          titulo: p.enunciado.slice(0, 100),
          categoria: p.categoria,
          nivelId,
          temaId: p.temaId,
          estrellas: dto.estrellas,
          // Clasificación adaptativa y dificultad b (IRT/Rasch) desde las estrellas.
          nivelDificultad: nivelDesdeEstrellas(dto.estrellas),
          dificultadB: dificultadDesdeEstrellas(dto.estrellas),
          tipo: p.tipo,
          enunciado: p.enunciado,
          codigoPython: p.codigoPython,
          opciones: p.opciones as Prisma.InputJsonValue,
          respuestaCorrecta: p.respuestaCorrecta,
          xp: dto.xp,
          explicacionIa: p.explicacionIa,
          banco: 'practica',
          activo: true,
        },
      });
      await tx.preguntaGenerada.update({ where: { id }, data: { estado: 'aprobada', ejercicioId: ej.id } });
      return ej;
    });
    return { ok: true, ejercicioId: ejercicio.id };
  }

  async rechazar(id: number, autorId: number) {
    const p = await this.propia(id, autorId);
    if (p.estado !== 'borrador') throw new BadRequestException('Esta pregunta ya fue revisada');
    await this.prisma.preguntaGenerada.update({ where: { id }, data: { estado: 'rechazada' } });
    return { ok: true };
  }
}
