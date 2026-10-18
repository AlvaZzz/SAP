import { Injectable } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DocenteEstudiantesService, FilaCurso } from '../docente-estudiantes/docente-estudiantes.service';
import { paralelosDelDocente } from '../docente-registro/docente-registro.service';
import { DocenteRevisionesService } from '../docente-revisiones/docente-revisiones.service';
import { ETIQUETA_NIVEL, NIVELES } from '../../common/niveles/nivel-dificultad';

/** Datos mínimos para listar a un estudiante por su nombre (lista nominal). */
const nominal = (e: FilaCurso) => ({
  id: e.id, nombre: e.nombre, ci: e.ci, ru: e.ru, paralelo: e.paralelo.nombre,
  promedio: e.promedio, estado: e.estado, ultima_sesion: e.ultima_sesion,
});

/**
 * DASHBOARD DEL DOCENTE: sus paralelos.
 *
 * Una tarjeta por paralelo; al entrar, la distribución Básico / Intermedio /
 * Avanzado con la lista NOMINAL de cada nivel. Ninguna cifra queda suelta:
 * todo conteo trae a los estudiantes que lo componen.
 *
 * Todas las cifras se calculan solo sobre los paralelos del docente.
 */
@Injectable()
export class DocenteDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estudiantes: DocenteEstudiantesService,
    private readonly revisiones: DocenteRevisionesService,
  ) {}

  async resumen(docenteId: number, rol: string) {
    const { estudiantes: todos } = await this.estudiantes.curso(docenteId, rol);
    const activos = todos.filter((e) => e.activo);
    const ids = activos.map((e) => e.id);

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const hace7 = new Date(hoy.getTime() - 7 * 86_400_000);

    const [paralelosBd, resueltosHoy, actividad, entregasPendientes] = await Promise.all([
      // Incluye los paralelos del docente aunque todavía no tengan estudiantes.
      this.prisma.paralelo.findMany({
        where: paralelosDelDocente(docenteId, rol),
        orderBy: [{ materia: { gestion: 'desc' } }, { nombre: 'asc' }],
        include: { materia: true, docente: { select: { id: true, nombre: true } } },
      }),
      this.prisma.intento.findMany({
        where: { usuarioId: { in: ids }, correcto: true, fecha: { gte: hoy } },
        distinct: ['usuarioId'], select: { usuarioId: true },
      }),
      this.prisma.intento.findMany({
        where: { usuarioId: { in: ids } },
        orderBy: { fecha: 'desc' }, take: 8,
        include: { usuario: { select: { id: true, nombre: true } }, ejercicio: { select: { titulo: true, categoria: true } } },
      }),
      this.revisiones.conteoPendientes(docenteId),
    ]);

    const armar = (id: number | null, nombre: string, materia: string | null, gestion: string | null, docente: string | null, esMio: boolean) => {
      const lista = activos.filter((e) => (id === null ? e.paralelo.id === null : e.paralelo.id === id));
      return {
        id, nombre, materia, gestion, docente, es_mio: esMio,
        total: lista.length,
        sin_ingresar: lista.filter((e) => e.estado === 'sin_ingresar').length,
        en_riesgo: lista.filter((e) => e.estado === 'en_riesgo' || e.estado === 'inactivo').length,
        promedio: (() => {
          const notas = lista.map((e) => e.promedio).filter((p): p is number => p !== null);
          return notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
        })(),
        niveles: NIVELES.map((n: NivelDificultad) => {
          const deNivel = lista.filter((e) => e.nivel === n);
          return { nivel: n, titulo: ETIQUETA_NIVEL[n], total: deNivel.length, estudiantes: deNivel.map(nominal) };
        }),
      };
    };

    const paralelos = paralelosBd.map((p) => armar(p.id, p.nombre, p.materia.nombre, p.materia.gestion, p.docente?.nombre ?? null, p.docenteId === docenteId));
    // Estudiantes que se registraron solos y aún no están en ningún paralelo.
    const sueltos = activos.filter((e) => e.paralelo.id === null);
    if (sueltos.length > 0) paralelos.push(armar(null, 'Sin paralelo', null, null, null, false));

    const atencion = activos
      // Quien aún no ingresó se cuenta aparte ("aún no ingresaron"): no es un
      // estudiante con problemas, es una cuenta sin estrenar.
      .filter((e) => e.motivos_riesgo.length > 0 && e.estado !== 'sin_ingresar')
      .sort((a, b) => b.motivos_riesgo.filter((m) => m.gravedad === 'alta').length - a.motivos_riesgo.filter((m) => m.gravedad === 'alta').length
        || b.motivos_riesgo.length - a.motivos_riesgo.length);

    return {
      stats: {
        estudiantes_total: activos.length,
        estudiantes_activos: activos.filter((e) => e.ultima_sesion && e.ultima_sesion >= hace7).length,
        resolvieron_hoy: resueltosHoy.length,
        necesitan_atencion: atencion.length,
        sin_ingresar: activos.filter((e) => e.estado === 'sin_ingresar').length,
        entregas_pendientes: entregasPendientes,
      },
      paralelos,
      // Lista nominal (no solo el número) de quienes necesitan atención.
      atencion: atencion.slice(0, 8).map((e) => ({ ...nominal(e), motivos: e.motivos_riesgo })),
      actividad_reciente: actividad.map((it) => ({
        estudiante_id: it.usuario.id,
        estudiante: it.usuario.nombre,
        titulo: it.ejercicio.titulo,
        categoria: it.ejercicio.categoria,
        correcto: it.correcto,
        fecha: it.fecha,
      })),
    };
  }
}
