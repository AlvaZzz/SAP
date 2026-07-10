import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificacionesService } from '../../modulos/notificaciones/notificaciones.service';

/**
 * Control docente de la EVALUACIÓN FINAL (postest) por paralelo. El postest
 * está DESHABILITADO por defecto; el docente lo habilita cuando termina la
 * intervención. Al habilitarlo se notifica a los estudiantes del paralelo.
 */
@Injectable()
export class DocentePostestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /** Paralelos existentes con su conteo de estudiantes y estado de habilitación. */
  async listar() {
    const estudiantes = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante', activo: true, paralelo: { not: null } },
      select: { paralelo: true },
    });
    const controles = await this.prisma.postestControl.findMany();
    const habilitados = new Map(controles.map((c) => [c.paralelo, c]));

    const conteo = new Map<string, number>();
    for (const e of estudiantes) {
      if (e.paralelo) conteo.set(e.paralelo, (conteo.get(e.paralelo) ?? 0) + 1);
    }

    return [...conteo.entries()]
      .map(([paralelo, total]) => ({
        paralelo,
        total_estudiantes: total,
        habilitado: habilitados.get(paralelo)?.habilitado ?? false,
        habilitado_en: habilitados.get(paralelo)?.habilitadoEn ?? null,
      }))
      .sort((a, b) => a.paralelo.localeCompare(b.paralelo));
  }

  /** Habilita/deshabilita el postest de un paralelo. Al habilitar, notifica a sus estudiantes. */
  async establecer(paralelo: string, habilitado: boolean) {
    const p = paralelo.trim().toUpperCase();
    await this.prisma.postestControl.upsert({
      where: { paralelo: p },
      create: { paralelo: p, habilitado, habilitadoEn: habilitado ? new Date() : null },
      update: { habilitado, habilitadoEn: habilitado ? new Date() : null },
    });

    if (habilitado) {
      const estudiantes = await this.prisma.usuario.findMany({
        where: { rol: 'estudiante', activo: true, paralelo: p },
        select: { id: true },
      });
      await Promise.all(estudiantes.map((e) => this.notificaciones.crear({
        usuarioId: e.id,
        tipo: 'postest_habilitado',
        titulo: 'Evaluación final disponible',
        mensaje: 'Tu docente habilitó la evaluación final (postest). Ya puedes rendirla desde el menú.',
        enlace: '/postest',
      })));
      return { ok: true, habilitado: true, notificados: estudiantes.length };
    }
    return { ok: true, habilitado: false };
  }
}
