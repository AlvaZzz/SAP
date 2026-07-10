import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Notificaciones del estudiante (campana de la topbar). Otros dominios (p. ej.
 * docente-retos al revisar una entrega) inyectan este servicio para crear una
 * notificación. El estudiante las lista, ve el conteo de no leídas y las marca.
 */
@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crea una notificación. `tx` opcional para participar de una transacción. */
  async crear(
    data: { usuarioId: number; tipo?: string; titulo: string; mensaje: string; enlace?: string; refId?: number },
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    return client.notificacion.create({
      data: {
        usuarioId: data.usuarioId,
        tipo: data.tipo ?? 'reto_revisado',
        titulo: data.titulo,
        mensaje: data.mensaje,
        enlace: data.enlace ?? null,
        refId: data.refId ?? null,
      },
    });
  }

  async listar(usuarioId: number) {
    const [items, noLeidas] = await Promise.all([
      this.prisma.notificacion.findMany({
        where: { usuarioId },
        orderBy: { creadoEn: 'desc' },
        take: 30,
      }),
      this.prisma.notificacion.count({ where: { usuarioId, leida: false } }),
    ]);
    return {
      no_leidas: noLeidas,
      notificaciones: items.map((n) => ({
        id: n.id, tipo: n.tipo, titulo: n.titulo, mensaje: n.mensaje,
        enlace: n.enlace, refId: n.refId, leida: n.leida, fecha: n.creadoEn,
      })),
    };
  }

  async conteoNoLeidas(usuarioId: number) {
    return { no_leidas: await this.prisma.notificacion.count({ where: { usuarioId, leida: false } }) };
  }

  async marcarLeida(usuarioId: number, id: number) {
    const n = await this.prisma.notificacion.findUnique({ where: { id } });
    if (!n || n.usuarioId !== usuarioId) throw new NotFoundException('Notificación no encontrada');
    await this.prisma.notificacion.update({ where: { id }, data: { leida: true } });
    return { ok: true };
  }

  async marcarTodas(usuarioId: number) {
    await this.prisma.notificacion.updateMany({ where: { usuarioId, leida: false }, data: { leida: true } });
    return { ok: true };
  }
}
