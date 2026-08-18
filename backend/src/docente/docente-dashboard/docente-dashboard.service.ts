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

    // Las cifras globales se piden AGREGADAS a la base en vez de derivarlas de
    // la lista completa de estudiantes: esa lista ahora viene paginada, y aunque
    // no lo estuviera, traerla entera solo para contar es el tipo de consulta
    // que satura la capa gratuita cuando el curso crece.
    const [estudiantesTotal, activos, xpAgregado] = await Promise.all([
      this.prisma.usuario.count({ where: { rol: 'estudiante' } }),
      this.prisma.usuario.count({
        where: { rol: 'estudiante', ranking: { ultimaActividad: { gte: hace7 } } },
      }),
      this.prisma.ranking.aggregate({
        where: { usuario: { rol: 'estudiante' } },
        _avg: { xpTotal: true },
      }),
    ]);
    const promedioXp = Math.round(xpAgregado._avg.xpTotal ?? 0);

    // El estado "en riesgo" sí exige la clasificación por estudiante, así que se
    // toma de la primera página: alcanza para el contador y la lista corta que
    // muestra el panel, sin recorrer todo el curso.
    const enRiesgo = lista.estudiantes.filter((e) => e.estado === 'en_riesgo');

    return {
      stats: {
        estudiantes_total: estudiantesTotal,
        estudiantes_activos: activos,
        completados_hoy: completadosHoy,
        promedio_xp: promedioXp,
        en_riesgo: enRiesgo.length,
        entregas_pendientes: entregasPendientes,
      },
      distribucion_niveles: distribucion.niveles,
      en_riesgo: enRiesgo.slice(0, 5),
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
