import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface RegistroAuditoria {
  actorId: number;
  accion: string;
  entidad?: string;
  entidadId?: number;
  detalle?: string;
}

/**
 * Auditoría de acciones sensibles del admin (crear/editar/desactivar usuarios,
 * cambios de rol y de configuración). Trazabilidad para la seriedad
 * del estudio. Otros módulos admin inyectan este servicio para registrar.
 */
@Injectable()
export class AdminAuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Registra una acción. `tx` opcional para participar de una transacción. */
  async registrar(reg: RegistroAuditoria, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.logAuditoria.create({
      data: {
        actorId: reg.actorId,
        accion: reg.accion,
        entidad: reg.entidad ?? '',
        entidadId: reg.entidadId ?? null,
        detalle: reg.detalle ?? '',
      },
    });
  }

  async listar(filtros: { accion?: string; desde?: string; hasta?: string; limit?: number; offset?: number; q?: string }) {
    const where: Prisma.LogAuditoriaWhereInput = {
      ...(filtros.accion ? { accion: filtros.accion } : {}),
      // Búsqueda libre: en el detalle o en el nombre de quien hizo la acción.
      ...(filtros.q
        ? { OR: [{ detalle: { contains: filtros.q, mode: 'insensitive' } }, { actor: { nombre: { contains: filtros.q, mode: 'insensitive' } } }] }
        : {}),
      ...(filtros.desde || filtros.hasta
        ? {
            fecha: {
              ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
              ...(filtros.hasta ? { lte: new Date(`${filtros.hasta}T23:59:59.999`) } : {}),
            },
          }
        : {}),
    };
    const limit = Math.min(200, Math.max(1, filtros.limit ?? 50));
    const offset = Math.max(0, filtros.offset ?? 0);

    const [total, logs, acciones] = await Promise.all([
      this.prisma.logAuditoria.count({ where }),
      this.prisma.logAuditoria.findMany({
        where,
        orderBy: { fecha: 'desc' },
        take: limit,
        skip: offset,
        include: { actor: { select: { nombre: true, rol: true } } },
      }),
      this.prisma.logAuditoria.findMany({ distinct: ['accion'], select: { accion: true }, orderBy: { accion: 'asc' } }),
    ]);

    return {
      total,
      acciones: acciones.map((a) => a.accion),
      logs: logs.map((l) => ({
        id: l.id, actor: l.actor.nombre, actor_rol: l.actor.rol,
        accion: l.accion, entidad: l.entidad, entidadId: l.entidadId,
        detalle: l.detalle, fecha: l.fecha,
      })),
    };
  }
}
