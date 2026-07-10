import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface CatEval { categoria: string; aciertos: number; total: number; porcentaje: number }

/**
 * Reportes del grupo (rol docente) — insumo central de la investigación.
 * Todo se calcula sobre datos reales de pretest/postest e intentos.
 */
@Injectable()
export class DocenteReportesService {
  constructor(private readonly prisma: PrismaService) {}

  private cats(json: unknown): CatEval[] {
    return Array.isArray(json) ? (json as CatEval[]) : [];
  }

  // ── Reporte Pretest vs Postest ──
  async pretestPostest() {
    const estudiantes = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante' },
      orderBy: { nombre: 'asc' },
      include: { evaluaciones: true },
    });

    // Promedio del grupo por categoría (pretest y postest).
    const acc = new Map<string, { preSum: number; preN: number; postSum: number; postN: number }>();
    const bump = (cat: string, campo: 'pre' | 'post', val: number) => {
      const e = acc.get(cat) ?? { preSum: 0, preN: 0, postSum: 0, postN: 0 };
      if (campo === 'pre') { e.preSum += val; e.preN++; } else { e.postSum += val; e.postN++; }
      acc.set(cat, e);
    };

    const tabla = estudiantes
      .map((u) => {
        const pre = u.evaluaciones.find((e) => e.tipo === 'pre');
        const post = u.evaluaciones.find((e) => e.tipo === 'post');
        for (const c of this.cats(pre?.porCategoria)) bump(c.categoria, 'pre', c.porcentaje);
        for (const c of this.cats(post?.porCategoria)) bump(c.categoria, 'post', c.porcentaje);

        // Categoría más débil: menor porcentaje en el postest (o pretest si no hay post).
        const base = this.cats(post?.porCategoria).length ? this.cats(post?.porCategoria) : this.cats(pre?.porCategoria);
        const debil = base.length ? base.reduce((a, b) => (b.porcentaje < a.porcentaje ? b : a)).categoria : null;

        return {
          id: u.id, nombre: u.nombre, grupo: u.grupo,
          pretest: pre?.puntajeTotal ?? null,
          postest: post?.puntajeTotal ?? null,
          ganancia: pre && post ? post.puntajeTotal - pre.puntajeTotal : null,
          categoria_mas_debil: debil,
        };
      })
      .filter((r) => r.pretest !== null || r.postest !== null);

    const por_categoria = [...acc.entries()]
      .map(([categoria, v]) => ({
        categoria,
        pretest: v.preN ? Math.round(v.preSum / v.preN) : null,
        postest: v.postN ? Math.round(v.postSum / v.postN) : null,
      }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria));

    const conPre = tabla.filter((r) => r.pretest !== null);
    const conPost = tabla.filter((r) => r.postest !== null);
    const prom = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x !== null);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };

    return {
      por_categoria,
      tabla,
      resumen: {
        estudiantes_con_pretest: conPre.length,
        estudiantes_con_postest: conPost.length,
        promedio_pretest: prom(tabla.map((r) => r.pretest)),
        promedio_postest: prom(tabla.map((r) => r.postest)),
        ganancia_promedio: prom(tabla.map((r) => r.ganancia)),
      },
    };
  }

  // ── Distribución de estudiantes por nivel + tiempo promedio por nivel ──
  async progresoNiveles() {
    const [niveles, estudiantes, intentosPorNivel] = await Promise.all([
      this.prisma.nivel.findMany({ orderBy: { numero: 'asc' } }),
      this.prisma.usuario.findMany({ where: { rol: 'estudiante' }, include: { progreso: true } }),
      // Tiempo invertido por nivel (solo intentos correctos, tiempo > 0).
      this.prisma.intento.findMany({
        where: { correcto: true, tiempoSeg: { gt: 0 } },
        select: { tiempoSeg: true, ejercicio: { select: { nivelId: true } } },
      }),
    ]);
    const numeroPorNivel = new Map(niveles.map((n) => [n.id, n.numero]));

    const conteo = new Map<number, number>(niveles.map((n) => [n.numero, 0]));
    for (const u of estudiantes) {
      const desbloqueados = u.progreso.filter((p) => p.desbloqueado);
      const nivelActual = desbloqueados.length
        ? Math.max(...desbloqueados.map((p) => numeroPorNivel.get(p.nivelId) ?? 1))
        : 1;
      conteo.set(nivelActual, (conteo.get(nivelActual) ?? 0) + 1);
    }

    // Tiempo promedio (seg) por número de nivel.
    const tiempo = new Map<number, { suma: number; n: number }>();
    for (const it of intentosPorNivel) {
      const num = numeroPorNivel.get(it.ejercicio.nivelId);
      if (!num) continue;
      const e = tiempo.get(num) ?? { suma: 0, n: 0 };
      e.suma += it.tiempoSeg; e.n++;
      tiempo.set(num, e);
    }

    return {
      total_estudiantes: estudiantes.length,
      niveles: niveles.map((n) => {
        const t = tiempo.get(n.numero);
        return {
          numero: n.numero, titulo: n.titulo, estudiantes: conteo.get(n.numero) ?? 0,
          tiempo_promedio_seg: t && t.n ? Math.round(t.suma / t.n) : 0,
        };
      }),
    };
  }

  // ── Actividad semanal del grupo (últimos 7 días) ──
  async actividadSemanal() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const desde = new Date(hoy); desde.setDate(hoy.getDate() - 6);
    const intentos = await this.prisma.intento.findMany({
      where: { fecha: { gte: desde } },
      select: { usuarioId: true, correcto: true, fecha: true },
    });

    const dias: { dia: string; intentos: number; aciertos: number; estudiantes_activos: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(desde); d.setDate(desde.getDate() + i);
      const sig = new Date(d); sig.setDate(d.getDate() + 1);
      const delDia = intentos.filter((it) => it.fecha >= d && it.fecha < sig);
      dias.push({
        dia: d.toISOString().slice(0, 10),
        intentos: delDia.length,
        aciertos: delDia.filter((it) => it.correcto).length,
        estudiantes_activos: new Set(delDia.map((it) => it.usuarioId)).size,
      });
    }
    return { dias };
  }

  // ── Export CSV pretest/postest (para la prueba t, fuera del sistema) ──
  async exportCsv(): Promise<string> {
    const { tabla } = await this.pretestPostest();
    const cols = ['usuario_id', 'nombre', 'grupo', 'puntaje_pretest', 'puntaje_postest', 'ganancia', 'categoria_mas_debil'];
    const filas = tabla.map((r) =>
      [
        r.id, `"${r.nombre.replace(/"/g, '""')}"`, r.grupo,
        r.pretest ?? '', r.postest ?? '', r.ganancia ?? '',
        r.categoria_mas_debil ? `"${r.categoria_mas_debil}"` : '',
      ].join(','),
    );
    return [cols.join(','), ...filas].join('\n');
  }
}
