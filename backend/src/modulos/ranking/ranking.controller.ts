import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';

@Controller('ranking')
@UseGuards(JwtAuthGuard)
export class RankingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async ranking(@CurrentUser('sub') usuarioId: number, @Query('limite') limite?: string) {
    const take = Math.min(Number(limite) || 20, 100);
    const filas = await this.prisma.ranking.findMany({
      where: { usuario: { rol: 'estudiante' } },
      orderBy: [{ xpTotal: 'desc' }, { usuarioId: 'asc' }],
      take,
      include: { usuario: { select: { id: true, nombre: true } } },
    });
    const ranking = filas.map((r) => ({
      posicion: r.posicion, usuario_id: r.usuarioId, nombre: r.usuario.nombre,
      xp_total: r.xpTotal, racha_dias: r.rachaDias,
    }));

    const mio = await this.prisma.ranking.findUnique({
      where: { usuarioId }, include: { usuario: { select: { nombre: true } } },
    });
    const yo = mio
      ? { posicion: mio.posicion, nombre: mio.usuario.nombre, xp_total: mio.xpTotal, racha_dias: mio.rachaDias }
      : null;

    return { ranking, yo };
  }
}
