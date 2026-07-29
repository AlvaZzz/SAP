import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmblemasService } from '../../gamificacion/emblemas.service';
import { RangosService } from '../../gamificacion/rangos.service';
import { estimarTheta, gananciaTheta, redondearTheta, RespuestaIrt } from '../irt/irt';

export const TOTAL_POSTEST = 20;

export interface ResultadoPostest {
  puntaje: number;
  aciertos: number;
  total: number;
  ganancia: number | null; // postest - pretest
  // Evidencia IRT del progreso: θ del postest, θ del pretest y Δθ = θ_final − θ_inicial.
  theta: number | null;
  theta_pre: number | null;
  ganancia_theta: number | null;
  por_categoria: { categoria: string; aciertos: number; total: number; porcentaje: number }[];
  fortalezas: string[];
  debilidades: string[];
  emblemas_nuevos?: { clave: string; nombre: string; descripcion: string; svgKey: string; icono: string }[];
}

/**
 * POSTEST — misma mecánica del pretest pero con el banco 'postest' (preguntas
 * distintas) y tipo='post'. Se desbloquea al completar un avance configurable
 * (ConfiguracionSistema.postestDesdeNivel). No modifica niveles ni XP: solo
 * recolecta datos de la investigación (ganancia = postest − pretest).
 */
