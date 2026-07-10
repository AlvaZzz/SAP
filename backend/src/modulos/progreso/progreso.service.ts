import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ETIQUETA_NIVEL } from '../../common/niveles/nivel-dificultad';

interface CatEval { categoria: string; aciertos: number; total: number; porcentaje: number }

@Injectable()
export class ProgresoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Progreso DETALLADO por Unidad → Tema. Para cada tema calcula el "dominio"
   * del estudiante (% de sus ejercicios resueltos correctamente) y el promedio
   * grupal (mismo cálculo, promediado sobre todos los estudiantes activos). Es
   * la base del radar por unidad y la comparativa desglosada.
   */
  async detalleUnidades(usuarioId: number) {
    const unidades = await this.prisma.unidad.findMany({
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      include: {
        temas: {
          where: { padreId: null, publicado: true },
          orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
          include: {
            ejercicios: { where: { activo: true }, select: { id: true } },
            progreso: { where: { usuarioId }, select: { nivelActual: true } },
          },
        },
        desempenos: { where: { usuarioId }, select: { nivelDominio: true, dominioPct: true } },
      },
    });

    const totalEstudiantes = await this.prisma.usuario.count({ where: { rol: 'estudiante', activo: true } });

    const resultado = [];
    for (const u of unidades) {
      const temasConDatos = u.temas.filter((t) => t.ejercicios.length > 0);
      if (temasConDatos.length === 0) continue;

      const temas = [];
      for (const t of temasConDatos) {
        const ejIds = t.ejercicios.map((e) => e.id);
        // Dominio del estudiante: ejercicios distintos resueltos correctamente / total.
        const propios = await this.prisma.intento.findMany({
          where: { usuarioId, correcto: true, ejercicioId: { in: ejIds } },
          distinct: ['ejercicioId'], select: { ejercicioId: true },
        });
        const dominio = Math.round((propios.length / ejIds.length) * 100);

        // Promedio grupal: (Σ resueltos correctos distintos por todos) / (estudiantes × total ejercicios).
        const gruposCorrectos = await this.prisma.intento.findMany({
          where: { correcto: true, ejercicioId: { in: ejIds }, usuario: { rol: 'estudiante', activo: true } },
          distinct: ['usuarioId', 'ejercicioId'], select: { ejercicioId: true },
        });
        const promedioGrupal = totalEstudiantes > 0
          ? Math.round((gruposCorrectos.length / (totalEstudiantes * ejIds.length)) * 100)
          : 0;

        const nivelTema = t.progreso[0]?.nivelActual ?? 'basico';
        temas.push({
          temaId: t.id, numero: t.numero, titulo: t.titulo,
          total_ejercicios: ejIds.length, dominio, promedio_grupal: promedioGrupal,
          nivel_alcanzado: nivelTema, nivel_alcanzado_label: ETIQUETA_NIVEL[nivelTema],
        });
      }

      const desU = u.desempenos[0];
      const nivelDominio = desU?.nivelDominio ?? 'basico';
      resultado.push({
        unidadId: u.id, numero: u.numero, titulo: u.titulo, temas,
        nivel_dominio: nivelDominio, nivel_dominio_label: ETIQUETA_NIVEL[nivelDominio],
        dominio_pct: desU?.dominioPct ?? 0,
      });
    }
    return resultado;
  }

  // ── Comparativa Pretest vs Postest (por categoría + totales) ──
  async comparativa(usuarioId: number) {
    const evals = await this.prisma.evaluacion.findMany({ where: { usuarioId } });
    const pre = evals.find((e) => e.tipo === 'pre');
    const post = evals.find((e) => e.tipo === 'post');
    const catPre = (pre?.porCategoria as unknown as CatEval[]) ?? [];
    const catPost = (post?.porCategoria as unknown as CatEval[]) ?? [];

    const cats = new Set([...catPre.map((c) => c.categoria), ...catPost.map((c) => c.categoria)]);

    // Promedio grupal por categoría (última evaluación de cada estudiante:
    // postest si existe, si no pretest) → línea "Promedio grupal" del radar.
    const evalsGrupo = await this.prisma.evaluacion.findMany({
      where: { usuario: { rol: 'estudiante', activo: true } },
      select: { usuarioId: true, tipo: true, porCategoria: true },
    });
    const porUsuario = new Map<number, CatEval[]>();
    for (const e of evalsGrupo) {
      const cur = porUsuario.get(e.usuarioId);
      if (!cur || e.tipo === 'post') porUsuario.set(e.usuarioId, (e.porCategoria as unknown as CatEval[]) ?? []);
    }
    const acumulado = new Map<string, { suma: number; n: number }>();
    for (const cs of porUsuario.values()) {
      for (const c of cs) {
        const acc = acumulado.get(c.categoria) ?? { suma: 0, n: 0 };
        acc.suma += c.porcentaje; acc.n++;
        acumulado.set(c.categoria, acc);
      }
    }

    const comparativa = [...cats].map((categoria) => {
      const p = catPre.find((c) => c.categoria === categoria)?.porcentaje ?? null;
      const q = catPost.find((c) => c.categoria === categoria)?.porcentaje ?? null;
      const g = acumulado.get(categoria);
      return {
        categoria, pretest: p, postest: q,
        mejora: p != null && q != null ? q - p : null,
        promedio_grupal: g && g.n > 0 ? Math.round(g.suma / g.n) : null,
      };
    });

    return {
      comparativa,
      pretest_total: pre?.puntajeTotal ?? null,
      postest_total: post?.puntajeTotal ?? null,
      ganancia: pre && post ? post.puntajeTotal - pre.puntajeTotal : null,
    };
  }

  // ── Progreso por nivel ──
  async niveles(usuarioId: number) {
    const niveles = await this.prisma.nivel.findMany({
      orderBy: { numero: 'asc' },
      include: { progreso: { where: { usuarioId } } },
    });
    return niveles.map((n) => {
      const pr = n.progreso[0];
      const completados = pr?.ejerciciosCompletados ?? 0;
      const completo = completados >= n.umbral;
      return {
        numero: n.numero, titulo: n.titulo, umbral: n.umbral, ejercicios_completados: completados,
        desbloqueado: pr?.desbloqueado ?? n.numero === 1,
        estado: completo ? 'completado' : pr?.desbloqueado ? 'en_progreso' : 'bloqueado',
      };
    });
  }

  // ── Sesiones/intentos recientes ──
  async sesiones(usuarioId: number) {
    const intentos = await this.prisma.intento.findMany({
      where: { usuarioId }, orderBy: { fecha: 'desc' }, take: 15,
      include: { ejercicio: { select: { titulo: true, categoria: true } } },
    });
    return intentos.map((i) => ({
      titulo: i.ejercicio.titulo, categoria: i.ejercicio.categoria,
      correcto: i.correcto, xp: i.xpOtorgado, tiempo_seg: i.tiempoSeg, fecha: i.fecha,
    }));
  }

  // ── Export CSV de pretest/postest (investigación) ──
  async exportCsv(): Promise<string> {
    const estudiantes = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante' },
      include: { evaluaciones: true },
      orderBy: { id: 'asc' },
    });

    const cols = ['usuario_id', 'nombre', 'grupo', 'puntaje_pretest', 'tiempo_pretest_seg', 'puntaje_postest', 'tiempo_postest_seg', 'ganancia'];
    const filas = estudiantes.map((u) => {
      const pre = u.evaluaciones.find((e) => e.tipo === 'pre');
      const post = u.evaluaciones.find((e) => e.tipo === 'post');
      const ganancia = pre && post ? post.puntajeTotal - pre.puntajeTotal : '';
      return [
        u.id, `"${u.nombre.replace(/"/g, '""')}"`, u.grupo,
        pre?.puntajeTotal ?? '', pre?.tiempoSeg ?? '',
        post?.puntajeTotal ?? '', post?.tiempoSeg ?? '', ganancia,
      ].join(',');
    });

    return [cols.join(','), ...filas].join('\n');
  }
}
