import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { nivelLegadoId } from '../../common/niveles/nivel-legado';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';
import { GenerarPreguntasDto, EditarPreguntaIaDto, AprobarPreguntaIaDto } from './dto/pregunta-ia.dto';
import { nivelDesdeEstrellas } from '../../common/niveles/nivel-dificultad';
import { dificultadDesdeEstrellas } from '../../mediciones/irt/irt';
import { PREGUNTAS_POR_EVALUACION } from '../../common/niveles/reglas-evaluacion';

/** Cada pregunta del examen de unidad combina entre 2 y 3 temas o subtemas. */
export const TEMAS_POR_PREGUNTA_MIN = 2;
export const TEMAS_POR_PREGUNTA_MAX = 3;

/** Estrellas y XP con que se publica una pregunta según el nivel con que se generó. */
const PUBLICACION: Record<NivelDificultad, { estrellas: number; xp: number }> = {
  basico: { estrellas: 2, xp: 10 },
  intermedio: { estrellas: 3, xp: 15 },
  avanzado: { estrellas: 4, xp: 20 },
};

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

  private async propia(id: number, autorId: number) {
    const p = await this.prisma.preguntaGenerada.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Pregunta no encontrada');
    if (p.autorId !== autorId) throw new ForbiddenException('No puedes gestionar preguntas generadas por otro docente');
    return p;
  }

  /**
   * Pide a PREXI proponer preguntas BORRADOR para un tema (práctica) o para el
   * examen de una unidad (integradoras). El material —PDF o texto— es opcional.
   */
  async generar(autorId: number, dto: GenerarPreguntasDto) {
    if (!dto.temaId && !dto.unidadId) throw new BadRequestException('Indica el tema o la unidad para la que generar preguntas');

    let material: string | null = dto.texto?.trim() || null;
    if (dto.documentoId) {
      const doc = await this.prisma.documento.findUnique({ where: { id: dto.documentoId } });
      if (!doc) throw new NotFoundException('Documento no encontrado');
      if (doc.subidoPorId !== autorId) throw new ForbiddenException('No puedes usar documentos de otro docente');
      if (!doc.textoExtraido) {
        throw new BadRequestException('Este PDF no tiene texto extraíble (¿es una imagen escaneada?). Sube un PDF con texto seleccionable o pega el texto.');
      }
      material = doc.textoExtraido;
    }

    const tipo = dto.tipo ?? 'opcion_multiple';
    const cantidad = dto.cantidad ?? PREGUNTAS_POR_EVALUACION;

    // ── Examen de la unidad: preguntas integradoras de nivel intermedio ──
    if (dto.unidadId) {
      const temas = await this.prisma.tema.findMany({
        where: { unidadId: dto.unidadId },
        orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
        select: { id: true, numero: true, titulo: true },
      });
      if (temas.length < TEMAS_POR_PREGUNTA_MIN) {
        throw new BadRequestException(`La unidad necesita al menos ${TEMAS_POR_PREGUNTA_MIN} temas o subtemas para armar preguntas que los combinen.`);
      }
      const propuestas = await this.tutorIa.generarPreguntas(material, cantidad, tipo, {
        nivel: 'intermedio',
        integrar: temas.map((t) => ({ numero: t.numero, titulo: t.titulo })),
      });
      const porNumero = new Map(temas.map((t) => [t.numero, t.id]));
      const creadas = await this.prisma.preguntaGenerada.createManyAndReturn({
        data: propuestas.map((p, i) => {
          // Temas que PREXI dice haber combinado. Si no declaró al menos dos
          // válidos, se asignan dos consecutivos: el docente los corrige al revisar.
          let ids = [...new Set((p.temas ?? []).map((n) => porNumero.get(n)).filter((x): x is number => x != null))].slice(0, TEMAS_POR_PREGUNTA_MAX);
          if (ids.length < TEMAS_POR_PREGUNTA_MIN) ids = [temas[i % temas.length].id, temas[(i + 1) % temas.length].id];
          return {
            temaId: ids[0], autorId, documentoId: dto.documentoId ?? null, tipo,
            categoria: p.categoria, enunciado: p.enunciado, codigoPython: p.codigoPython,
            opciones: p.opciones as unknown as Prisma.InputJsonValue,
            respuestaCorrecta: p.respuestaCorrecta, explicacionIa: p.explicacionIa,
            banco: 'examen' as const, nivelDificultad: 'intermedio' as const, temasIntegrados: ids,
          };
        }),
      });
      return { generadas: creadas.length, preguntas: creadas };
    }

    // ── Práctica de un tema o subtema ──
    const tema = await this.prisma.tema.findUnique({ where: { id: dto.temaId }, include: { unidad: { select: { titulo: true } } } });
    if (!tema) throw new BadRequestException('El tema seleccionado no existe');
    const nivel = dto.nivel ?? 'basico';
    const propuestas = await this.tutorIa.generarPreguntas(material, cantidad, tipo, {
      nivel,
      tema: `${tema.numero} ${tema.titulo} (unidad «${tema.unidad.titulo}»)${tema.descripcion ? ` — ${tema.descripcion}` : ''}`,
    });
    const creadas = await this.prisma.preguntaGenerada.createManyAndReturn({
      data: propuestas.map((p) => ({
        temaId: tema.id, autorId, documentoId: dto.documentoId ?? null, tipo,
        categoria: p.categoria, enunciado: p.enunciado, codigoPython: p.codigoPython,
        opciones: p.opciones as unknown as Prisma.InputJsonValue,
        respuestaCorrecta: p.respuestaCorrecta, explicacionIa: p.explicacionIa,
        banco: 'practica' as const, nivelDificultad: nivel,
      })),
    });
    return { generadas: creadas.length, preguntas: creadas };
  }

  /** Bandeja de revisión del docente, acotable a un tema o al examen de una unidad. */
  async listar(autorId: number, filtros: { temaId?: number; unidadId?: number; estado?: 'borrador' | 'aprobada' | 'rechazada' } = {}) {
    const preguntas = await this.prisma.preguntaGenerada.findMany({
      where: {
        autorId,
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.unidadId
          ? { banco: 'examen', tema: { unidadId: filtros.unidadId } }
          : filtros.temaId ? { banco: 'practica', temaId: filtros.temaId } : {}),
      },
      orderBy: { creadoEn: 'desc' },
      include: { tema: { select: { numero: true, titulo: true } }, documento: { select: { titulo: true } } },
    });
    const idsIntegrados = [...new Set(preguntas.flatMap((p) => p.temasIntegrados))];
    const nombres = idsIntegrados.length
      ? new Map((await this.prisma.tema.findMany({ where: { id: { in: idsIntegrados } }, select: { id: true, numero: true, titulo: true } }))
          .map((t) => [t.id, `${t.numero} ${t.titulo}`]))
      : new Map<number, string>();
    return preguntas.map((p) => ({
      id: p.id, temaId: p.temaId, tema: `${p.tema.numero} ${p.tema.titulo}`,
      documento: p.documento?.titulo ?? null, tipo: p.tipo, categoria: p.categoria,
      enunciado: p.enunciado, codigoPython: p.codigoPython, opciones: p.opciones,
      respuestaCorrecta: p.respuestaCorrecta, explicacionIa: p.explicacionIa,
      estado: p.estado, fecha: p.creadoEn,
      banco: p.banco, nivel: p.nivelDificultad,
      temas_integrados: p.temasIntegrados.map((id) => ({ id, nombre: nombres.get(id) ?? `Tema ${id}` })),
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
        ...(dto.temasIntegrados !== undefined ? { temasIntegrados: dto.temasIntegrados } : {}),
      },
    });
  }

  /**
   * Aprueba: crea el Ejercicio real en el banco para el que se generó (práctica
   * del tema o examen de la unidad). Nivel y XP salen del nivel pedido al
   * generar, salvo que el docente los cambie.
   */
  async aprobar(id: number, autorId: number, dto: AprobarPreguntaIaDto) {
    const p = await this.propia(id, autorId);
    if (p.estado !== 'borrador') throw new BadRequestException('Esta pregunta ya fue revisada');
    // Vestigio de compatibilidad: `Ejercicio.nivelId` sigue siendo obligatorio.
    const nivelId = await nivelLegadoId(this.prisma);
    const estrellas = dto.estrellas ?? PUBLICACION[p.nivelDificultad].estrellas;
    const xp = dto.xp ?? PUBLICACION[p.nivelDificultad].xp;
    if (p.banco === 'examen' && p.temasIntegrados.length < TEMAS_POR_PREGUNTA_MIN) {
      throw new BadRequestException(`Una pregunta de examen debe combinar al menos ${TEMAS_POR_PREGUNTA_MIN} temas de la unidad.`);
    }

    const ejercicio = await this.prisma.$transaction(async (tx) => {
      const ej = await tx.ejercicio.create({
        data: {
          titulo: p.enunciado.slice(0, 100),
          categoria: p.categoria,
          nivelId,
          temaId: p.temaId,
          estrellas,
          // Clasificación adaptativa y dificultad b (IRT/Rasch) desde las estrellas.
          nivelDificultad: nivelDesdeEstrellas(estrellas),
          dificultadB: dificultadDesdeEstrellas(estrellas),
          tipo: p.tipo,
          enunciado: p.enunciado,
          codigoPython: p.codigoPython,
          opciones: p.opciones as Prisma.InputJsonValue,
          respuestaCorrecta: p.respuestaCorrecta,
          xp,
          explicacionIa: p.explicacionIa,
          banco: p.banco,
          temasIntegrados: p.temasIntegrados,
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
