import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

interface CatEval { categoria: string; aciertos: number; total: number; porcentaje: number }

@Injectable()
export class ProgresoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Comparativa Pretest vs Postest (por categoría + totales) ──
  async comparativa(usuarioId: number) {
    const evals = await this.prisma.evaluacion.findMany({ where: { usuarioId } });
    const pre = evals.find((e) => e.tipo === 'pre');
    const post = evals.find((e) => e.tipo === 'post');
    const catPre = (pre?.porCategoria as unknown as CatEval[]) ?? [];
    const catPost = (post?.porCategoria as unknown as CatEval[]) ?? [];

    const cats = new Set([...catPre.map((c) => c.categoria), ...catPost.map((c) => c.categoria)]);
    const comparativa = [...cats].map((categoria) => {
      const p = catPre.find((c) => c.categoria === categoria)?.porcentaje ?? null;
      const q = catPost.find((c) => c.categoria === categoria)?.porcentaje ?? null;
      return { categoria, pretest: p, postest: q, mejora: p != null && q != null ? q - p : null };
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
