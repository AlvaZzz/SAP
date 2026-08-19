import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { gananciaTheta } from '../../mediciones/irt/irt';
import { MIN_INTENTOS_TENDENCIA, deltaMitades, promedio, redondear } from '../../common/estadistica/tendencia';
import { calcularUso } from '../../common/estadistica/uso';
import {
  ITEMS as ITEMS_ENCUESTA, instrumentoCargado, itemPorCodigo, puntuar as puntuarItem,
} from '../../mediciones/encuesta/instrumento';

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
  // ── DOSIS DE LA INTERVENCIÓN (uso real de la plataforma) ──
  //  Sin esto la hipótesis es indefendible ante "¿y si el grupo experimental
  //  simplemente no usó el sistema?". Además habilita el análisis
  //  dosis-respuesta, que es el argumento causal más fuerte disponible sin
  //  aleatorización estricta. Ver common/estadistica/uso.ts.
  dias_activos: number;
  primer_dia: Date | null;
  ultimo_dia: Date | null;
  periodo_dias: number;
  sesiones: number;
  minutos_estimados: number;
  minutos_por_sesion: number;
  /** Días activos ÷ días del periodo: uso sostenido (→1) vs. atracón (→0). */
  regularidad: number | null;
  // ── MOTIVACIÓN ACADÉMICA (MSLQ, escala 1–7) ──
  //  null = NO respondió la encuesta. Es un dato faltante, nunca un cero: un 0
  //  significaría "motivación nula", que es una afirmación que nadie hizo.
  motivacion_pre: number | null;
  motivacion_post: number | null;
  motivacion_delta: number | null;
  /** Nº de veces que consultó el ranking (indicador conductual de competitividad). */
  consultas_ranking: number;
}

interface CatRaw { categoria: string; aciertos: number; total: number; porcentaje: number }

/**
 * Puntaje de motivación (MSLQ) de un estudiante en un momento: media de sus
 * ítems, con los inversos recodificados.
 *
 * Devuelve `null` —y no 0— cuando la encuesta está incompleta o no se respondió.
 * La distinción no es cosmética: un 0 afirmaría "motivación nula", que es una
 * afirmación que el estudiante nunca hizo, y contaminaría cualquier media de
 * grupo. Un dato faltante debe viajar como faltante hasta el análisis.
 */
