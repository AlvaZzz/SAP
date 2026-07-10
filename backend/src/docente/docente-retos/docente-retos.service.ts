import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CrearRetoDto, EditarRetoDto } from './dto/reto.dto';

/**
 * Gestión de retos (rol docente). Cada docente solo administra SUS retos:
 * el autor se valida contra el JWT en editar/eliminar (no confía en el cliente).
 * La REVISIÓN de entregas vive en su propio dominio (docente-revisiones/).
 */
@Injectable()
export class DocenteRetosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Traduce número de nivel (1-5) al id real; null si no se indica. */
  private async nivelId(numero?: number): Promise<number | null> {
    if (numero === undefined || numero === null) return null;
    const nivel = await this.prisma.nivel.findUnique({ where: { numero } });
    if (!nivel) throw new BadRequestException(`No existe el nivel ${numero}`);
    return nivel.id;
  }

  async listar(autorId: number) {
    const retos = await this.prisma.reto.findMany({
      where: { autorId },
      orderBy: { creadoEn: 'desc' },
      include: {
        nivel: { select: { numero: true, titulo: true } },
        _count: { select: { resueltos: { where: { resuelto: true } } } },
      },
    });
    // Conteo de entregas pendientes por reto (para el badge "por revisar").
    const pendientesPorReto = await this.prisma.retoUsuario.groupBy({
      by: ['retoId'],
      where: { estado: 'pendiente_revision', reto: { autorId } },
      _count: { _all: true },
    });
    const pendMap = new Map(pendientesPorReto.map((p) => [p.retoId, p._count._all]));
    return retos.map((r) => ({
      id: r.id, titulo: r.titulo, categoria: r.categoria,
      nivel: r.nivel?.numero ?? null, nivel_titulo: r.nivel?.titulo ?? null,
      estrellas: r.estrellas, tipo: r.tipo, enunciado: r.enunciado, codigoInicial: r.codigoInicial,
      ejemploEntrada: r.ejemploEntrada, ejemploSalida: r.ejemploSalida,
      xp: r.xp, fechaLimite: r.fechaLimite, activo: r.activo,
      resueltos: r._count.resueltos, pendientes: pendMap.get(r.id) ?? 0, creadoEn: r.creadoEn,
    }));
  }

  /** Obtiene un reto verificando que pertenezca al docente. */
  private async propio(id: number, autorId: number) {
    const r = await this.prisma.reto.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Reto no encontrado');
    if (r.autorId !== autorId) throw new ForbiddenException('No puedes gestionar retos de otro docente');
    return r;
  }

  async crear(autorId: number, dto: CrearRetoDto) {
    const r = await this.prisma.reto.create({
      data: {
        titulo: dto.titulo,
        categoria: dto.categoria,
        nivelId: await this.nivelId(dto.nivel),
        estrellas: dto.estrellas,
        tipo: dto.tipo ?? 'completar_codigo',
        enunciado: dto.enunciado,
        codigoInicial: dto.codigoInicial ?? null,
        ejemploEntrada: dto.ejemploEntrada ?? null,
        ejemploSalida: dto.ejemploSalida ?? null,
        xp: dto.xp,
        fechaLimite: dto.fechaLimite ? new Date(dto.fechaLimite) : null,
        activo: dto.activo ?? true,
        autorId,
      },
    });
    return { id: r.id };
  }

  async editar(id: number, autorId: number, dto: EditarRetoDto) {
    await this.propio(id, autorId);
    await this.prisma.reto.update({
      where: { id },
      data: {
        ...(dto.titulo !== undefined ? { titulo: dto.titulo } : {}),
        ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
        ...(dto.nivel !== undefined ? { nivelId: await this.nivelId(dto.nivel) } : {}),
        ...(dto.estrellas !== undefined ? { estrellas: dto.estrellas } : {}),
        ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
        ...(dto.enunciado !== undefined ? { enunciado: dto.enunciado } : {}),
        ...(dto.codigoInicial !== undefined ? { codigoInicial: dto.codigoInicial } : {}),
        ...(dto.ejemploEntrada !== undefined ? { ejemploEntrada: dto.ejemploEntrada } : {}),
        ...(dto.ejemploSalida !== undefined ? { ejemploSalida: dto.ejemploSalida } : {}),
        ...(dto.xp !== undefined ? { xp: dto.xp } : {}),
        ...(dto.fechaLimite !== undefined ? { fechaLimite: dto.fechaLimite ? new Date(dto.fechaLimite) : null } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
    return { ok: true };
  }

  async alternarActivo(id: number, autorId: number) {
    const r = await this.propio(id, autorId);
    await this.prisma.reto.update({ where: { id }, data: { activo: !r.activo } });
    return { ok: true, activo: !r.activo };
  }

  async eliminar(id: number, autorId: number) {
    await this.propio(id, autorId);
    await this.prisma.reto.delete({ where: { id } });
    return { ok: true };
  }
}
