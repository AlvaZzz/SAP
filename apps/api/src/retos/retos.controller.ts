import { Controller, Get, Post, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtAuthGuard } from '../common/auth/jwt.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';

/**
 * Retos del docente (ejercicios extra) — vista estudiante.
 * El estudiante los resuelve en la Zona de Práctica (contexto = reto).
 */
@Controller('retos')
@UseGuards(JwtAuthGuard)
export class RetosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listar(@CurrentUser('sub') usuarioId: number) {
    const retos = await this.prisma.reto.findMany({
      orderBy: { creadoEn: 'desc' },
      include: { autor: { select: { nombre: true } }, resueltos: { where: { usuarioId } } },
    });
    return {
      retos: retos.map((r) => ({
        id: r.id, titulo: r.titulo, categoria: r.categoria, estrellas: r.estrellas, tipo: r.tipo,
        enunciado: r.enunciado, codigo_inicial: r.codigoInicial, xp: r.xp,
        autor: r.autor.nombre, fecha: r.creadoEn,
        estado: r.resueltos[0]?.resuelto ? 'resuelto' : 'nuevo',
      })),
    };
  }

  @Get(':id')
  async detalle(@Param('id', ParseIntPipe) id: number) {
    const r = await this.prisma.reto.findUnique({ where: { id }, include: { autor: { select: { nombre: true } } } });
    return { reto: r };
  }

  @Post(':id/resolver')
  async resolver(@CurrentUser('sub') usuarioId: number, @Param('id', ParseIntPipe) retoId: number) {
    await this.prisma.retoUsuario.upsert({
      where: { usuarioId_retoId: { usuarioId, retoId } },
      create: { usuarioId, retoId, resuelto: true },
      update: { resuelto: true },
    });
    return { ok: true };
  }
}
