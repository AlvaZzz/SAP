import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CrearUnidadDto, EditarUnidadDto, CrearTemaDto, EditarTemaDto } from './dto/unidad.dto';

/** Mínimo de ejercicios ACTIVOS que debe tener un tema para poder publicarse. */
export const MIN_EJERCICIOS_TEMA = 10;

/** Mínimo de ítems del banco de diagnóstico para que un tema pueda entrar al pretest. */
export const MIN_ITEMS_DIAGNOSTICO = 3;

interface TemaVista {
  id: number; numero: string; titulo: string; descripcion: string | null; orden: number;
  umbral: number; publicado: boolean; ejercicios_activos: number; ejercicios_minimos: number;
  puede_publicarse: boolean; en_diagnostico: boolean; items_diagnostico: number;
  puede_diagnosticar: boolean; subtemas: TemaVista[];
}

/**
 * Estructura académica real (rol docente): UNIDAD → TEMA → SUBTEMA → ejercicios.
 * Complementa (no reemplaza) los 5 "niveles" de gamificación: un Tema puede
 * vivir sin nivel, y sus ejercicios se resuelven igual vía POST /intentos.
 */
@Injectable()
export class DocenteUnidadesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Unidades ──
  async listarUnidades() {
    const unidades = await this.prisma.unidad.findMany({
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      include: {
        temas: {
          where: { padreId: null },
          orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
          include: {
            _count: { select: { ejercicios: { where: { activo: true } } } },
            subtemas: {
              orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
              include: { _count: { select: { ejercicios: { where: { activo: true } } } } },
            },
          },
        },
      },
    });
    // Conteo de ítems del banco de diagnóstico (banco='pretest') por tema, en una
    // sola consulta (evita N+1); alimenta `items_diagnostico`/`puede_diagnosticar`.
    const diagRaw = await this.prisma.ejercicio.groupBy({
      by: ['temaId'],
      where: { banco: 'pretest', temaId: { not: null } },
      _count: { _all: true },
    });
    const diag = new Map<number, number>();
    for (const d of diagRaw) if (d.temaId != null) diag.set(d.temaId, d._count._all);

    return unidades.map((u) => ({
      id: u.id, numero: u.numero, titulo: u.titulo, descripcion: u.descripcion,
      introduccion: u.introduccion, xp: u.xp, orden: u.orden,
      temas: u.temas.map((t) => this.vistaTema(t, diag)),
    }));
  }

  private vistaTema(t: {
    id: number; numero: string; titulo: string; descripcion: string | null; orden: number;
    umbral: number; publicado: boolean; enDiagnostico: boolean; _count: { ejercicios: number };
    subtemas?: { id: number; numero: string; titulo: string; descripcion: string | null; orden: number; umbral: number; publicado: boolean; enDiagnostico: boolean; _count: { ejercicios: number } }[];
  }, diag: Map<number, number>): TemaVista {
    const items = diag.get(t.id) ?? 0;
    return {
      id: t.id, numero: t.numero, titulo: t.titulo, descripcion: t.descripcion, orden: t.orden,
      umbral: t.umbral, publicado: t.publicado,
      ejercicios_activos: t._count.ejercicios,
      ejercicios_minimos: MIN_EJERCICIOS_TEMA,
      puede_publicarse: t._count.ejercicios >= MIN_EJERCICIOS_TEMA,
      en_diagnostico: t.enDiagnostico,
      items_diagnostico: items,
      puede_diagnosticar: items >= MIN_ITEMS_DIAGNOSTICO,
      subtemas: t.subtemas?.map((s) => this.vistaTema({ ...s, subtemas: undefined }, diag)) ?? [],
    };
  }

  async crearUnidad(dto: CrearUnidadDto) {
    // numero es único por institución; el panel docente opera sobre el plan UPEA.
    const existe = await this.prisma.unidad.findFirst({ where: { numero: dto.numero } });
    if (existe) throw new BadRequestException(`Ya existe la unidad número ${dto.numero}`);
    return this.prisma.unidad.create({
      data: { numero: dto.numero, titulo: dto.titulo, descripcion: dto.descripcion, xp: dto.xp ?? 0, orden: dto.orden ?? dto.numero },
    });
  }

  async editarUnidad(id: number, dto: EditarUnidadDto) {
    const u = await this.prisma.unidad.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Unidad no encontrada');
    if (dto.numero !== undefined && dto.numero !== u.numero) {
      const choque = await this.prisma.unidad.findFirst({ where: { numero: dto.numero } });
      if (choque) throw new BadRequestException(`Ya existe la unidad número ${dto.numero}`);
    }
    return this.prisma.unidad.update({ where: { id }, data: dto });
  }

  async eliminarUnidad(id: number) {
    const conTemas = await this.prisma.tema.count({ where: { unidadId: id } });
    if (conTemas > 0) throw new ConflictException('No puedes eliminar una unidad con temas. Elimina primero sus temas.');
    await this.prisma.unidad.delete({ where: { id } });
    return { ok: true };
  }

  // ── Temas / Subtemas ──
  private async temaConHijos(temaId: number) {
    const t = await this.prisma.tema.findUnique({ where: { id: temaId } });
    if (!t) throw new NotFoundException('Tema no encontrado');
    return t;
  }

  async crearTema(unidadId: number, dto: CrearTemaDto) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id: unidadId } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    if (dto.padreId) {
      const padre = await this.temaConHijos(dto.padreId);
      if (padre.unidadId !== unidadId) throw new BadRequestException('El tema padre pertenece a otra unidad');
      if (padre.padreId) throw new BadRequestException('Un subtema no puede tener a su vez subtemas (un solo nivel de profundidad)');
    }
    return this.prisma.tema.create({
      data: {
        unidadId, padreId: dto.padreId ?? null, numero: dto.numero, titulo: dto.titulo,
        descripcion: dto.descripcion, umbral: dto.umbral ?? MIN_EJERCICIOS_TEMA, orden: dto.orden ?? 0,
      },
    });
  }

  async editarTema(id: number, dto: EditarTemaDto) {
    const t = await this.temaConHijos(id);
    if (dto.publicado === true && !t.publicado) {
      const activos = await this.prisma.ejercicio.count({ where: { temaId: id, activo: true } });
      if (activos < MIN_EJERCICIOS_TEMA) {
        throw new BadRequestException(`Este tema tiene ${activos}/${MIN_EJERCICIOS_TEMA} ejercicios mínimos. Agrega más para publicarlo.`);
      }
    }
    // Para entrar al diagnóstico, el tema debe tener un banco de diagnóstico suficiente.
    if (dto.enDiagnostico === true && !t.enDiagnostico) {
      const items = await this.prisma.ejercicio.count({ where: { temaId: id, banco: 'pretest' } });
      if (items < MIN_ITEMS_DIAGNOSTICO) {
        throw new BadRequestException(`Este tema tiene ${items}/${MIN_ITEMS_DIAGNOSTICO} preguntas de diagnóstico. Necesita al menos ${MIN_ITEMS_DIAGNOSTICO} para el pretest.`);
      }
    }
    return this.prisma.tema.update({ where: { id }, data: dto });
  }

  async eliminarTema(id: number) {
    const conSubtemas = await this.prisma.tema.count({ where: { padreId: id } });
    if (conSubtemas > 0) throw new ConflictException('No puedes eliminar un tema con subtemas. Elimina primero los subtemas.');
    await this.prisma.tema.delete({ where: { id } });
    return { ok: true };
  }

  /** Lista simplificada de temas/subtemas (para selects: crear ejercicio, subir documento…). */
  async opcionesTema() {
    const temas = await this.prisma.tema.findMany({
      orderBy: [{ unidadId: 'asc' }, { orden: 'asc' }],
      include: { unidad: { select: { numero: true, titulo: true } }, padre: { select: { numero: true, titulo: true } } },
    });
    return temas.map((t) => ({
      id: t.id,
      etiqueta: `U${t.unidad.numero} · ${t.numero} ${t.titulo}${t.padre ? ` (subtema de ${t.padre.numero})` : ''}`,
      publicado: t.publicado,
    }));
  }
}
