import { Body, Controller, Get, Post, Param, ParseIntPipe, UseGuards, BadRequestException } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

class EntregarRetoDto {
  @IsString() @MinLength(1) codigo!: string;
}

// Deriva la etiqueta que ve el estudiante en la tarjeta del reto.
function estadoTarjeta(estado: string | undefined): 'nuevo' | 'pendiente' | 'aprobado' | 'necesita_mejorar' {
  switch (estado) {
    case 'pendiente_revision': return 'pendiente';
    case 'aprobado': return 'aprobado';
    case 'necesita_mejorar': return 'necesita_mejorar';
    default: return 'nuevo';
  }
}

/**
 * Retos del docente (ejercicios extra) — vista estudiante.
 * El estudiante los resuelve en la Zona de Práctica (contexto = reto) y pulsa
 * "Entregar reto": queda en pendiente_revision (SIN XP). El docente lo revisa y
 * otorga XP + feedback (ver docente-retos). El estudiante recibe una notificación.
 */
@Controller('retos')
@UseGuards(JwtAuthGuard)
export class RetosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  @Get()
  async listar(@CurrentUser('sub') usuarioId: number) {
    const retos = await this.prisma.reto.findMany({
      where: { activo: true }, // el estudiante solo ve retos publicados
      orderBy: { creadoEn: 'desc' },
      include: {
        autor: { select: { nombre: true } },
        nivel: { select: { numero: true } },
        resueltos: { where: { usuarioId } },
      },
    });
    return {
      retos: retos.map((r) => {
        const e = r.resueltos[0];
        return {
          id: r.id, titulo: r.titulo, categoria: r.categoria, nivel: r.nivel?.numero ?? null,
          estrellas: r.estrellas, tipo: r.tipo, enunciado: r.enunciado, codigo_inicial: r.codigoInicial,
          ejemplo_entrada: r.ejemploEntrada, ejemplo_salida: r.ejemploSalida,
          xp: r.xp, fecha_limite: r.fechaLimite, autor: r.autor.nombre, fecha: r.creadoEn,
          estado: estadoTarjeta(e?.estado),
          xp_obtenido: e?.xpObtenido ?? 0,
          feedback: e?.feedbackDocente ?? null,
        };
      }),
    };
  }

  /** Entregas del estudiante con su estado, XP y feedback (vista "Mis entregas"). */
  @Get('mis-entregas')
  async misEntregas(@CurrentUser('sub') usuarioId: number) {
    const entregas = await this.prisma.retoUsuario.findMany({
      where: { usuarioId, estado: { not: 'sin_entregar' } },
      orderBy: [{ revisadoEn: 'desc' }, { entregadoEn: 'desc' }],
      include: { reto: { select: { id: true, titulo: true, categoria: true, xp: true } } },
    });
    return {
      entregas: entregas.map((e) => ({
        retoId: e.retoId, titulo: e.reto.titulo, categoria: e.reto.categoria,
        estado: e.estado, xp_obtenido: e.xpObtenido, feedback: e.feedbackDocente,
        codigo: e.codigoEntregado, entregado_en: e.entregadoEn, revisado_en: e.revisadoEn,
      })),
    };
  }

  @Get(':id')
  async detalle(@CurrentUser('sub') usuarioId: number, @Param('id', ParseIntPipe) id: number) {
    const r = await this.prisma.reto.findFirst({ where: { id, activo: true }, include: { autor: { select: { nombre: true } } } });
    if (!r) return { reto: null, entrega: null };
    const e = await this.prisma.retoUsuario.findUnique({ where: { usuarioId_retoId: { usuarioId, retoId: id } } });
    return {
      reto: r,
      entrega: e
        ? { estado: e.estado, xp_obtenido: e.xpObtenido, feedback: e.feedbackDocente, codigo: e.codigoEntregado, entregado_en: e.entregadoEn, revisado_en: e.revisadoEn }
        : null,
    };
  }

  /** Entrega el reto para revisión del docente. No otorga XP todavía. */
  @Post(':id/entregar')
  async entregar(@CurrentUser('sub') usuarioId: number, @Param('id', ParseIntPipe) retoId: number, @Body() dto: EntregarRetoDto) {
    const reto = await this.prisma.reto.findFirst({ where: { id: retoId, activo: true }, select: { id: true, titulo: true, autorId: true } });
    if (!reto) throw new BadRequestException('El reto no existe o no está disponible');

    const actual = await this.prisma.retoUsuario.findUnique({ where: { usuarioId_retoId: { usuarioId, retoId } } });
    if (actual?.estado === 'pendiente_revision') throw new BadRequestException('Ya entregaste este reto; espera la revisión del docente.');
    if (actual?.estado === 'aprobado') throw new BadRequestException('Este reto ya fue aprobado.');

    await this.prisma.retoUsuario.upsert({
      where: { usuarioId_retoId: { usuarioId, retoId } },
      create: { usuarioId, retoId, estado: 'pendiente_revision', codigoEntregado: dto.codigo, entregadoEn: new Date() },
      update: { estado: 'pendiente_revision', codigoEntregado: dto.codigo, entregadoEn: new Date(), revisadoEn: null },
    });

    // Avisa al docente autor del reto: tiene una entrega nueva por revisar.
    const estudiante = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } });
    await this.notificaciones.crear({
      usuarioId: reto.autorId,
      tipo: 'entrega_pendiente',
      titulo: `Nueva entrega: ${reto.titulo}`,
      mensaje: `${estudiante?.nombre ?? 'Un estudiante'} entregó el reto "${reto.titulo}" y espera tu revisión.`,
      enlace: '/docente/revisiones',
      refId: retoId,
    });

    return { ok: true, estado: 'pendiente_revision' };
  }
}
