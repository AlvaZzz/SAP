import { Injectable } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SOLO_ESTUDIANTES_DEL_ESTUDIO } from '../investigador-exportacion/investigador-exportacion.service';
import { InstrumentosService } from '../../mediciones/instrumentos/instrumentos.service';
import { ITEMS_SUS, VERSION_SUS, interpretarSus, puntajeSus } from '../../mediciones/instrumentos/sus';
import { puntuarCalidad } from '../../mediciones/calidad/calidad';
import {
  CARACTERISTICAS_ISO25010, INSTRUMENTO_VALIDADO, VERSION_ISO25010, itemsIso25010,
} from '../../mediciones/calidad/items-iso25010';
import { bootstrapIC, IntervaloBootstrap } from '../../common/estadistica/bootstrap';
import { alfaCronbach } from '../../common/estadistica/fiabilidad';
import { desviacion, media, mediana } from '../../common/estadistica/inferencia';
import { contrastarFrenteA, formatearP, MIN_CALCULO } from '../../common/estadistica/contraste';
import { percentilDe, porcentajePersonalizacion, rangoDesdeConfig } from '../../mediciones/motor/motor';
import { ETIQUETA_NIVEL, NIVELES } from '../../common/niveles/nivel-dificultad';

const r1 = (v: number | null): number | null => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const r2 = (v: number | null): number | null => (v === null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r3 = (v: number | null): number | null => (v === null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const aSegundos = (ms: number | null): number | null => (ms === null ? null : r3(ms / 1000));

/** IC de una PROPORCIÓN (serie 0/1), expresado en porcentaje con un decimal. */
function icPorcentaje(serie: number[]) {
  const ic = bootstrapIC(serie);
  return { ...ic, estimacion: r1(pct(ic.estimacion)), inferior: r1(pct(ic.inferior)), superior: r1(pct(ic.superior)) };
}
const pct = (v: number | null): number | null => (v === null ? null : v * 100);
const icRedondeado = (ic: IntervaloBootstrap) => ({
  ...ic, estimacion: r2(ic.estimacion), inferior: r2(ic.inferior), superior: r2(ic.superior),
});

/** Media, mediana y p95 de una serie de milisegundos, en SEGUNDOS. */
function resumenTiempos(ms: number[]) {
  return {
    n: ms.length,
    media_s: ms.length ? aSegundos(media(ms)) : null,
    mediana_s: ms.length ? aSegundos(mediana(ms)) : null,
    p95_s: aSegundos(percentilDe(ms, 0.95)),
    desviacion_s: ms.length > 1 ? aSegundos(desviacion(ms)) : null,
  };
}

const csvCelda = (v: string | number | boolean | Date | null | undefined): string => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const aCsv = (cols: string[], filas: (string | number | boolean | Date | null | undefined)[][]): string =>
  [cols.join(','), ...filas.map((f) => f.map(csvCelda).join(','))].join('\n');

/**
 * Umbral de la HIPÓTESIS de la tesis: rendimiento académico promedio ≥ 80/100 en
 * los exámenes de unidad. Es parte de la hipótesis formulada en el Capítulo I, no
 * un parámetro: por eso no se lee de la configuración.
 */
export const UMBRAL_HIPOTESIS = 80;

interface ExamenFila { usuarioId: number; unidadId: number; puntaje: number; fecha: Date; unidad: { numero: number; titulo: string } }

/**
 * El rendimiento se mide con el PRIMER intento de cada unidad. La tesis declara
 * un solo intento por examen; el sistema permite reintentar hasta aprobar, y
 * contar los reintentos inflaría el promedio con la nota del último intento.
 */
function primerosIntentos(examenes: ExamenFila[]): ExamenFila[] {
  const vistos = new Set<string>();
  const out: ExamenFila[] = [];
  for (const e of [...examenes].sort((a, b) => a.fecha.getTime() - b.fecha.getTime())) {
    const clave = `${e.usuarioId}:${e.unidadId}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(e);
  }
  return out;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PANEL DE VALIDACIÓN DEL SISTEMA (rol investigador, SOLO LECTURA)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Calcula exactamente los indicadores que declara la tesis (diseño no
 *  experimental transversal):
 *
 *   · Rendimiento académico → decide la HIPÓTESIS: promedio de los exámenes de
 *     unidad ≥ 80, con IC 95 % bootstrap y prueba de una muestra frente a 80.
 *   · Precisión del motor adaptativo → % de asignaciones en rango objetivo con
 *     IC 95 % por bootstrap, y latencia de reajuste.
 *   · Usabilidad percibida → puntaje medio SUS con IC 95 %.
 *   · Calidad del producto → media por característica ISO/IEC 25010 y % de
 *     subcaracterísticas en nivel aceptable.
 *   · Variable independiente (descriptiva) → personalización, retos completados,
 *     cambios de posición en el ranking y tiempo de retroalimentación.
 *   · Criterios de aceptación → los tres deben cumplirse de forma conjunta para
 *     validar el sistema como PRODUCTO. Complementan la hipótesis, no la deciden.
 *
 *  Sin datos NO se muestran cifras: los campos van en null y la pantalla lo dice.
 *  Fórmulas y tablas de origen: docs/DISENO_INVESTIGACION.md.
 * ═══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class InvestigadorValidacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly instrumentos: InstrumentosService,
  ) {}

  /** Estudiantes del estudio con su id anónimo (mismo correlativo que el dataset principal). */
  private async estudiantes() {
    const filas = await this.prisma.usuario.findMany({
      where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
      orderBy: { id: 'asc' },
      select: { id: true, paralelo: true, creadoEn: true, ranking: { select: { xpTotal: true, rachaDias: true } } },
    });
    return filas.map((u, i) => ({ ...u, id_anonimo: `E-${String(i + 1).padStart(3, '0')}` }));
  }

  private async examenes(ids: number[]): Promise<ExamenFila[]> {
    return this.prisma.examenUnidad.findMany({
      where: { usuarioId: { in: ids } },
      orderBy: { fecha: 'asc' },
      select: { usuarioId: true, unidadId: true, puntaje: true, fecha: true, unidad: { select: { numero: true, titulo: true } } },
    });
  }

  /**
   * RENDIMIENTO ACADÉMICO — la variable sobre la que se formuló la hipótesis.
   * Promedio por estudiante de sus exámenes de unidad (primer intento), y sobre
   * esos promedios: descriptivos, % ≥ 80, IC 95 % bootstrap de la media y el
   * contraste de una muestra frente a 80 (t de Student o Wilcoxon según
   * Shapiro-Wilk) con la d de Cohen.
   */
  private rendimiento(examenes: ExamenFila[], totalIntentos: number) {
    const primeros = primerosIntentos(examenes);
    const porEstudiante = new Map<number, number[]>();
    for (const e of primeros) porEstudiante.set(e.usuarioId, [...(porEstudiante.get(e.usuarioId) ?? []), e.puntaje]);
    const promedios = [...porEstudiante.values()].map((xs) => media(xs));

    const unidades = new Map<number, { unidad: number; titulo: string; notas: number[] }>();
    for (const e of primeros) {
      const u = unidades.get(e.unidadId) ?? { unidad: e.unidad.numero, titulo: e.unidad.titulo, notas: [] };
      u.notas.push(e.puntaje);
      unidades.set(e.unidadId, u);
    }
    const porUnidad = [...unidades.values()]
      .sort((a, b) => a.unidad - b.unidad)
      .map((u) => ({
        unidad: u.unidad,
        titulo: u.titulo,
        n: u.notas.length,
        media: r1(media(u.notas)),
        pct_80: r1((u.notas.filter((x) => x >= UMBRAL_HIPOTESIS).length / u.notas.length) * 100),
      }));

    const ic = bootstrapIC(promedios);
    const contraste = contrastarFrenteA(promedios, UMBRAL_HIPOTESIS, { variable: 'rendimiento académico' });
    const n = promedios.length;
    return {
      umbral: UMBRAL_HIPOTESIS,
      n_estudiantes: n,
      n_examenes: primeros.length,
      n_reintentos_excluidos: totalIntentos - primeros.length,
      media: n ? r1(media(promedios)) : null,
      mediana: n ? r1(mediana(promedios)) : null,
      desviacion: n > 1 ? r1(desviacion(promedios)) : null,
      min: n ? r1(Math.min(...promedios)) : null,
      max: n ? r1(Math.max(...promedios)) : null,
      pct_80: n ? r1((promedios.filter((x) => x >= UMBRAL_HIPOTESIS).length / n) * 100) : null,
      ic: { ...ic, estimacion: r1(ic.estimacion), inferior: r1(ic.inferior), superior: r1(ic.superior) },
      por_unidad: porUnidad,
      contraste: {
        calculado: contraste.calculado,
        bloqueo: contraste.bloqueo,
        interpretable: contraste.interpretable,
        advertencia: contraste.advertencia,
        prueba: contraste.prueba,
        justificacion: contraste.justificacion,
        normalidad: contraste.supuestos[0] ?? null,
        estadistico: contraste.resultado ? r3(contraste.resultado.estadistico) : null,
        gl: contraste.resultado?.gl ?? null,
        p: contraste.resultado ? r3(contraste.resultado.p) : null,
        p_texto: contraste.resultado ? formatearP(contraste.resultado.p) : null,
        d_cohen: contraste.efecto ? r2(contraste.efecto.d) : null,
        magnitud: contraste.efecto && Number.isFinite(contraste.efecto.d) ? contraste.efecto.magnitud : null,
        interpretacion: contraste.interpretacion,
      },
      como_se_calcula:
        'Para cada estudiante se promedian las notas (0–100) de sus exámenes de unidad, tomando solo el PRIMER ' +
        'intento de cada unidad. La hipótesis se acepta si la media de esos promedios es ≥ 80. Como apoyo se da el ' +
        'IC 95 % de la media (bootstrap) y una prueba de una muestra frente a 80: t de Student si Shapiro-Wilk no ' +
        'rechaza la normalidad, rangos con signo de Wilcoxon si la rechaza (α = 0,05).',
    };
  }

  private async logs(ids: number[]) {
    return this.prisma.logAdaptacion.findMany({
      where: { usuarioId: { in: ids } },
      orderBy: { id: 'asc' },
      include: { tema: { select: { numero: true, titulo: true } } },
    });
  }

  async resumen() {
    const [estudiantes, cfg] = await Promise.all([
      this.estudiantes(),
      this.prisma.configuracionSistema.findUnique({ where: { id: 1 } }),
    ]);
    const ids = estudiantes.map((e) => e.id);
    const idSet = new Set(ids);

    const [logs, examenes, susPorPersona, isoPorPersona, retosCompletados, cambiosRanking, consultasRanking] = await Promise.all([
      this.logs(ids),
      this.examenes(ids),
      this.instrumentos.respuestasPorPersona('SUS'),
      this.instrumentos.respuestasPorPersona('ISO25010'),
      this.prisma.retoUsuario.count({ where: { usuarioId: { in: ids }, resuelto: true } }),
      // Solo cambios REALES: la primera entrada al ranking (posicionAntes null) no es un cambio.
      this.prisma.historialRanking.count({ where: { usuarioId: { in: ids }, posicionAntes: { not: null } } }),
      this.prisma.consultaRanking.count({ where: { usuarioId: { in: ids } } }),
    ]);

    // ── Muestra y período de uso ──
    const conActividad = new Set(logs.map((l) => l.usuarioId)).size;
    const paralelos = [...new Set(estudiantes.map((e) => e.paralelo ?? 'Sin paralelo'))].sort();
    const muestra = {
      institucion: cfg?.institucion ?? 'UPEA',
      n_estudiantes: estudiantes.length,
      n_con_actividad: conActividad,
      paralelos,
      periodo: {
        inicio: logs.length ? logs[0].fecha : null,
        fin: logs.length ? logs[logs.length - 1].fecha : null,
      },
      fecha_corte: new Date(),
      n_decisiones_motor: logs.length,
    };

    // ── 1. PRECISIÓN DEL MOTOR ADAPTATIVO ──
    const rango = rangoDesdeConfig(cfg);
    const evaluables = logs.filter((l) => l.enRangoObjetivo !== null);
    const serieRango = evaluables.map((l) => (l.enRangoObjetivo ? 1 : 0));
    const proporcion = (xs: typeof evaluables) =>
      xs.length ? r1((xs.filter((l) => l.enRangoObjetivo).length / xs.length) * 100) : null;

    const porNivel = NIVELES.map((nivel: NivelDificultad) => {
      const xs = evaluables.filter((l) => l.nivelAntes === nivel);
      return { nivel, etiqueta: ETIQUETA_NIVEL[nivel], n: xs.length, pct_en_rango: proporcion(xs) };
    });

    const temas = new Map<number, { tema: string; titulo: string; filas: typeof evaluables }>();
    for (const l of evaluables) {
      if (l.temaId == null || !l.tema) continue;
      const t = temas.get(l.temaId) ?? { tema: l.tema.numero, titulo: l.tema.titulo, filas: [] };
      t.filas.push(l);
      temas.set(l.temaId, t);
    }
    const porTema = [...temas.values()]
      .map((t) => ({ tema: t.tema, titulo: t.titulo, n: t.filas.length, pct_en_rango: proporcion(t.filas) }))
      .sort((a, b) => a.tema.localeCompare(b.tema, 'es', { numeric: true }));

    const precision = {
      rango_objetivo: { min: rango.min, max: rango.max },
      n_asignaciones: logs.length,
      n_evaluables: evaluables.length,
      n_no_evaluables: logs.length - evaluables.length,
      en_rango: icPorcentaje(serieRango),
      latencia: resumenTiempos(logs.map((l) => l.latenciaMs)),
      por_nivel: porNivel,
      por_tema: porTema,
      como_se_calcula:
        'Una asignación está dentro del rango objetivo si la probabilidad de acierto esperada ' +
        'P = 1/(1+e^-(θ−b)), con la θ del estudiante antes de responder y la dificultad b del ejercicio ' +
        `asignado, cumple ${rango.min} ≤ P ≤ ${rango.max}. La latencia va desde que llega la respuesta ` +
        'hasta que el sistema tiene re-estimada la habilidad.',
    };

    // ── 2. USABILIDAD PERCIBIDA (SUS) ──
    const puntajes: number[] = [];
    for (const [usuarioId, respuestas] of susPorPersona) {
      if (!idSet.has(usuarioId)) continue; // cuentas de demostración, fuera del estudio
      const p = puntajeSus(respuestas);
      if (p !== null) puntajes.push(p);
    }
    const icSus = bootstrapIC(puntajes);
    const distribucion = ['Deficiente', 'Aceptable con reservas', 'Bueno', 'Excelente'].map((calificativo) => ({
      calificativo,
      n: puntajes.filter((p) => interpretarSus(p).calificativo === calificativo).length,
    }));
    const usabilidad = {
      version: VERSION_SUS,
      n_respuestas: puntajes.length,
      media: icRedondeado(icSus),
      desviacion: puntajes.length > 1 ? r2(desviacion(puntajes)) : null,
      min: puntajes.length ? Math.min(...puntajes) : null,
      max: puntajes.length ? Math.max(...puntajes) : null,
      interpretacion: icSus.estimacion === null ? null : interpretarSus(icSus.estimacion),
      distribucion,
      nota: 'El puntaje SUS va de 0 a 100 pero NO es un porcentaje. Escala adjetival adaptada de Bangor et al. (2009).',
    };

    // ── 3. CALIDAD DEL PRODUCTO (ISO/IEC 25010) ──
    const nivelAceptable = cfg?.nivelAceptableCalidad ?? 4;
    const evaluadores = [...isoPorPersona.values()];
    const cal = puntuarCalidad(evaluadores, nivelAceptable);
    const calidad = {
      version: VERSION_ISO25010,
      validado: INSTRUMENTO_VALIDADO,
      aviso: INSTRUMENTO_VALIDADO
        ? null
        : 'Los ítems del cuestionario son PROVISIONALES: aún no fueron validados por juicio de expertos. ' +
          'Estos resultados no deben reportarse en la tesis hasta cargar el instrumento validado.',
      n_evaluadores: cal.n_evaluadores,
      nivel_aceptable: nivelAceptable,
      caracteristicas: cal.caracteristicas.map((c) => {
        const def = CARACTERISTICAS_ISO25010.find((d) => d.clave === c.clave)!;
        const idsItems = def.subcaracteristicas.flatMap((s) => s.items.map((i) => i.id));
        // α de Cronbach de la característica (filas = evaluadores con todos sus ítems).
        const matriz = evaluadores
          .filter((r) => idsItems.every((id) => typeof r[id] === 'number'))
          .map((r) => idsItems.map((id) => r[id]));
        const alfa = alfaCronbach(matriz);
        return {
          clave: c.clave,
          nombre: c.nombre,
          n_items: c.n_items,
          media: c.media,
          ic: icRedondeado(bootstrapIC(c.por_evaluador)),
          aceptable: c.aceptable,
          alfa_cronbach: Number.isFinite(alfa.coeficiente) ? r2(alfa.coeficiente) : null,
          alfa_confiable: alfa.confiable,
          subcaracteristicas: c.subcaracteristicas,
        };
      }),
      subcaracteristicas_total: cal.subcaracteristicas_total,
      subcaracteristicas_aceptables: cal.subcaracteristicas_aceptables,
      pct_subcaracteristicas_aceptables: cal.pct_subcaracteristicas_aceptables,
      todas_aceptables: cal.todas_aceptables,
    };

    // ── VARIABLE INDEPENDIENTE (se describe, no se manipula) ──
    const personalizados = logs.filter((l) => l.personalizado).length;
    const variable_independiente = {
      adaptabilidad: {
        ejercicios_servidos: logs.length,
        personalizados,
        pct_personalizacion: porcentajePersonalizacion(personalizados, logs.length),
      },
      gamificacion: {
        retos_completados: retosCompletados,
        cambios_posicion_ranking: cambiosRanking,
        consultas_ranking: consultasRanking,
      },
      retroalimentacion: resumenTiempos(logs.map((l) => l.tiempoRespuestaMs)),
    };

    // ── CRITERIOS DE ACEPTACIÓN (los tres, de forma conjunta) ──
    const umbralPrecision = cfg?.criterioPrecisionMin ?? 70;
    const umbralSus = cfg?.criterioSusMin ?? 69;
    const limiteInferior = precision.en_rango.inferior;
    const mediaSus = usabilidad.media.estimacion;
    const criterios = [
      {
        criterio: 'Precisión del motor adaptativo',
        indicador: 'Límite inferior del IC 95 % de la proporción de asignaciones dentro del rango objetivo',
        umbral: `≥ ${umbralPrecision} %`,
        valor: limiteInferior === null ? null : `${limiteInferior} %`,
        cumple: limiteInferior === null ? null : limiteInferior >= umbralPrecision,
      },
      {
        criterio: 'Usabilidad percibida',
        indicador: 'Puntaje medio en la escala SUS',
        umbral: `≥ ${umbralSus} (rango "bueno")`,
        valor: mediaSus === null ? null : String(mediaSus),
        cumple: mediaSus === null ? null : mediaSus >= umbralSus,
      },
      {
        criterio: 'Calidad del producto de software',
        indicador: 'Valoración media por característica ISO/IEC 25010',
        umbral: `Todas las características ≥ ${nivelAceptable}`,
        valor: calidad.todas_aceptables === null
          ? null
          : `${calidad.caracteristicas.filter((c) => c.aceptable).length} de ${calidad.caracteristicas.length} características`,
        cumple: calidad.todas_aceptables,
      },
    ];
    const pendientes = criterios.filter((c) => c.cumple === null).length;
    const satisfechos = criterios.filter((c) => c.cumple === true).length;

    // ── HIPÓTESIS: se decide SOLO con el rendimiento académico (Tabla 26 de la tesis) ──
    const rendimiento = this.rendimiento(examenes, examenes.length);
    const hayRendimiento = rendimiento.n_estudiantes >= MIN_CALCULO && rendimiento.media !== null;
    const hipotesisAceptada = hayRendimiento ? rendimiento.media! >= UMBRAL_HIPOTESIS : null;
    const sistemaValidado = pendientes > 0 ? null : satisfechos === criterios.length;

    return {
      muestra,
      rendimiento,
      precision,
      usabilidad,
      calidad,
      variable_independiente,
      hipotesis: {
        enunciado:
          'El sistema permite que los estudiantes de primer semestre alcancen un rendimiento académico promedio ' +
          `igual o mayor a ${UMBRAL_HIPOTESIS} sobre 100 en los exámenes de cada unidad.`,
        indicador: 'Media de los promedios por estudiante en los exámenes de unidad (primer intento)',
        umbral: `≥ ${UMBRAL_HIPOTESIS}`,
        valor: rendimiento.media === null ? null : String(rendimiento.media),
        // null mientras no haya datos: no se declara ni aceptada ni rechazada.
        aceptada: hipotesisAceptada,
        motivo_sin_decision: hayRendimiento
          ? null
          : `Hacen falta exámenes de unidad de al menos ${MIN_CALCULO} estudiantes (hay ${rendimiento.n_estudiantes}).`,
        regla: `Se acepta la hipótesis cuando el rendimiento promedio es igual o superior a ${UMBRAL_HIPOTESIS}.`,
      },
      criterios: {
        filas: criterios,
        total: criterios.length,
        satisfechos,
        pendientes,
        // null mientras falte algún dato: no se declara validado ni no validado.
        sistema_validado: sistemaValidado,
        regla: 'El sistema queda validado como producto cuando los tres criterios se cumplen de forma conjunta. ' +
          'Estos criterios complementan la hipótesis; no la deciden.',
      },
    };
  }

  // ══════════════════ DATASETS ANONIMIZADOS (un CSV por instrumento) ══════════════════
  //  Listos para Python/Pandas/SciPy. Sin nombre, CI, RU ni correo: solo id anónimo.

  /** log_adaptacion: una fila por decisión del motor. */
  async logAdaptacionCsv(): Promise<string> {
    const estudiantes = await this.estudiantes();
    const anon = new Map(estudiantes.map((e) => [e.id, e]));
    const logs = await this.logs(estudiantes.map((e) => e.id));
    return aCsv(
      ['id_anonimo', 'paralelo', 'tema', 'ejercicio_id', 'theta_antes', 'theta_despues', 'dificultad_b', 'prob_acierto',
        'nivel_antes', 'nivel_despues', 'en_rango_objetivo', 'personalizado', 'correcto', 'latencia_ms',
        'tiempo_respuesta_ms', 'fecha'],
      logs.map((l) => [
        anon.get(l.usuarioId)?.id_anonimo, anon.get(l.usuarioId)?.paralelo, l.tema?.numero ?? null, l.ejercicioId,
        l.thetaAntes, l.thetaDespues, l.dificultadB, l.probAcierto, l.nivelAntes, l.nivelDespues,
        l.enRangoObjetivo, l.personalizado, l.correcto, l.latenciaMs, l.tiempoRespuestaMs, l.fecha,
      ]),
    );
  }

  /** sus: una fila por estudiante, con los 10 ítems crudos y el puntaje 0–100. */
  async susCsv(): Promise<string> {
    const estudiantes = await this.estudiantes();
    const respuestas = await this.instrumentos.respuestasPorPersona('SUS');
    const filas = estudiantes
      .filter((e) => respuestas.has(e.id))
      .map((e) => {
        const r = respuestas.get(e.id)!;
        return [e.id_anonimo, e.paralelo, ...ITEMS_SUS.map((i) => r[i.id] ?? null), puntajeSus(r), VERSION_SUS];
      });
    return aCsv(['id_anonimo', 'paralelo', ...ITEMS_SUS.map((i) => i.id), 'puntaje_sus', 'version'], filas);
  }

  /** iso25010: una fila por evaluador, con los ítems crudos y la media por característica. */
  async iso25010Csv(): Promise<string> {
    const respuestas = await this.instrumentos.respuestasPorPersona('ISO25010');
    const items = itemsIso25010();
    const filas = [...respuestas.keys()].sort((a, b) => a - b).map((usuarioId, i) => {
      const r = respuestas.get(usuarioId)!;
      const medias = CARACTERISTICAS_ISO25010.map((c) => {
        const vals = items.filter((it) => it.caracteristica === c.clave).map((it) => r[it.id]).filter((v) => typeof v === 'number');
        return vals.length ? r2(media(vals)) : null;
      });
      return [`D-${String(i + 1).padStart(3, '0')}`, ...items.map((it) => r[it.id] ?? null), ...medias, VERSION_ISO25010];
    });
    return aCsv(
      ['id_evaluador', ...items.map((i) => i.id), ...CARACTERISTICAS_ISO25010.map((c) => `media_${c.clave}`), 'version'],
      filas,
    );
  }

  /**
   * rendimiento_academico: una fila por estudiante que rindió algún examen de
   * unidad, con la nota del PRIMER intento de cada unidad y su promedio. Es el
   * archivo con el que se contrasta la hipótesis fuera del sistema.
   */
  async rendimientoCsv(): Promise<string> {
    const estudiantes = await this.estudiantes();
    const examenes = await this.examenes(estudiantes.map((e) => e.id));
    const primeros = primerosIntentos(examenes);
    const unidades = [...new Set(primeros.map((e) => e.unidad.numero))].sort((a, b) => a - b);
    const intentos = new Map<number, number>();
    for (const e of examenes) intentos.set(e.usuarioId, (intentos.get(e.usuarioId) ?? 0) + 1);

    const filas = estudiantes
      .map((est) => {
        const propios = primeros.filter((e) => e.usuarioId === est.id);
        if (!propios.length) return null;
        const nota = (u: number) => propios.find((e) => e.unidad.numero === u)?.puntaje ?? null;
        const prom = r1(media(propios.map((e) => e.puntaje)));
        return [
          est.id_anonimo, est.paralelo, propios.length, intentos.get(est.id) ?? 0,
          ...unidades.map(nota), prom, prom !== null && prom >= UMBRAL_HIPOTESIS,
        ];
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    return aCsv(
      ['id_anonimo', 'paralelo', 'n_examenes', 'n_intentos_totales', ...unidades.map((u) => `u${u}_primer_intento`),
        'promedio', 'alcanza_80'],
      filas,
    );
  }

  /** uso_gamificacion: una fila por estudiante con los indicadores de la variable independiente. */
  async usoGamificacionCsv(): Promise<string> {
    const estudiantes = await this.estudiantes();
    const ids = estudiantes.map((e) => e.id);
    const [logs, retos, cambios, consultas] = await Promise.all([
      this.prisma.logAdaptacion.findMany({
        where: { usuarioId: { in: ids } },
        select: { usuarioId: true, personalizado: true, tiempoRespuestaMs: true, latenciaMs: true },
      }),
      this.prisma.retoUsuario.groupBy({ by: ['usuarioId'], where: { usuarioId: { in: ids }, resuelto: true }, _count: { _all: true } }),
      this.prisma.historialRanking.groupBy({
        by: ['usuarioId'], where: { usuarioId: { in: ids }, posicionAntes: { not: null } }, _count: { _all: true },
      }),
      this.prisma.consultaRanking.groupBy({ by: ['usuarioId'], where: { usuarioId: { in: ids } }, _count: { _all: true } }),
    ]);
    const contar = (g: { usuarioId: number; _count: { _all: number } }[]) => new Map(g.map((x) => [x.usuarioId, x._count._all]));
    const mRetos = contar(retos);
    const mCambios = contar(cambios);
    const mConsultas = contar(consultas);

    return aCsv(
      ['id_anonimo', 'paralelo', 'ejercicios_servidos', 'ejercicios_personalizados', 'pct_personalizacion',
        'retos_completados', 'cambios_posicion_ranking', 'consultas_ranking', 'latencia_media_ms',
        'tiempo_retroalimentacion_medio_ms', 'xp_total', 'racha_dias'],
      estudiantes.map((e) => {
        const propios = logs.filter((l) => l.usuarioId === e.id);
        const pers = propios.filter((l) => l.personalizado).length;
        return [
          e.id_anonimo, e.paralelo, propios.length, pers, porcentajePersonalizacion(pers, propios.length),
          mRetos.get(e.id) ?? 0, mCambios.get(e.id) ?? 0, mConsultas.get(e.id) ?? 0,
          propios.length ? Math.round(media(propios.map((l) => l.latenciaMs))) : null,
          propios.length ? Math.round(media(propios.map((l) => l.tiempoRespuestaMs))) : null,
          e.ranking?.xpTotal ?? 0, e.ranking?.rachaDias ?? 0,
        ];
      }),
    );
  }
}
