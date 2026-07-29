import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { gananciaTheta } from '../../mediciones/irt/irt';
import { MIN_INTENTOS_TENDENCIA, deltaMitades, promedio, redondear } from '../../common/estadistica/tendencia';

/** Puntajes por categoría temática (0-100) del pretest o postest. */
export interface PorCategoria {
  variables: number | null;
  condicionales: number | null;
  bucles: number | null;
  funciones: number | null;
  estructuras: number | null;
}

/** Fila ANONIMIZADA del dataset del estudio (una por estudiante). */
export interface FilaDataset {
  id_anonimo: string;
  grupo: 'control' | 'experimental';
  institucion: string;
  paralelo: string;
  // Nivel adaptativo inicial PERMANENTE (Básico/Intermedio/Avanzado) del pretest.
  nivel_inicial: string | null;
  // Habilidad estimada por IRT (modelo de Rasch), en logits:
  //  θ_inicial (pretest), θ_final (postest) y Δθ = θ_final − θ_inicial.
  //  Complementa la ganancia en puntaje con la ganancia en habilidad estimada.
  theta_inicial: number | null;
  theta_final: number | null;
  delta_theta: number | null;
  // Evidencia de la ruta adaptativa: intentos de subir de nivel y cuántos aprobó.
  subidas_nivel_intentos: number;
  subidas_nivel_aprobadas: number;
  pretest_total: number | null;
  postest_total: number | null;
  ganancia: number | null;
  pre: PorCategoria;
  post: PorCategoria;
  tiempo_pretest: number | null;
  tiempo_postest: number | null;
  ejercicios_resueltos: number;
  tiempo_promedio_ejercicio: number;
  xp_total: number;
  racha: number;
  consultas_ia: number;
  pistas_usadas: number;
  retos_entregados: number;
  // ── Hábitos de estudio (proceso) ──
  //  Mismos indicadores que el estudiante ve en su vista de progreso, para poder
  //  cruzarlos con la ganancia. Los *_delta comparan la segunda mitad de su
  //  historial de intentos contra la primera; null si aún no hay suficientes.
  intentos_totales: number;
  tasa_acierto: number;
  pistas_por_ejercicio: number;
  sin_pistas_pct: number;
  /** Negativo = pasó a necesitar MENOS pistas (más autonomía). */
  autonomia_delta: number | null;
  tasa_acierto_delta: number | null;
  tiempo_medio_delta: number | null;
}

interface CatRaw { categoria: string; aciertos: number; total: number; porcentaje: number }

/**
 * Exportación del estudio (rol investigador, SOLO LECTURA). Construye el dataset
 * consolidado y ANONIMIZADO (id_anonimo, sin nombres/correos/cédulas) desde la
 * actividad REAL registrada. Es la ÚNICA fuente de verdad: resultados y datos
 * complementarios reutilizan `construirDataset()`. La estadística inferencial
 * (prueba t) se hace fuera del sistema con este CSV.
 */
