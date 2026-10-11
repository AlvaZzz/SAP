import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ETIQUETA_NIVEL } from '../../common/niveles/nivel-dificultad';
import {
  BLOQUES_TENDENCIA, MIN_INTENTOS_TENDENCIA, clasificar, deltaMitades, promedio, redondear, trocear,
} from '../../common/estadistica/tendencia';

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
      avance: pre && post ? post.puntajeTotal - pre.puntajeTotal : null,
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

  /**
   * HÁBITOS DE ESTUDIO (proceso, no resultado): constancia, autonomía y
   * eficiencia. Alimenta el Bloque B de la vista de progreso.
   *
   * La TENDENCIA no se agrupa por calendario sino por BLOQUES del historial de
   * intentos del estudiante (quintiles cronológicos): con semanas naturales, un
   * estudiante que practica a ráfagas deja huecos y la tendencia no se puede
   * leer. Los bloques responden directamente a "¿conforme avanzo, cómo cambio?".
   */
  async habitos(usuarioId: number) {
    const [intentos, consultas, ranking] = await Promise.all([
      this.prisma.intento.findMany({
        where: { usuarioId }, orderBy: { fecha: 'asc' },
        select: { correcto: true, tiempoSeg: true, pistasUsadas: true, fecha: true },
      }),
      this.prisma.consultaIa.count({ where: { usuarioId } }),
      this.prisma.ranking.findUnique({ where: { usuarioId }, select: { rachaDias: true } }),
    ]);

    // ── Constancia: ejercicios resueltos por día (últimos 7, incluidos los de 0) ──
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const porDia = new Map<string, { resueltos: number; intentos: number }>();
    for (const it of intentos) {
      const k = it.fecha.toISOString().slice(0, 10);
      const e = porDia.get(k) ?? { resueltos: 0, intentos: 0 };
      e.intentos++; if (it.correcto) e.resueltos++;
      porDia.set(k, e);
    }
    const dias: { dia: string; resueltos: number; intentos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(hoy.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      dias.push({ dia: k, ...(porDia.get(k) ?? { resueltos: 0, intentos: 0 }) });
    }
    const diasActivos = dias.filter((d) => d.intentos > 0).length;

    // ── Serie por bloques (autonomía y eficiencia comparten el troceado) ──
    const bloques = trocear(intentos, BLOQUES_TENDENCIA);
    const serie = bloques.map((b, i) => {
      const conTiempo = b.filter((x) => x.tiempoSeg > 0);
      return {
        bloque: i + 1,
        n: b.length,
        pistas_por_ejercicio: redondear(promedio(b.map((x) => x.pistasUsadas)), 2),
        sin_pistas_pct: Math.round((b.filter((x) => x.pistasUsadas === 0).length / b.length) * 100),
        tasa_acierto: Math.round((b.filter((x) => x.correcto).length / b.length) * 100),
        // Sin tiempo registrado (intentos antiguos) el promedio se omite en vez
        // de contarse como 0, que hundiría la media.
        tiempo_medio_seg: conTiempo.length ? Math.round(promedio(conTiempo.map((x) => x.tiempoSeg))) : null,
      };
    });

    const hayTendencia = intentos.length >= MIN_INTENTOS_TENDENCIA;
    const conTiempoTotal = intentos.filter((x) => x.tiempoSeg > 0);

    return {
      constancia: {
        racha_dias: ranking?.rachaDias ?? 0,
        dias,
        dias_activos_semana: diasActivos,
      },
      autonomia: {
        total_pistas: intentos.reduce((s, x) => s + x.pistasUsadas, 0),
        total_consultas: consultas,
        sin_pistas_pct: intentos.length ? Math.round((intentos.filter((x) => x.pistasUsadas === 0).length / intentos.length) * 100) : 0,
        pistas_por_ejercicio: redondear(promedio(intentos.map((x) => x.pistasUsadas)), 2),
        serie: serie.map((s) => ({ bloque: s.bloque, n: s.n, pistas_por_ejercicio: s.pistas_por_ejercicio, sin_pistas_pct: s.sin_pistas_pct })),
        // delta < 0 = cada vez usa MENOS pistas = gana independencia.
        delta: hayTendencia ? redondear(deltaMitades(intentos.map((x) => x.pistasUsadas)), 2) : null,
        tendencia: hayTendencia ? clasificar(deltaMitades(intentos.map((x) => x.pistasUsadas)), 0.1, 'baja', 'sube') : 'sin_datos',
      },
      eficiencia: {
        tasa_acierto: intentos.length ? Math.round((intentos.filter((x) => x.correcto).length / intentos.length) * 100) : 0,
        tiempo_medio_seg: conTiempoTotal.length ? Math.round(promedio(conTiempoTotal.map((x) => x.tiempoSeg))) : null,
        total_intentos: intentos.length,
        serie: serie.map((s) => ({ bloque: s.bloque, n: s.n, tasa_acierto: s.tasa_acierto, tiempo_medio_seg: s.tiempo_medio_seg })),
        delta_tasa: hayTendencia ? Math.round(deltaMitades(intentos.map((x) => (x.correcto ? 100 : 0)))) : null,
        // El tiempo es INFORMACIÓN, no una meta: se reporta el delta pero el
        // cliente NO lo enmarca como "ir más rápido" (ver la vista de progreso).
        delta_tiempo_seg: hayTendencia && conTiempoTotal.length >= MIN_INTENTOS_TENDENCIA
          ? Math.round(deltaMitades(conTiempoTotal.map((x) => x.tiempoSeg)))
          : null,
        tendencia_tasa: hayTendencia ? clasificar(deltaMitades(intentos.map((x) => (x.correcto ? 100 : 0))), 3, 'baja', 'sube') : 'sin_datos',
      },
    };
  }

  /**
   * EVOLUCIÓN de la habilidad estimada (θ, IRT) del estudiante para el gráfico
   * "Tu evolución" del dashboard. Devuelve su serie completa de HistorialTheta
   * (pretest → práctica → subidas de nivel → postest) más el PROMEDIO DEL GRUPO
   * por semana ISO (agregado anónimo, solo para la línea punteada de comparación).
   */
  async evolucionTheta(usuarioId: number) {
    const claveSemana = (d: Date) => {
      // Semana ISO-8601 (el jueves define el año de la semana).
      const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
      const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
      const sem = Math.ceil(((t.getTime() - inicio.getTime()) / 86400000 + 1) / 7);
      return `${t.getUTCFullYear()}-S${String(sem).padStart(2, '0')}`;
    };

    const [propios, todos] = await Promise.all([
      this.prisma.historialTheta.findMany({
        where: { usuarioId },
        orderBy: { fecha: 'asc' },
        select: { theta: true, origen: true, n: true, fecha: true },
      }),
      this.prisma.historialTheta.findMany({ select: { theta: true, fecha: true } }),
    ]);

    const porSemana = new Map<string, { suma: number; n: number }>();
    for (const h of todos) {
      const k = claveSemana(h.fecha);
      const e = porSemana.get(k) ?? { suma: 0, n: 0 };
      e.suma += h.theta; e.n++;
      porSemana.set(k, e);
    }
    const grupo = [...porSemana.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, v]) => ({ semana, theta: Number((v.suma / v.n).toFixed(2)) }));

    return {
      serie: propios.map((h) => ({ theta: Number(h.theta.toFixed(2)), origen: h.origen, n: h.n, fecha: h.fecha, semana: claveSemana(h.fecha) })),
      grupo,
    };
  }

  // ── Export CSV del diagnóstico inicial y la evaluación final (uso docente) ──
  async exportCsv(): Promise<string> {
    const estudiantes = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante' },
      include: { evaluaciones: true },
      orderBy: { id: 'asc' },
    });

    const cols = ['usuario_id', 'nombre', 'paralelo', 'puntaje_pretest', 'tiempo_pretest_seg', 'puntaje_postest', 'tiempo_postest_seg'];
    const filas = estudiantes.map((u) => {
      const pre = u.evaluaciones.find((e) => e.tipo === 'pre');
      const post = u.evaluaciones.find((e) => e.tipo === 'post');
      return [
        u.id, `"${u.nombre.replace(/"/g, '""')}"`, u.paralelo ?? '',
        pre?.puntajeTotal ?? '', pre?.tiempoSeg ?? '',
        post?.puntajeTotal ?? '', post?.tiempoSeg ?? '',
      ].join(',');
    });

    return [cols.join(','), ...filas].join('\n');
  }
}