function puntajeMotivacion(respuestas: { itemId: string; valor: number }[]): number | null {
  if (!instrumentoCargado() || respuestas.length < ITEMS_ENCUESTA.length) return null;
  let suma = 0;
  let n = 0;
  for (const r of respuestas) {
    const item = itemPorCodigo(r.itemId);
    if (!item) continue; // ítem de otra versión del instrumento
    suma += puntuarItem(item, r.valor);
    n++;
  }
  return n ? Math.round((suma / n) * 100) / 100 : null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  EXCLUSIÓN DE LAS CUENTAS DE DEMOSTRACIÓN  (candado 2 de 3)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  `prisma/seed-demo.ts` crea estudiantes SINTÉTICOS para poder probar y
 *  demostrar el sistema sin participantes reales. No son sujetos de la
 *  investigación y NO pueden aparecer en ningún resultado de la tesis.
 *
 *  Este filtro es el candado central: como TODAS las pantallas del rol
 *  investigador derivan de este servicio, excluirlos aquí los excluye de una
 *  sola vez de resultados, fiabilidad, inferencial, validez y exportaciones.
 *
 *  Los otros dos candados: (1) los datos se autoidentifican —correo bajo
 *  `@demo.prexi.local` e `institucion = 'DEMO'`— y (3) el Panel del
 *  investigador avisa de forma visible cuántas cuentas demo hay en la base.
 *
 *  Se comprueban AMBAS marcas (correo e institución) a propósito: si alguien
 *  editara una, la otra sigue excluyendo al registro.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const DOMINIO_DEMO = '@demo.prexi.local';
export const INSTITUCION_DEMO = 'DEMO';

/**
 * MODO DEMOSTRACIÓN — la única forma de que las cuentas sintéticas aparezcan.
 *
 * Se activa con la variable de entorno `PREXI_MODO_DEMO=1`, nunca desde la
 * interfaz. Existe porque los datos de demostración no sirven de nada si no se
 * pueden ver: permite poblar las pantallas para probarlas y tomar capturas del
 * sistema funcionando.
 *
 * Es deliberadamente incómodo de activar: no hay botón, no hay parámetro de URL
 * y no se puede encender por accidente desde el navegador. Requiere reiniciar el
 * backend con la variable puesta, que es una decisión consciente.
 *
 * Con el modo activo, el Panel muestra una advertencia permanente y el CSV se
 * descarga con "DEMOSTRACION" en el nombre del archivo, para que ninguna captura
 * ni exportación pueda confundirse con resultados del estudio.
 *
 * En producción NUNCA debe estar definida.
 */
export const MODO_DEMO = process.env.PREXI_MODO_DEMO === '1';

/**
 * Filtro Prisma: estudiantes del estudio. Excluye las cuentas de demostración
 * salvo que el modo demostración esté explícitamente activo.
 */
export const SOLO_ESTUDIANTES_DEL_ESTUDIO: Prisma.UsuarioWhereInput = MODO_DEMO
  ? { rol: 'estudiante' }
  : {
      rol: 'estudiante',
      // Cada marca se niega por separado (AND), no con `NOT: [a, b]`, que en
      // Prisma significa "no cumple AMBAS" y dejaría pasar a quien tuviera solo
      // una de las dos marcas — justo lo contrario de lo que se quiere.
      email: { not: { endsWith: DOMINIO_DEMO } },
      // TRAMPA DE SQL: `institucion` es NULLABLE, y `institucion <> 'DEMO'`
      // evalúa a NULL —no a TRUE— cuando el campo está vacío, así que un filtro
      // ingenuo descartaría a TODOS los estudiantes sin institución declarada.
      // Por eso se acepta explícitamente el caso nulo.
      OR: [
        { institucion: null },
        { institucion: { not: INSTITUCION_DEMO } },
      ],
    };

/** Matriz de respuestas por ítem, base del análisis de fiabilidad del instrumento. */
export interface MatrizRespuestas {
  /** Una fila por estudiante, una columna por ítem; true = acertó. */
  matriz: boolean[][];
  /** Ítems (columnas) en el mismo orden que la matriz. */
  items: { ejercicioId: number; titulo: string; categoria: string; dificultadB: number | null }[];
  /** id_anonimo de cada fila, en el mismo orden. */
  personas: string[];
}

/**
 * Exportación del estudio (rol investigador, SOLO LECTURA). Construye el dataset
 * consolidado y ANONIMIZADO (id_anonimo, sin nombres/correos/cédulas) desde la
 * actividad REAL registrada. Es la ÚNICA fuente de verdad: resultados, datos
 * complementarios, fiabilidad e inferencial derivan todos de este servicio; no
 * existen consultas paralelas que puedan contradecirlo.
 */
/**
 * Vida de la caché del dataset. Cinco minutos es el equilibrio: lo bastante
 * corto para que un dato nuevo aparezca solo en poco tiempo, y lo bastante
 * largo para que recorrer las ocho pantallas del rol no reconstruya el dataset
 * ocho veces seguidas.
 */
const CACHE_MS = 5 * 60_000;

@Injectable()
export class InvestigadorExportacionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ═══════════════════════════════════════════════════════════════════════
   *  CACHÉ DEL DATASET CANÓNICO
   * ═══════════════════════════════════════════════════════════════════════
   *
   *  `construirDataset()` está bien escrita (consultas en bloque, sin N+1),
   *  pero es cara: recorre usuarios, intentos, consultas, entregas, subidas y
   *  código. El problema no era la consulta sino la REPETICIÓN — las ocho
   *  pantallas del rol investigador la reconstruían entera cada una, y en la
   *  capa gratuita de Neon eso se nota.
   *
   *  Se guarda en memoria del proceso con vida corta. Es memoria del backend,
   *  no de la base: si el servicio se reinicia (cosa habitual en Render Free),
   *  simplemente se recalcula.
   *
   *  El investigador puede forzar el recálculo desde la interfaz, y la pantalla
   *  muestra la hora del último cálculo: es más honesto que un dato fresco
   *  silencioso, porque deja claro sobre qué momento se está mirando.
   */
  private cache: { datos: FilaDataset[]; calculadoEn: Date } | null = null;

  /** Momento del último cálculo, para mostrarlo junto a los datos. */
  get calculadoEn(): Date | null {
    return this.cache?.calculadoEn ?? null;
  }

  /** Descarta la caché: el próximo acceso reconstruye desde la base. */
  invalidarCache(): void {
    this.cache = null;
  }

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

  /**
   * Dataset completo, anonimizado, una fila por estudiante.
   *
   * Sirve la copia en caché mientras esté vigente. `forzar: true` la ignora y
   * reconstruye desde la base (lo usa el botón "Actualizar datos").
   */
  async construirDataset(forzar = false): Promise<FilaDataset[]> {
    if (!forzar && this.cache && Date.now() - this.cache.calculadoEn.getTime() < CACHE_MS) {
      return this.cache.datos;
    }
    const datos = await this.reconstruirDataset();
    this.cache = { datos, calculadoEn: new Date() };
    return datos;
  }

  /** Construcción real, siempre contra la base. No usar directamente. */
  private async reconstruirDataset(): Promise<FilaDataset[]> {
    const [estudiantes, intentos, consultas, entregas, subidas, codigos, fechasIntentos, rankings, encuesta] = await Promise.all([
      this.prisma.usuario.findMany({
        where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
        orderBy: { id: 'asc' },
        include: { ranking: true, evaluaciones: true },
      }),
      // Orden cronológico: las variables de TENDENCIA (autonomía/eficiencia)
      // comparan la segunda mitad del historial contra la primera.
      this.prisma.intento.findMany({
        orderBy: { fecha: 'asc' },
        select: { usuarioId: true, ejercicioId: true, correcto: true, tiempoSeg: true, pistasUsadas: true },
      }),
      this.prisma.consultaIa.findMany({ select: { usuarioId: true, tipo: true, fecha: true } }),
      this.prisma.retoUsuario.findMany({
        where: { estado: { not: 'sin_entregar' } },
        select: { usuarioId: true, entregadoEn: true },
      }),
      this.prisma.intentoSubidaNivel.findMany({ select: { usuarioId: true, aprobado: true } }),
      // Código guardado en el editor: es actividad real aunque no genere intento.
      this.prisma.codigoPractica.findMany({ select: { usuarioId: true, actualizadoEn: true } }),
      // Fechas de los intentos: base del cálculo de días activos y sesiones.
      this.prisma.intento.findMany({ select: { usuarioId: true, fecha: true } }),
      // Consulta del ranking: indicador conductual que la tesis promete medir.
      this.prisma.consultaRanking.findMany({ select: { usuarioId: true, fecha: true } }),
      // Motivación (MSLQ): puntaje total por estudiante en cada momento.
      this.prisma.respuestaEncuesta.findMany({
        select: { usuarioId: true, itemId: true, valor: true, momento: true },
      }),
    ]);

    // ── DOSIS: se juntan TODOS los eventos con marca temporal de cada usuario ──
    // Cuatro fuentes distintas de actividad, porque un estudiante que solo
    // consultó al tutor o guardó código estuvo usando el sistema igual que uno
    // que respondió ejercicios.
    const eventosPorUsuario = new Map<number, Date[]>();
    const anotar = (usuarioId: number, fecha: Date | null | undefined) => {
      if (!fecha) return;
      const xs = eventosPorUsuario.get(usuarioId) ?? [];
      xs.push(fecha);
      eventosPorUsuario.set(usuarioId, xs);
    };
    for (const it of fechasIntentos) anotar(it.usuarioId, it.fecha);
    for (const c of consultas) anotar(c.usuarioId, c.fecha);
    for (const r of entregas) anotar(r.usuarioId, r.entregadoEn);
    for (const c of codigos) anotar(c.usuarioId, c.actualizadoEn);
    for (const r of rankings) anotar(r.usuarioId, r.fecha);

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
    const rankingPorUsuario = new Map<number, number>();
    for (const r of rankings) rankingPorUsuario.set(r.usuarioId, (rankingPorUsuario.get(r.usuarioId) ?? 0) + 1);

    // Motivación: se puntúa solo a quien respondió el instrumento COMPLETO.
    const encuestaPorUsuario = new Map<number, { pre: { itemId: string; valor: number }[]; post: { itemId: string; valor: number }[] }>();
    for (const r of encuesta) {
      const e = encuestaPorUsuario.get(r.usuarioId) ?? { pre: [], post: [] };
      e[r.momento].push({ itemId: r.itemId, valor: r.valor });
      encuestaPorUsuario.set(r.usuarioId, e);
    }

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
      // Dosis: días activos, sesiones, regularidad… sobre TODOS sus eventos.
      const uso = calcularUso(eventosPorUsuario.get(u.id) ?? []);
      // Motivación: null si no respondió (dato faltante, nunca un cero).
      const enc = encuestaPorUsuario.get(u.id);
      const motivacionPre = enc ? puntajeMotivacion(enc.pre) : null;
      const motivacionPost = enc ? puntajeMotivacion(enc.post) : null;

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
        // ── Dosis de la intervención ──
        dias_activos: uso.dias_activos,
        primer_dia: uso.primer_dia,
        ultimo_dia: uso.ultimo_dia,
        periodo_dias: uso.periodo_dias,
        sesiones: uso.sesiones,
        minutos_estimados: uso.minutos_estimados,
        minutos_por_sesion: uso.minutos_por_sesion,
        regularidad: uso.regularidad,
        // ── Motivación (MSLQ) y competitividad ──
        motivacion_pre: motivacionPre,
        motivacion_post: motivacionPost,
        motivacion_delta: motivacionPre !== null && motivacionPost !== null
          ? Math.round((motivacionPost - motivacionPre) * 100) / 100
          : null,
        consultas_ranking: rankingPorUsuario.get(u.id) ?? 0,
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
      // Dosis de la intervención (uso real de la plataforma).
      'dias_activos', 'primer_dia', 'ultimo_dia', 'periodo_dias',
      'sesiones', 'minutos_estimados', 'minutos_por_sesion', 'regularidad',
      // Motivación (MSLQ) y competitividad.
      'motivacion_pre', 'motivacion_post', 'motivacion_delta', 'consultas_ranking',
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
      f.dias_activos,
      f.primer_dia ? f.primer_dia.toISOString().slice(0, 10) : null,
      f.ultimo_dia ? f.ultimo_dia.toISOString().slice(0, 10) : null,
      f.periodo_dias, f.sesiones, f.minutos_estimados, f.minutos_por_sesion, f.regularidad,
      f.motivacion_pre, f.motivacion_post, f.motivacion_delta, f.consultas_ranking,
    ].map(esc).join(','));
    return [cols.join(','), ...lineas].join('\n');
  }

  /**
   * MATRIZ DE RESPUESTAS POR ÍTEM (pretest o postest), anonimizada.
   *
   * Es la materia prima del análisis de fiabilidad: KR-20, dificultad y
   * discriminación por ítem, y ajuste al modelo de Rasch. Se construye aquí,
   * junto al resto del dataset, para que la fiabilidad NO salga de una consulta
   * paralela que pudiera discrepar de los demás resultados.
   *
   * Solo entra quien respondió el examen: un estudiante que no lo rindió no es
   * un cero, es un dato ausente, y meterlo como cero falsearía la dificultad de
   * todos los ítems. Se incluyen únicamente los ítems que ESE conjunto de
   * estudiantes respondió (una matriz rectangular completa, sin huecos).
   */
  async matrizRespuestas(tipo: 'pre' | 'post'): Promise<MatrizRespuestas> {
    const [estudiantes, respuestas] = await Promise.all([
      this.prisma.usuario.findMany({
        where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
        orderBy: { id: 'asc' },
        select: { id: true },
      }),
      this.prisma.pretestRespuesta.findMany({
        where: { tipo },
        select: {
          usuarioId: true, ejercicioId: true, correcto: true,
          ejercicio: { select: { titulo: true, categoria: true, dificultadB: true } },
        },
      }),
    ]);

    // id_anonimo estable: mismo criterio que `construirDataset` (orden por id).
    const anonimo = new Map<number, string>();
    estudiantes.forEach((u, i) => anonimo.set(u.id, `E-${String(i + 1).padStart(3, '0')}`));

    // Respuestas indexadas por persona×ítem.
    const porPersona = new Map<number, Map<number, boolean>>();
    const metaItem = new Map<number, { titulo: string; categoria: string; dificultadB: number | null }>();
    for (const r of respuestas) {
      if (!porPersona.has(r.usuarioId)) porPersona.set(r.usuarioId, new Map());
      porPersona.get(r.usuarioId)!.set(r.ejercicioId, r.correcto);
      if (!metaItem.has(r.ejercicioId)) {
        metaItem.set(r.ejercicioId, {
          titulo: r.ejercicio.titulo,
          categoria: r.ejercicio.categoria,
          dificultadB: r.ejercicio.dificultadB ?? null,
        });
      }
    }

    const personasIds = [...porPersona.keys()].sort((a, b) => a - b);
    if (personasIds.length === 0) return { matriz: [], items: [], personas: [] };

    // Solo los ítems respondidos por TODAS las personas incluidas: la matriz
    // debe ser completa para que KR-20 y la correlación ítem-total sean válidos.
    const itemsIds = [...metaItem.keys()]
      .filter((id) => personasIds.every((p) => porPersona.get(p)!.has(id)))
      .sort((a, b) => a - b);

    return {
      matriz: personasIds.map((p) => itemsIds.map((i) => porPersona.get(p)!.get(i) === true)),
      items: itemsIds.map((id) => ({ ejercicioId: id, ...metaItem.get(id)! })),
      personas: personasIds.map((p) => anonimo.get(p) ?? `E-?`),
    };
  }

  /**
   * DESEMPEÑO POR NIVEL DE ÍTEM de cada estudiante, anonimizado.
   *
   * Materia prima de la VALIDACIÓN DE LA CLASIFICACIÓN: permite comprobar si el
   * nivel asignado predice el desempeño posterior (validez predictiva). Se
   * construye aquí, junto al resto del dataset, para no abrir una fuente de
   * verdad paralela.
   *
   * Excluye los intentos de ejercicios del PRETEST: son los que produjeron la
   * clasificación, así que usarlos para validarla sería circular.
   */
  async desempenoPorNivelItem() {
    const [estudiantes, intentos] = await Promise.all([
      this.prisma.usuario.findMany({
        where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
        orderBy: { id: 'asc' },
        select: {
          id: true, grupo: true,
          nivelInicialAdaptativo: true, thetaInicial: true, thetaActual: true,
          progresoTemas: { select: { temaId: true, nivelActual: true } },
        },
      }),
      this.prisma.intento.findMany({
        where: { ejercicio: { banco: { not: 'pretest' } } },
        select: { usuarioId: true, correcto: true, ejercicio: { select: { nivelDificultad: true } } },
      }),
    ]);

    const porUsuario = new Map<number, Record<string, { aciertos: number; total: number }>>();
    for (const it of intentos) {
      const nivel = it.ejercicio.nivelDificultad;
      if (!nivel) continue;
      const e = porUsuario.get(it.usuarioId) ?? {};
      e[nivel] = e[nivel] ?? { aciertos: 0, total: 0 };
      e[nivel].total++;
      if (it.correcto) e[nivel].aciertos++;
      porUsuario.set(it.usuarioId, e);
    }

    return estudiantes.map((u, i) => {
      const d = porUsuario.get(u.id) ?? {};
      const tasa = (n: string) => (d[n]?.total ? d[n].aciertos / d[n].total : null);
      return {
        id_anonimo: `E-${String(i + 1).padStart(3, '0')}`,
        grupo: u.grupo,
        nivel_asignado: u.nivelInicialAdaptativo ?? null,
        theta_inicial: u.thetaInicial ?? null,
        theta_actual: u.thetaActual ?? null,
        // Niveles ALCANZADOS después, por tema: evidencia de movilidad.
        niveles_por_tema: u.progresoTemas.map((p) => p.nivelActual),
        tasa_basico: tasa('basico'),
        tasa_intermedio: tasa('intermedio'),
        tasa_avanzado: tasa('avanzado'),
        intentos_basico: d['basico']?.total ?? 0,
        intentos_intermedio: d['intermedio']?.total ?? 0,
        intentos_avanzado: d['avanzado']?.total ?? 0,
      };
    });
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
      where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
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
      where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
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
      where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
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