@Injectable()
export class InvestigadorExportacionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Normaliza el nombre de categoría del banco a una de las 5 áreas del estudio. */
  private claveCategoria(nombre: string): keyof PorCategoria | null {
    const n = nombre.toLowerCase();
    if (n.includes('variable')) return 'variables';
    if (n.includes('condicional')) return 'condicionales';
    if (n.includes('bucle')) return 'bucles';
    if (n.includes('funci')) return 'funciones';
    if (['arreglo', 'estructura', 'lista', 'diccionario', 'tupla', 'conjunto'].some((k) => n.includes(k)))
      return 'estructuras';
    return null; // 'General' u otras: solo cuentan para el total.
  }

  private agregarPorCategoria(json: unknown): PorCategoria {
    const cats: CatRaw[] = Array.isArray(json) ? (json as CatRaw[]) : [];
    const acc: Record<keyof PorCategoria, { aciertos: number; total: number }> = {
      variables: { aciertos: 0, total: 0 }, condicionales: { aciertos: 0, total: 0 },
      bucles: { aciertos: 0, total: 0 }, funciones: { aciertos: 0, total: 0 },
      estructuras: { aciertos: 0, total: 0 },
    };
    for (const c of cats) {
      const k = this.claveCategoria(c.categoria);
      if (!k) continue;
      acc[k].aciertos += c.aciertos ?? 0;
      acc[k].total += c.total ?? 0;
    }
    const pct = (v: { aciertos: number; total: number }) => (v.total ? Math.round((v.aciertos / v.total) * 100) : null);
    return {
      variables: pct(acc.variables), condicionales: pct(acc.condicionales), bucles: pct(acc.bucles),
      funciones: pct(acc.funciones), estructuras: pct(acc.estructuras),
    };
  }

  /** Dataset completo, anonimizado, una fila por estudiante. */
  async construirDataset(): Promise<FilaDataset[]> {
    const [estudiantes, intentos, consultas, entregas, subidas] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { rol: 'estudiante' },
        orderBy: { id: 'asc' },
        include: { ranking: true, evaluaciones: true },
      }),
      // Orden cronológico: las variables de TENDENCIA (autonomía/eficiencia)
      // comparan la segunda mitad del historial contra la primera.
      this.prisma.intento.findMany({
        orderBy: { fecha: 'asc' },
        select: { usuarioId: true, ejercicioId: true, correcto: true, tiempoSeg: true, pistasUsadas: true },
      }),
      this.prisma.consultaIa.findMany({ select: { usuarioId: true, tipo: true } }),
      this.prisma.retoUsuario.findMany({ where: { estado: { not: 'sin_entregar' } }, select: { usuarioId: true } }),
      this.prisma.intentoSubidaNivel.findMany({ select: { usuarioId: true, aprobado: true } }),
    ]);

    // Agregados por usuario (una pasada; evita N+1).
    const porUsuario = new Map<number, { correctos: Set<number>; tiempoSum: number; tiempoN: number }>();
    // Historial cronológico por usuario: base de las variables de tendencia.
    const historial = new Map<number, { correcto: boolean; tiempoSeg: number; pistasUsadas: number }[]>();
    for (const it of intentos) {
      const e = porUsuario.get(it.usuarioId) ?? { correctos: new Set<number>(), tiempoSum: 0, tiempoN: 0 };
      if (it.correcto) {
        e.correctos.add(it.ejercicioId);
        if (it.tiempoSeg > 0) { e.tiempoSum += it.tiempoSeg; e.tiempoN++; }
      }
      porUsuario.set(it.usuarioId, e);

      const h = historial.get(it.usuarioId) ?? [];
      h.push({ correcto: it.correcto, tiempoSeg: it.tiempoSeg, pistasUsadas: it.pistasUsadas });
      historial.set(it.usuarioId, h);
    }
    const consultasPorUsuario = new Map<number, { total: number; pistas: number }>();
    for (const c of consultas) {
      const e = consultasPorUsuario.get(c.usuarioId) ?? { total: 0, pistas: 0 };
      e.total++; if (c.tipo === 'pista') e.pistas++;
      consultasPorUsuario.set(c.usuarioId, e);
    }
    const entregasPorUsuario = new Map<number, number>();
    for (const r of entregas) entregasPorUsuario.set(r.usuarioId, (entregasPorUsuario.get(r.usuarioId) ?? 0) + 1);
    const subidasPorUsuario = new Map<number, { intentos: number; aprobadas: number }>();
    for (const s of subidas) {
      const e = subidasPorUsuario.get(s.usuarioId) ?? { intentos: 0, aprobadas: 0 };
      e.intentos++; if (s.aprobado) e.aprobadas++;
      subidasPorUsuario.set(s.usuarioId, e);
    }

    return estudiantes.map((u, i) => {
      const pre = u.evaluaciones.find((e) => e.tipo === 'pre');
      const post = u.evaluaciones.find((e) => e.tipo === 'post');
      const agg = porUsuario.get(u.id) ?? { correctos: new Set<number>(), tiempoSum: 0, tiempoN: 0 };
      const cIa = consultasPorUsuario.get(u.id) ?? { total: 0, pistas: 0 };
      const sub = subidasPorUsuario.get(u.id) ?? { intentos: 0, aprobadas: 0 };

      // ── Hábitos (mismos indicadores que ve el estudiante en su progreso) ──
      const h = historial.get(u.id) ?? [];
      const conTiempo = h.filter((x) => x.tiempoSeg > 0);
      const hayTendencia = h.length >= MIN_INTENTOS_TENDENCIA;

      return {
        id_anonimo: `E-${String(i + 1).padStart(3, '0')}`,
        grupo: u.grupo,
        institucion: u.institucion ?? 'Sin institución',
        paralelo: u.paralelo ?? 'Sin paralelo',
        nivel_inicial: u.nivelInicialAdaptativo ?? null,
        theta_inicial: u.thetaInicial ?? null,
        theta_final: u.thetaFinal ?? null,
        delta_theta: gananciaTheta(u.thetaInicial ?? null, u.thetaFinal ?? null),
        subidas_nivel_intentos: sub.intentos,
        subidas_nivel_aprobadas: sub.aprobadas,
        pretest_total: pre?.puntajeTotal ?? null,
        postest_total: post?.puntajeTotal ?? null,
        ganancia: pre && post ? post.puntajeTotal - pre.puntajeTotal : null,
        pre: this.agregarPorCategoria(pre?.porCategoria),
        post: this.agregarPorCategoria(post?.porCategoria),
        tiempo_pretest: pre?.tiempoSeg ?? null,
        tiempo_postest: post?.tiempoSeg ?? null,
        ejercicios_resueltos: agg.correctos.size,
        tiempo_promedio_ejercicio: agg.tiempoN ? Math.round(agg.tiempoSum / agg.tiempoN) : 0,
        xp_total: u.ranking?.xpTotal ?? 0,
        racha: u.ranking?.rachaDias ?? 0,
        consultas_ia: cIa.total,
        pistas_usadas: cIa.pistas,
        retos_entregados: entregasPorUsuario.get(u.id) ?? 0,
        // ── Variables de HÁBITOS para el análisis complementario ──
        //  Permiten cruzar proceso (constancia/autonomía/eficiencia) con la
        //  ganancia pretest→postest. Los *_delta comparan la segunda mitad del
        //  historial de intentos contra la primera: negativo en autonomía =
        //  el estudiante pasó a necesitar menos pistas.
        intentos_totales: h.length,
        tasa_acierto: h.length ? Math.round((h.filter((x) => x.correcto).length / h.length) * 100) : 0,
        pistas_por_ejercicio: redondear(promedio(h.map((x) => x.pistasUsadas)), 2),
        sin_pistas_pct: h.length ? Math.round((h.filter((x) => x.pistasUsadas === 0).length / h.length) * 100) : 0,
        autonomia_delta: hayTendencia ? redondear(deltaMitades(h.map((x) => x.pistasUsadas)), 2) : null,
        tasa_acierto_delta: hayTendencia ? Math.round(deltaMitades(h.map((x) => (x.correcto ? 100 : 0)))) : null,
        tiempo_medio_delta: hayTendencia && conTiempo.length >= MIN_INTENTOS_TENDENCIA
          ? Math.round(deltaMitades(conTiempo.map((x) => x.tiempoSeg)))
          : null,
      };
    });
  }

  /** Serializa el dataset a CSV listo para pandas (celdas escapadas, encabezados claros). */
  async exportCsv(): Promise<string> {
    const filas = await this.construirDataset();
    const cols = [
      'id_anonimo', 'grupo', 'institucion', 'paralelo',
      'nivel_inicial', 'theta_inicial', 'theta_final', 'delta_theta',
      'subidas_nivel_intentos', 'subidas_nivel_aprobadas',
      'pretest_total', 'postest_total', 'ganancia',
      'pretest_variables', 'postest_variables',
      'pretest_condicionales', 'postest_condicionales',
      'pretest_bucles', 'postest_bucles',
      'pretest_funciones', 'postest_funciones',
      'pretest_estructuras', 'postest_estructuras',
      'tiempo_pretest', 'tiempo_postest',
      'ejercicios_resueltos', 'tiempo_promedio_ejercicio',
      'xp_total', 'racha', 'consultas_ia', 'pistas_usadas', 'retos_entregados',
      // Hábitos (proceso) — para cruzarlos con la ganancia.
      'intentos_totales', 'tasa_acierto', 'pistas_por_ejercicio', 'sin_pistas_pct',
      'autonomia_delta', 'tasa_acierto_delta', 'tiempo_medio_delta',
    ];
    const esc = (v: string | number | null): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = filas.map((f) => [
      f.id_anonimo, f.grupo, f.institucion, f.paralelo,
      f.nivel_inicial, f.theta_inicial, f.theta_final, f.delta_theta,
      f.subidas_nivel_intentos, f.subidas_nivel_aprobadas,
      f.pretest_total, f.postest_total, f.ganancia,
      f.pre.variables, f.post.variables,
      f.pre.condicionales, f.post.condicionales,
      f.pre.bucles, f.post.bucles,
      f.pre.funciones, f.post.funciones,
      f.pre.estructuras, f.post.estructuras,
      f.tiempo_pretest, f.tiempo_postest,
      f.ejercicios_resueltos, f.tiempo_promedio_ejercicio,
      f.xp_total, f.racha, f.consultas_ia, f.pistas_usadas, f.retos_entregados,
      f.intentos_totales, f.tasa_acierto, f.pistas_por_ejercicio, f.sin_pistas_pct,
      f.autonomia_delta, f.tasa_acierto_delta, f.tiempo_medio_delta,
    ].map(esc).join(','));
    return [cols.join(','), ...lineas].join('\n');
  }

  // ══════════════════ DATOS IRT PARA LA INVESTIGACIÓN ══════════════════

  /**
   * Dificultad b (modelo de Rasch) de cada ítem del banco. Dato para documentar
   * la calibración inicial de los ítems y su relación con el nivel/estrellas.
   */
  async itemsIrt() {
    const items = await this.prisma.ejercicio.findMany({
      orderBy: [{ banco: 'asc' }, { id: 'asc' }],
      select: {
        id: true, titulo: true, categoria: true, banco: true,
        estrellas: true, nivelDificultad: true, dificultadB: true,
      },
    });
    return items.map((e) => ({
      ejercicio_id: e.id,
      titulo: e.titulo,
      categoria: e.categoria,
      banco: e.banco,
      estrellas: e.estrellas,
      nivel_dificultad: e.nivelDificultad,
      dificultad_b: e.dificultadB,
    }));
  }

  /**
   * DIAGNÓSTICO INICIAL DESGLOSADO POR TEMA, anonimizado. Una fila por
   * estudiante×tema: nivel inicial, θ (IRT), puntaje y aciertos del tema. Permite
   * segmentar el desempeño del ANTES por área (no solo global), para un análisis
   * más fino del pre/post. Fuente: DiagnosticoTema (permanente).
   */
  async diagnosticoTemas() {
    const estudiantes = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante' },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        diagnosticoTemas: {
          include: { tema: { select: { numero: true, titulo: true, unidad: { select: { numero: true, titulo: true } } } } },
          orderBy: { temaId: 'asc' },
        },
      },
    });
    const filas: {
      id_anonimo: string; unidad: number; unidad_titulo: string; tema: string; tema_titulo: string;
      nivel_inicial: string; theta: number | null; puntaje: number; aciertos: number; total: number;
    }[] = [];
    estudiantes.forEach((u, i) => {
      const idAnon = `E-${String(i + 1).padStart(3, '0')}`;
      for (const d of u.diagnosticoTemas) {
        filas.push({
          id_anonimo: idAnon,
          unidad: d.tema.unidad.numero,
          unidad_titulo: d.tema.unidad.titulo,
          tema: d.tema.numero,
          tema_titulo: d.tema.titulo,
          nivel_inicial: d.nivel,
          theta: d.theta ?? null,
          puntaje: d.puntaje,
          aciertos: d.aciertos,
          total: d.total,
        });
      }
    });
    return filas;
  }

  /** CSV del diagnóstico por tema (una fila por estudiante×tema). */
  async diagnosticoTemasCsv(): Promise<string> {
    const filas = await this.diagnosticoTemas();
    const cols = ['id_anonimo', 'unidad', 'unidad_titulo', 'tema', 'tema_titulo', 'nivel_inicial', 'theta', 'puntaje', 'aciertos', 'total'];
    const esc = (v: string | number | null): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = filas.map((f) =>
      [f.id_anonimo, f.unidad, f.unidad_titulo, f.tema, f.tema_titulo, f.nivel_inicial, f.theta, f.puntaje, f.aciertos, f.total].map(esc).join(','),
    );
    return [cols.join(','), ...lineas].join('\n');
  }

  /**
   * EXÁMENES DE FIN DE UNIDAD, anonimizado. Una fila por estudiante×intento:
   * unidad, nº de intento, θ (IRT), nivel de dominio, puntaje, aprobado y fecha.
   * Complementa el análisis del progreso (avance interno entre unidades).
   */
  async examenesUnidad() {
    const estudiantes = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante' },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        examenesUnidad: {
          include: { unidad: { select: { numero: true, titulo: true } } },
          orderBy: { fecha: 'asc' },
        },
      },
    });
    const filas: {
      id_anonimo: string; unidad: number; unidad_titulo: string; intento: number;
      theta: number | null; nivel: string; puntaje: number; aprobado: boolean; fecha: Date;
    }[] = [];
    estudiantes.forEach((u, i) => {
      const idAnon = `E-${String(i + 1).padStart(3, '0')}`;
      // Numera el intento por unidad (1, 2, …) en orden cronológico.
      const contadorPorUnidad = new Map<number, number>();
      for (const e of u.examenesUnidad) {
        const n = (contadorPorUnidad.get(e.unidadId) ?? 0) + 1;
        contadorPorUnidad.set(e.unidadId, n);
        filas.push({
          id_anonimo: idAnon,
          unidad: e.unidad.numero,
          unidad_titulo: e.unidad.titulo,
          intento: n,
          theta: e.theta ?? null,
          nivel: e.nivel,
          puntaje: e.puntaje,
          aprobado: e.aprobado,
          fecha: e.fecha,
        });
      }
    });
    return filas;
  }

  /** CSV de los exámenes de fin de unidad (una fila por estudiante×intento). */
  async examenesUnidadCsv(): Promise<string> {
    const filas = await this.examenesUnidad();
    const cols = ['id_anonimo', 'unidad', 'unidad_titulo', 'intento', 'theta', 'nivel', 'puntaje', 'aprobado', 'fecha'];
    const esc = (v: string | number | boolean | Date | null): string => {
      if (v === null || v === undefined) return '';
      const s = v instanceof Date ? v.toISOString() : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = filas.map((f) =>
      [f.id_anonimo, f.unidad, f.unidad_titulo, f.intento, f.theta, f.nivel, f.puntaje, f.aprobado, f.fecha].map(esc).join(','),
    );
    return [cols.join(','), ...lineas].join('\n');
  }

  /**
   * Evolución de θ (habilidad estimada por IRT) de cada estudiante a lo largo del
   * uso, ANONIMIZADA. Una fila por punto de re-estimación (pretest, práctica,
   * subida de nivel, postest), en orden cronológico.
   */
  async evolucionTheta() {
    const estudiantes = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante' },
      orderBy: { id: 'asc' },
      select: { id: true, historialTheta: { orderBy: { fecha: 'asc' } } },
    });
    const filas: { id_anonimo: string; theta: number; origen: string; n: number; fecha: Date }[] = [];
    estudiantes.forEach((u, i) => {
      const idAnon = `E-${String(i + 1).padStart(3, '0')}`;
      for (const h of u.historialTheta) {
        filas.push({ id_anonimo: idAnon, theta: h.theta, origen: h.origen, n: h.n, fecha: h.fecha });
      }
    });
    return filas;
  }
}
