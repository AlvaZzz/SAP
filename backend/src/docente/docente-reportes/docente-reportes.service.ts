import { Injectable } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ETIQUETA_NIVEL, ORDEN_NIVEL, nivelDominioAgregado } from '../../common/niveles/nivel-dificultad';

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
          // SIN `grupo`: el docente debe permanecer ciego a la asignación
          // control/experimental (ver la nota al inicio del archivo).
          id: u.id, nombre: u.nombre,
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

  /* ══════════════════════════════════════════════════════════════════════
     DISTRIBUCIÓN DE ESTUDIANTES POR NIVEL ADAPTATIVO

     Esta función mostraba la distribución sobre el modelo VIEJO de niveles
     (`Nivel.numero`, 1 a 5): una gamificación plana, previa al diseño
     adaptativo, que el sistema ya no usa para adaptar nada y que la tesis no
     defiende. El docente veía "Nivel 1 … Nivel 5" mientras el motor real
     trabajaba con básico / intermedio / avanzado por tema.

     Ahora se calcula desde `ProgresoTema.nivelActual`, que ES el nivel con el
     que el sistema decide qué ejercicios sirve.

     POR QUÉ EL DOMINIO AGREGADO Y NO OTRA COSA: un estudiante no tiene "un"
     nivel, tiene uno POR TEMA (puede ir Avanzado en bucles y Básico en
     matrices). Para colocarlo en una sola barra hay que resumir, y se usa
     `nivelDominioAgregado` —el mismo helper que calcula el dominio que ve el
     estudiante en su vista de unidad—. Así el docente y el estudiante nunca
     ven cifras que se contradigan.

     Las dos alternativas descartadas, y por qué:
      · `Usuario.nivelInicialAdaptativo` — es la foto del PRETEST y no cambia
        nunca: mostraría el punto de partida, no el avance.
      · el máximo entre temas — premia un solo tema bueno y esconde el resto,
        justo lo contrario de lo que un docente necesita ver.

     Un estudiante SIN ningún `ProgresoTema` (no ha practicado) cuenta como
     Básico, igual que en el gate del examen de unidad: no haber empezado no
     puede valer lo mismo que haber trabajado hasta Intermedio.
     ══════════════════════════════════════════════════════════════════════ */
  async progresoNiveles() {
    const [estudiantes, intentos] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { rol: 'estudiante' },
        select: { id: true, progresoTemas: { select: { nivelActual: true } } },
      }),
      // Tiempo invertido por nivel ADAPTATIVO del ejercicio (no por su nivelId).
      this.prisma.intento.findMany({
        where: { correcto: true, tiempoSeg: { gt: 0 } },
        select: { tiempoSeg: true, ejercicio: { select: { nivelDificultad: true } } },
      }),
    ]);

    const conteo: Record<NivelDificultad, number> = { basico: 0, intermedio: 0, avanzado: 0 };
    for (const u of estudiantes) {
      const niveles = u.progresoTemas.map((p) => p.nivelActual);
      const { nivelDominio } = nivelDominioAgregado(niveles);
      conteo[nivelDominio]++;
    }

    const tiempo: Record<NivelDificultad, { suma: number; n: number }> = {
      basico: { suma: 0, n: 0 }, intermedio: { suma: 0, n: 0 }, avanzado: { suma: 0, n: 0 },
    };
    for (const it of intentos) {
      const n = it.ejercicio.nivelDificultad;
      tiempo[n].suma += it.tiempoSeg;
      tiempo[n].n++;
    }

    return {
      total_estudiantes: estudiantes.length,
      // `numero` se conserva (1-3) SOLO como orden para pintar las barras; ya no
      // es el número del modelo viejo. La clave real es `nivel`.
      niveles: (Object.keys(ORDEN_NIVEL) as NivelDificultad[]).map((n) => ({
        nivel: n,
        numero: ORDEN_NIVEL[n],
        titulo: ETIQUETA_NIVEL[n],
        estudiantes: conteo[n],
        tiempo_promedio_seg: tiempo[n].n ? Math.round(tiempo[n].suma / tiempo[n].n) : 0,
      })),
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

  /*
   * ── ELIMINADO: export CSV de pretest/postest por estudiante ──────────────
   *
   * Existía aquí un `exportCsv()` con las columnas
   *   usuario_id, nombre, GRUPO, puntaje_pretest, puntaje_postest, ganancia…
   * pensado como insumo para hacer la prueba t fuera del sistema.
   *
   * Se retiró el 2026-08-08 por dos razones:
   *
   *  1. REVELABA EL GRUPO del estudio, y encima en un archivo descargable que
   *     sobrevive fuera del sistema. El docente debe permanecer ciego a la
   *     asignación control/experimental.
   *  2. NO ERA UNA HERRAMIENTA PEDAGÓGICA. Un dataset de pretest/postest por
   *     estudiante sirve a la investigación, no a la enseñanza; y esa función
   *     ya la cubre el rol INVESTIGADOR con su CSV anonimizado, derivado del
   *     dataset canónico. Mantener ambos creaba una segunda fuente de verdad
   *     que podía contradecir a la primera.
   *
   * Quitarle solo la columna `grupo` habría dejado lo peor de las dos opciones:
   * un export a medias que sigue duplicando el dataset canónico.
   *
   * El docente conserva sus reportes de progreso, que es lo que necesita para
   * enseñar. Para analizar el estudio: rol investigador → Exportación.
   */
}