@Injectable()
export class PostestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emblemas: EmblemasService,
    private readonly rangos: RangosService,
  ) {}

  /**
   * ¿El estudiante puede rendir el postest? El GATE PRINCIPAL es el control del
   * docente por paralelo (deshabilitado por defecto). Sin habilitación, no está
   * disponible aunque haya completado el avance.
   */
  async disponibilidad(usuarioId: number) {
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    const desdeNivel = cfg?.postestDesdeNivel ?? 3;
    const umbralPct = cfg?.umbralPorcentaje ?? 80;

    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { paralelo: true, repasoPostestCompletado: true } });
    const control = usuario?.paralelo
      ? await this.prisma.postestControl.findUnique({ where: { paralelo: usuario.paralelo } })
      : null;
    const habilitadoPorDocente = control?.habilitado ?? false;
    const repasoCompletado = usuario?.repasoPostestCompletado ?? false;

    const niveles = await this.prisma.nivel.findMany({
      orderBy: { numero: 'asc' },
      include: { progreso: { where: { usuarioId } } },
    });
    const completados = niveles.filter((n) => {
      const req = Math.ceil((n.umbral * umbralPct) / 100);
      return (n.progreso[0]?.ejerciciosCompletados ?? 0) >= req;
    }).length;

    // El docente decide cuándo abrir la evaluación final (switch), y el estudiante
    // debe haber revisado el REPASO de cierre. Ambos son gate del postest.
    return {
      disponible: habilitadoPorDocente && repasoCompletado,
      habilitadoPorDocente,
      repasoCompletado,
      desdeNivel,
      nivelesCompletados: completados,
    };
  }

  /** Las 5 unidades con su contenido de REPASO/cierre (una pestaña por unidad). */
  async repaso() {
    const unidades = await this.prisma.unidad.findMany({
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      select: { id: true, numero: true, titulo: true, repaso: true },
    });
    return unidades;
  }

  /** Marca el repaso del postest como revisado (idempotente). */
  async completarRepaso(usuarioId: number): Promise<{ completado: boolean }> {
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { repasoPostestCompletado: true } });
    return { completado: true };
  }

  async estado(usuarioId: number): Promise<{ disponible: boolean; habilitado: boolean; repasoCompletado: boolean; completado: boolean; desdeNivel: number; resultado: ResultadoPostest | null }> {
    const disp = await this.disponibilidad(usuarioId);
    const [evalPost, evalPre, u] = await Promise.all([
      this.prisma.evaluacion.findUnique({ where: { usuarioId_tipo: { usuarioId, tipo: 'post' } } }),
      this.prisma.evaluacion.findUnique({ where: { usuarioId_tipo: { usuarioId, tipo: 'pre' } } }),
      this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { thetaInicial: true, thetaFinal: true } }),
    ]);
    return {
      disponible: disp.disponible,
      habilitado: disp.habilitadoPorDocente,
      repasoCompletado: disp.repasoCompletado,
      completado: !!evalPost,
      desdeNivel: disp.desdeNivel,
      // El resultado de un postest COMPLETADO se lee del dato PERSISTIDO
      // (Evaluacion), no se recalcula desde pretest_respuestas (que pueden estar
      // vacías tras finalizar/seed y darían 0). calcular() solo se usa al finalizar.
      resultado: evalPost
        ? this.resultadoDesdeEvaluacion(evalPost, evalPre?.puntajeTotal ?? null, u?.thetaInicial ?? null, u?.thetaFinal ?? null)
        : null,
    };
  }

  /** Reconstruye el resultado a partir de la Evaluacion persistida (fuente de verdad). */
  private resultadoDesdeEvaluacion(
    evalPost: { puntajeTotal: number; porCategoria: unknown },
    prePuntaje: number | null,
    thetaPre: number | null = null,
    thetaPost: number | null = null,
  ): ResultadoPostest {
    const por = this.catsGuardadas(evalPost.porCategoria);
    const total = por.reduce((a, c) => a + c.total, 0) || TOTAL_POSTEST;
    const aciertos = por.reduce((a, c) => a + c.aciertos, 0);
    return {
      puntaje: evalPost.puntajeTotal,
      aciertos,
      total,
      ganancia: prePuntaje != null ? evalPost.puntajeTotal - prePuntaje : null,
      theta: thetaPost,
      theta_pre: thetaPre,
      ganancia_theta: gananciaTheta(thetaPre, thetaPost),
      por_categoria: por,
      fortalezas: por.filter((c) => c.porcentaje >= 60).map((c) => c.categoria),
      debilidades: por.filter((c) => c.porcentaje < 60).map((c) => c.categoria),
    };
  }

  private catsGuardadas(json: unknown): { categoria: string; aciertos: number; total: number; porcentaje: number }[] {
    return Array.isArray(json) ? (json as { categoria: string; aciertos: number; total: number; porcentaje: number }[]) : [];
  }

  /** Fija (una vez) y devuelve las 20 preguntas del postest del usuario. */
  async preguntas(usuarioId: number) {
    const disp = await this.disponibilidad(usuarioId);
    if (!disp.habilitadoPorDocente) throw new BadRequestException('La evaluación final estará disponible cuando tu docente la habilite.');
    if (!disp.repasoCompletado) throw new BadRequestException('Revisa el repaso de cierre antes de comenzar la evaluación final.');
    const yaHecho = await this.prisma.evaluacion.findUnique({ where: { usuarioId_tipo: { usuarioId, tipo: 'post' } } });
    if (yaHecho) throw new BadRequestException('Ya completaste el postest');

    // Fija el set de forma ATÓMICA y serializada por usuario (advisory lock):
    // evita el deadlock (40P01) ante peticiones concurrentes (React Strict Mode).
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(2, ${usuarioId}::int)`;
      const n = await tx.pretestRespuesta.count({ where: { usuarioId, tipo: 'post' } });
      if (n === 0) {
        const elegidas = await tx.$queryRaw<{ id: number; categoria: string }[]>(
          Prisma.sql`SELECT id, categoria FROM ejercicios WHERE banco = 'postest' ORDER BY random() LIMIT ${TOTAL_POSTEST}`,
        );
        await tx.pretestRespuesta.createMany({
          data: elegidas.map((e) => ({ usuarioId, ejercicioId: e.id, tipo: 'post' as const, categoria: e.categoria })),
          skipDuplicates: true,
        });
      }
    });

    const filas = await this.prisma.pretestRespuesta.findMany({
      where: { usuarioId, tipo: 'post' },
      orderBy: { ejercicioId: 'asc' },
      include: { ejercicio: { select: { id: true, categoria: true, estrellas: true, tipo: true, enunciado: true, codigoPython: true, opciones: true } } },
    });
    return filas.map((f) => ({ ...f.ejercicio, opcion_guardada: f.opcionDada || null }));
  }

  /** Autosave por respuesta (la corrección la evalúa el backend). */
  async responder(usuarioId: number, ejercicioId: number, opcion: string) {
    const fila = await this.prisma.pretestRespuesta.findUnique({
      where: { usuarioId_ejercicioId_tipo: { usuarioId, ejercicioId, tipo: 'post' } },
      include: { ejercicio: { select: { respuestaCorrecta: true } } },
    });
    if (!fila) throw new BadRequestException('La pregunta no pertenece a tu postest');
    const correcto = opcion.trim().toUpperCase() === fila.ejercicio.respuestaCorrecta.trim().toUpperCase();
    await this.prisma.pretestRespuesta.update({
      where: { usuarioId_ejercicioId_tipo: { usuarioId, ejercicioId, tipo: 'post' } },
      data: { opcionDada: opcion, correcto },
    });
    return { ok: true };
  }

  private async porCategoria(usuarioId: number) {
    const grupos = await this.prisma.pretestRespuesta.groupBy({
      by: ['categoria'], where: { usuarioId, tipo: 'post' }, _count: { _all: true },
    });
    const out: { categoria: string; aciertos: number; total: number; porcentaje: number }[] = [];
    for (const g of grupos) {
      const aciertos = await this.prisma.pretestRespuesta.count({ where: { usuarioId, tipo: 'post', categoria: g.categoria, correcto: true } });
      const total = g._count._all;
      out.push({ categoria: g.categoria, aciertos, total, porcentaje: total ? Math.round((aciertos / total) * 100) : 0 });
    }
    return out.sort((a, b) => a.categoria.localeCompare(b.categoria));
  }

  private async calcular(usuarioId: number): Promise<ResultadoPostest> {
    const por = await this.porCategoria(usuarioId);
    const total = por.reduce((a, c) => a + c.total, 0) || TOTAL_POSTEST;
    const aciertos = por.reduce((a, c) => a + c.aciertos, 0);
    const puntaje = Math.round((aciertos / total) * 100);
    const pre = await this.prisma.evaluacion.findUnique({ where: { usuarioId_tipo: { usuarioId, tipo: 'pre' } } });
    return {
      puntaje, aciertos, total,
      ganancia: pre ? puntaje - pre.puntajeTotal : null,
      theta: null, theta_pre: null, ganancia_theta: null, // se rellenan en finalizar()
      por_categoria: por,
      fortalezas: por.filter((c) => c.porcentaje >= 60).map((c) => c.categoria),
      debilidades: por.filter((c) => c.porcentaje < 60).map((c) => c.categoria),
    };
  }

  /**
   * Estima θ_final del estudiante desde las respuestas del POSTEST (MLE del
   * modelo de Rasch, ver src/irt). Null si no hay ítems con dificultad b válida.
   */
  private async estimarThetaPostest(usuarioId: number): Promise<{ theta: number; n: number } | null> {
    const filas = await this.prisma.pretestRespuesta.findMany({
      where: { usuarioId, tipo: 'post' },
      select: { correcto: true, ejercicio: { select: { dificultadB: true } } },
    });
    const respuestas: RespuestaIrt[] = (filas ?? [])
      .filter((f) => typeof f.ejercicio?.dificultadB === 'number')
      .map((f) => ({ b: f.ejercicio!.dificultadB, correcto: !!f.correcto }));
    if (respuestas.length === 0) return null;
    return { theta: redondearTheta(estimarTheta(respuestas)), n: respuestas.length };
  }

  /** Revisión enumerada: enunciado, opción elegida, correcta y explicación. */
  async revision(usuarioId: number) {
    const filas = await this.prisma.pretestRespuesta.findMany({
      where: { usuarioId, tipo: 'post' },
      orderBy: { ejercicioId: 'asc' },
      include: { ejercicio: { select: { enunciado: true, codigoPython: true, opciones: true, categoria: true, respuestaCorrecta: true, explicacionIa: true } } },
    });
    return filas.map((f, i) => ({
      numero: i + 1,
      categoria: f.ejercicio.categoria,
      enunciado: f.ejercicio.enunciado,
      codigoPython: f.ejercicio.codigoPython,
      opciones: f.ejercicio.opciones,
      opcion_dada: f.opcionDada || null,
      respuesta_correcta: f.ejercicio.respuestaCorrecta,
      explicacion: f.ejercicio.explicacionIa,
      correcto: f.correcto,
    }));
  }

  /** Cierra el postest: calcula y persiste (tipo='post'). */
  async finalizar(usuarioId: number, tiempoSeg = 0): Promise<ResultadoPostest> {
    const disp = await this.disponibilidad(usuarioId);
    if (!disp.disponible) throw new BadRequestException('El postest aún no está habilitado.');
    // Candado anti-resultado-vacío: no persistir un 0 si el examen está en blanco
    // (nunca se cargó, o se cargó pero no se respondió ninguna pregunta).
    const respondidas = await this.prisma.pretestRespuesta.count({
      where: { usuarioId, tipo: 'post', opcionDada: { not: '' } },
    });
    if (respondidas === 0) throw new BadRequestException('Responde al menos una pregunta antes de finalizar la evaluación.');
    const r = await this.calcular(usuarioId);
    await this.prisma.evaluacion.upsert({
      where: { usuarioId_tipo: { usuarioId, tipo: 'post' } },
      create: { usuarioId, tipo: 'post', puntajeTotal: r.puntaje, tiempoSeg, porCategoria: r.por_categoria },
      update: { puntajeTotal: r.puntaje, tiempoSeg, porCategoria: r.por_categoria, fecha: new Date() },
    });

    // IRT: estima θ_final desde el postest y registra la ganancia de habilidad
    // Δθ = θ_final − θ_inicial (evidencia cuantitativa, además de la ganancia en
    // puntaje). θ_final se persiste y se añade a la evolución de θ.
    const est = await this.estimarThetaPostest(usuarioId);
    if (est) {
      const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { thetaInicial: true } });
      await this.prisma.usuario.update({ where: { id: usuarioId }, data: { thetaFinal: est.theta } });
      await this.prisma.historialTheta.create({ data: { usuarioId, theta: est.theta, origen: 'postest', n: est.n } });
      r.theta = est.theta;
      r.theta_pre = u?.thetaInicial ?? null;
      r.ganancia_theta = gananciaTheta(u?.thetaInicial ?? null, est.theta);
    }

    // El postest es proxy de dominio para el rango: recalcúlalo en todas las
    // unidades. Y otorga "Perfeccionista" si el puntaje fue 100.
    await this.rangos.recalcular(usuarioId).catch(() => undefined);
    const emblemas = await this.emblemas.evaluarPostest(usuarioId, r.puntaje).catch(() => []);
    return { ...r, emblemas_nuevos: emblemas };
  }
}
