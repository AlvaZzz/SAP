import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AdminUsuariosService } from '../admin-usuarios/admin-usuarios.service';
import { AdminAuditoriaService } from '../admin-auditoria/admin-auditoria.service';

const MS_SEMANA = 7 * 86_400_000;

/**
 * Dashboard del admin: estado técnico del sistema y resumen del estudio.
 * Compone conteos de usuarios y auditoría (una sola fuente de verdad en la BD).
 */
@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usuarios: AdminUsuariosService,
    private readonly auditoria: AdminAuditoriaService,
  ) {}

  async resumen() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const hace7 = new Date(Date.now() - MS_SEMANA);

    const [porRol, ejercicios, estudiantes, activosRows, auditoria] = await Promise.all([
      this.usuarios.conteos(),
      this.prisma.ejercicio.count(),
      this.prisma.usuario.findMany({ where: { rol: 'estudiante' }, select: { grupo: true, activo: true } }),
      this.prisma.intento.findMany({ where: { fecha: { gte: hace7 } }, distinct: ['usuarioId'], select: { usuarioId: true } }),
      this.auditoria.listar({ limit: 8 }),
    ]);

    const totalUsuarios = Object.values(porRol).reduce((a, b) => a + b, 0);
    const estudio = {
      control: estudiantes.filter((e) => e.grupo === 'control').length,
      experimental: estudiantes.filter((e) => e.grupo === 'experimental').length,
    };

    // Nuevos registros por semana (últimas 6 semanas).
    const desde6 = new Date(hoy.getTime() - 6 * MS_SEMANA);
    const nuevos = await this.prisma.usuario.findMany({
      where: { creadoEn: { gte: desde6 } },
      select: { creadoEn: true },
    });
    const registros: { semana: string; nuevos: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const ini = new Date(hoy.getTime() - i * MS_SEMANA - 6 * 86_400_000);
      const fin = new Date(hoy.getTime() - i * MS_SEMANA + 86_400_000);
      registros.push({
        semana: ini.toISOString().slice(0, 10),
        nuevos: nuevos.filter((u) => u.creadoEn >= ini && u.creadoEn < fin).length,
      });
    }

    return {
      stats: {
        total_usuarios: totalUsuarios,
        estudiantes_activos: activosRows.length,
        ejercicios: ejercicios,
        docentes: porRol.docente,
        admins: porRol.admin,
        investigadores: porRol.investigador,
      },
      distribucion_roles: [
        { rol: 'estudiante', total: porRol.estudiante },
        { rol: 'docente', total: porRol.docente },
        { rol: 'investigador', total: porRol.investigador },
        { rol: 'admin', total: porRol.admin },
      ],
      estudio,
      registros_por_semana: registros,
      actividad_reciente: auditoria.logs,
    };
  }
}
