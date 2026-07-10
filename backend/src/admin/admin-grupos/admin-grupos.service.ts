import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminAuditoriaService } from '../admin-auditoria/admin-auditoria.service';
import { AsignarGrupoDto, AsignarGrupoParaleloDto } from './dto/grupo.dto';

/**
 * Gestión de grupos de investigación (rol admin). Habilita el diseño
 * cuasi-experimental: asigna cada estudiante a CONTROL o EXPERIMENTAL. Este
 * grupo es el que consume el rol investigador en sus comparativas y exportación.
 * Cuando la recolección ya inició, los cambios se bloquean (config) salvo forzar.
 */
@Injectable()
export class AdminGruposService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AdminAuditoriaService,
  ) {}

  async listar() {
    const estudiantes = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante' },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, email: true, grupo: true, institucion: true, paralelo: true, activo: true },
    });
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });

    const conteo = { control: 0, experimental: 0 };
    const porInst = new Map<string, { control: number; experimental: number; total: number }>();
    const porParalelo = new Map<string, { control: number; experimental: number; total: number }>();
    for (const e of estudiantes) {
      conteo[e.grupo]++;
      const inst = e.institucion ?? 'Sin institución';
      const acc = porInst.get(inst) ?? { control: 0, experimental: 0, total: 0 };
      acc[e.grupo]++; acc.total++;
      porInst.set(inst, acc);

      const par = e.paralelo ?? 'Sin paralelo';
      const accP = porParalelo.get(par) ?? { control: 0, experimental: 0, total: 0 };
      accP[e.grupo]++; accP.total++;
      porParalelo.set(par, accP);
    }

    return {
      bloqueado: cfg?.gruposBloqueados ?? false,
      conteo: { ...conteo, total: estudiantes.length },
      instituciones: [...porInst.entries()].map(([institucion, v]) => ({ institucion, ...v })).sort((a, b) => b.total - a.total),
      // Conteo por paralelo: la base para armar los grupos control/experimental "un paralelo entero cada uno".
      paralelos: [...porParalelo.entries()].map(([paralelo, v]) => ({ paralelo, ...v })).sort((a, b) => a.paralelo.localeCompare(b.paralelo)),
      estudiantes,
    };
  }

  async asignar(actorId: number, dto: AsignarGrupoDto) {
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    if (cfg?.gruposBloqueados && !dto.forzar) {
      throw new ConflictException('Los grupos están bloqueados. Confirma para forzar el cambio (puede contaminar el diseño).');
    }

    // Solo estudiantes reales.
    const validos = await this.prisma.usuario.findMany({
      where: { id: { in: dto.ids }, rol: 'estudiante' },
      select: { id: true },
    });
    const ids = validos.map((v) => v.id);
    if (ids.length === 0) return { ok: true, actualizados: 0 };

    await this.prisma.usuario.updateMany({
      where: { id: { in: ids } },
      data: { grupo: dto.grupo, ...(dto.institucion !== undefined ? { institucion: dto.institucion } : {}) },
    });

    await this.auditoria.registrar({
      actorId, accion: 'grupo_cambiar', entidad: 'grupo',
      detalle: `Asignó ${ids.length} estudiante(s) al grupo ${dto.grupo}${dto.institucion ? ` (institución: ${dto.institucion})` : ''}${dto.forzar ? ' [forzado]' : ''}`,
    });
    return { ok: true, actualizados: ids.length };
  }

  /**
   * Asigna un PARALELO COMPLETO a un grupo de investigación de una sola vez.
   * Facilita el diseño cuasi-experimental: un paralelo entero es el
   * experimental (usa PREXI) y otro el control.
   */
  async asignarPorParalelo(actorId: number, dto: AsignarGrupoParaleloDto) {
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    if (cfg?.gruposBloqueados && !dto.forzar) {
      throw new ConflictException('Los grupos están bloqueados. Confirma para forzar el cambio (puede contaminar el diseño).');
    }

    const paralelo = dto.paralelo.trim().toUpperCase();
    const estudiantes = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante', paralelo },
      select: { id: true },
    });
    if (estudiantes.length === 0) throw new BadRequestException(`No hay estudiantes registrados en el paralelo "${paralelo}"`);

    await this.prisma.usuario.updateMany({
      where: { id: { in: estudiantes.map((e) => e.id) } },
      data: { grupo: dto.grupo },
    });

    await this.auditoria.registrar({
      actorId, accion: 'grupo_cambiar', entidad: 'grupo',
      detalle: `Asignó el paralelo "${paralelo}" completo (${estudiantes.length} estudiantes) al grupo ${dto.grupo}${dto.forzar ? ' [forzado]' : ''}`,
    });
    return { ok: true, actualizados: estudiantes.length, paralelo };
  }
}
