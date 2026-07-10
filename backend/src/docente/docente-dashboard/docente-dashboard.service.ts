import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocenteEstudiantesService } from '../docente-estudiantes/docente-estudiantes.service';
import { DocenteReportesService } from '../docente-reportes/docente-reportes.service';
import { DocenteRevisionesService } from '../docente-revisiones/docente-revisiones.service';

/**
 * Dashboard del docente: resumen del grupo. Compone los servicios de
 * seguimiento, reportes y revisiones para no duplicar la lógica.
 */
@Injectable()
export class DocenteDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estudiantes: DocenteEstudiantesService,
    private readonly reportes: DocenteReportesService,
    private readonly revisiones: DocenteRevisionesService,
  ) {}

  async resumen(docenteId: number) {
    const lista = await this.estudiantes.listar();

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);
    const hace7 = new Date(hoy); hace7.setDate(hoy.getDate() - 7);

    const [completadosHoy, distribucion, actividadReciente, entregasPendientes] = await Promise.all([
      this.prisma.intento.count({ where: { correcto: true, fecha: { gte: hoy, lt: manana } } }),
      this.reportes.progresoNiveles(),
      this.prisma.intento.findMany({
        orderBy: { fecha: 'desc' }, take: 8,
        include: {
          usuario: { select: { nombre: true } },
          ejercicio: { select: { titulo: true, categoria: true } },
        },
      }),
      this.revisiones.conteoPendientes(docenteId),
    ]);

    const activos = lista.filter((e) => e.ultima_sesion && new Date(e.ultima_sesion) >= hace7).length;
    const enRiesgo = lista.filter((e) => e.estado === 'en_riesgo').length;
    const promedioXp = lista.length ? Math.round(lista.reduce((a, e) => a + e.xp, 0) / lista.length) : 0;

    return {
      stats: {
        estudiantes_total: lista.length,
        estudiantes_activos: activos,
        completados_hoy: completadosHoy,
        promedio_xp: promedioXp,
        en_riesgo: enRiesgo,
        entregas_pendientes: entregasPendientes,
      },
      distribucion_niveles: distribucion.niveles,
      en_riesgo: lista.filter((e) => e.estado === 'en_riesgo').slice(0, 5),
      actividad_reciente: actividadReciente.map((it) => ({
        estudiante: it.usuario.nombre,
        titulo: it.ejercicio.titulo,
        categoria: it.ejercicio.categoria,
        correcto: it.correcto,
        xp: it.xpOtorgado,
        fecha: it.fecha,
      })),
    };
  }
}
