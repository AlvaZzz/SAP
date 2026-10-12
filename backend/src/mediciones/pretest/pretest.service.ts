import { Injectable, BadRequestException } from '@nestjs/common';
import { NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ordenPersonalPorGrupo } from '../../common/orden/orden-personal';
import { ETIQUETA_NIVEL } from '../../common/niveles/nivel-dificultad';
import { estimarTheta, nivelDesdeTheta, redondearTheta, RespuestaIrt } from '../irt/irt';

// Rango de ítems por tema en el diagnóstico (instrumento igual para todos).
export const MIN_ITEMS_TEMA = 3;
export const MAX_ITEMS_TEMA = 5;

/** Resultado del diagnóstico en UN tema (parte del mapa de fortalezas/debilidades). */
export interface TemaResultado {
  tema_id: number;
  unidad: number; // numero de la unidad
  numero: string; // ej. "1.5"
  titulo: string;
  aciertos: number;
  total: number;
  puntaje: number; // 0-100
  theta: number | null;
  nivel: NivelDificultad;
  nivel_label: string;
}

export interface ResultadoPretest {
  // Globales (comparación antes/después a nivel global).
  puntaje: number; // 0-100
  theta: number | null; // habilidad global estimada por IRT (Rasch)
  nivel_adaptativo: NivelDificultad;
  nivel_adaptativo_label: string;
  nivel_inicial: number;
  aciertos: number;
  total: number;
  // Desglose POR TEMA (mapa de fortalezas y debilidades).
  por_tema: TemaResultado[];
  fortalezas: string[]; // temas con nivel intermedio/avanzado
  debilidades: string[]; // temas con nivel básico
}

@Injectable()
export class PretestService {
  constructor(private readonly prisma: PrismaService) {}

  async estado(usuarioId: number): Promise<{ completado: boolean; resultado: ResultadoPretest | null }> {
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { pretestCompletado: true, nivelInicial: true, thetaInicial: true, nivelInicialAdaptativo: true },
    });
    if (!u?.pretestCompletado) return { completado: false, resultado: null };
    return { completado: true, resultado: await this.resultadoPersistido(usuarioId, u.nivelInicial, u.thetaInicial ?? null, u.nivelInicialAdaptativo ?? null) };
  }

  /**
   * Reconstruye el resultado del diagnóstico desde los datos PERSISTIDOS (fuente
   * de verdad): `DiagnosticoTema` (detalle por tema) + `Evaluacion` (puntaje
   * global) + Usuario (θ y nivel global). NO se recalcula desde respuestas.
   */
  private async resultadoPersistido(
    usuarioId: number,
    nivelInicial: number,
    theta: number | null,
    nivelAdaptativo: NivelDificultad | null,
  ): Promise<ResultadoPretest> {
    const [diag, evalPre] = await Promise.all([
      this.prisma.diagnosticoTema.findMany({
        where: { usuarioId },
        include: { tema: { select: { numero: true, titulo: true, unidad: { select: { numero: true } } } } },
      }),
      this.prisma.evaluacion.findUnique({ where: { usuarioId_tipo: { usuarioId, tipo: 'pre' } } }),
    ]);
    const por_tema = diag
      .map((d) => this.vistaTema(d))
      .sort((a, b) => a.unidad - b.unidad || a.numero.localeCompare(b.numero, undefined, { numeric: true }));

    const aciertos = por_tema.reduce((a, t) => a + t.aciertos, 0);
    const total = por_tema.reduce((a, t) => a + t.total, 0);
    const nivel = nivelAdaptativo ?? 'basico';
    return {
      puntaje: evalPre?.puntajeTotal ?? (total ? Math.round((aciertos / total) * 100) : 0),
      theta,
      nivel_adaptativo: nivel,
      nivel_adaptativo_label: ETIQUETA_NIVEL[nivel],
      nivel_inicial: nivelInicial,
      aciertos,
      total,
      por_tema,
      fortalezas: por_tema.filter((t) => t.nivel !== 'basico').map((t) => t.titulo),
      debilidades: por_tema.filter((t) => t.nivel === 'basico').map((t) => t.titulo),
    };
  }

  private vistaTema(d: {
    temaId: number; aciertos: number; total: number; puntaje: number; theta: number | null; nivel: NivelDificultad;
    tema: { numero: string; titulo: string; unidad: { numero: number } };
  }): TemaResultado {
    return {
      tema_id: d.temaId,
      unidad: d.tema.unidad.numero,
      numero: d.tema.numero,
      titulo: d.tema.titulo,
      aciertos: d.aciertos,
      total: d.total,
      puntaje: d.puntaje,
      theta: d.theta,
      nivel: d.nivel,
      nivel_label: ETIQUETA_NIVEL[d.nivel],
    };
  }

  /** IDs de los temas que entran al diagnóstico (marcados por el docente y con banco suficiente). */
  private async temasDiagnostico(): Promise<number[]> {
    const grupos = await this.prisma.ejercicio.groupBy({
      by: ['temaId'],
      where: { banco: 'pretest', temaId: { not: null }, tema: { enDiagnostico: true } },
      _count: { _all: true },
    });
    return grupos.filter((g) => g.temaId != null && g._count._all >= MIN_ITEMS_TEMA).map((g) => g.temaId!) as number[];
  }

  /**
   * Fija (una sola vez) y devuelve las preguntas del diagnóstico del usuario:
   * por cada tema curado, 3-5 ítems del banco de diagnóstico de ese tema.
   */
  async preguntas(usuarioId: number) {
    // Serializa por usuario para evitar doble generación (React Strict Mode).
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(1, ${usuarioId}::int)`;
      const n = await tx.pretestRespuesta.count({ where: { usuarioId, tipo: 'pre' } });
      if (n > 0) return;
      const temas = await this.temasDiagnostico();
      for (const temaId of temas) {
        const elegidas = await tx.$queryRaw<{ id: number; categoria: string }[]>(
          Prisma.sql`SELECT id, categoria FROM ejercicios WHERE banco = 'pretest' AND tema_id = ${temaId} ORDER BY random() LIMIT ${MAX_ITEMS_TEMA}`,
        );
        await tx.pretestRespuesta.createMany({
          data: elegidas.map((e) => ({ usuarioId, ejercicioId: e.id, tipo: 'pre' as const, categoria: e.categoria, temaId })),
          skipDuplicates: true,
        });
      }
    });

    const filas = await this.prisma.pretestRespuesta.findMany({
      where: { usuarioId, tipo: 'pre' },
      orderBy: [{ temaId: 'asc' }, { ejercicioId: 'asc' }],
      include: {
        ejercicio: { select: { id: true, categoria: true, estrellas: true, tipo: true, enunciado: true, codigoPython: true, opciones: true } },
        tema: { select: { numero: true, titulo: true, unidad: { select: { numero: true } } } },
      },
    });
    // Dentro de cada tema, cada estudiante ve las preguntas en su propio orden.
    return ordenPersonalPorGrupo(filas, (f) => f.temaId, usuarioId).map((f) => ({
      ...f.ejercicio,
      tema: f.tema ? { numero: f.tema.numero, titulo: f.tema.titulo, unidad: f.tema.unidad.numero } : null,
      opcion_guardada: f.opcionDada || null,
    }));
  }

  /** Autosave: la corrección se evalúa en el backend. */
  async responder(usuarioId: number, ejercicioId: number, opcion: string) {
    const fila = await this.prisma.pretestRespuesta.findUnique({
      where: { usuarioId_ejercicioId_tipo: { usuarioId, ejercicioId, tipo: 'pre' } },
      include: { ejercicio: { select: { respuestaCorrecta: true } } },
    });
    if (!fila) throw new BadRequestException('La pregunta no pertenece a tu diagnóstico');

    const correcto = opcion.trim().toUpperCase() === fila.ejercicio.respuestaCorrecta.trim().toUpperCase();
    await this.prisma.pretestRespuesta.update({
      where: { usuarioId_ejercicioId_tipo: { usuarioId, ejercicioId, tipo: 'pre' } },
      data: { opcionDada: opcion, correcto },
    });
    return { ok: true };
  }

  /** Nº total de preguntas fijadas del diagnóstico del usuario. */
  async total(usuarioId: number): Promise<number> {
    return this.prisma.pretestRespuesta.count({ where: { usuarioId, tipo: 'pre' } });
  }

  /** Cierra el diagnóstico: agrega por tema, estima θ (IRT) y persiste todo. */
  async finalizar(usuarioId: number, tiempoSeg = 0): Promise<ResultadoPretest> {
    // Candado anti-resultado-vacío: no persistir un diagnóstico en blanco.
    const respondidas = await this.prisma.pretestRespuesta.count({
      where: { usuarioId, tipo: 'pre', opcionDada: { not: '' } },
    });
    if (respondidas === 0)
      throw new BadRequestException('Responde al menos una pregunta antes de finalizar el diagnóstico.');

    const filas = await this.prisma.pretestRespuesta.findMany({
      where: { usuarioId, tipo: 'pre' },
      include: {
        ejercicio: { select: { dificultadB: true } },
        tema: { select: { id: true, numero: true, titulo: true, unidad: { select: { numero: true } } } },
      },
    });

    // Agrupa las respuestas por tema.
    const porTema = new Map<number, { tema: { numero: string; titulo: string; unidad: { numero: number } }; resp: RespuestaIrt[]; aciertos: number }>();
    const globalResp: RespuestaIrt[] = [];
    for (const f of filas) {
      if (!f.temaId || !f.tema) continue;
      const g = porTema.get(f.temaId) ?? { tema: f.tema, resp: [], aciertos: 0 };
      const r: RespuestaIrt = { b: f.ejercicio.dificultadB, correcto: !!f.correcto };
      g.resp.push(r);
      if (f.correcto) g.aciertos++;
      porTema.set(f.temaId, g);
      globalResp.push(r);
    }

    const por_tema: TemaResultado[] = [];
    let aciertosGlobal = 0;
    let totalGlobal = 0;
    const nivelesPorTema: { temaId: number; nivel: NivelDificultad; theta: number; aciertos: number; total: number; puntaje: number }[] = [];

    for (const [temaId, g] of porTema) {
      const total = g.resp.length;
      const theta = redondearTheta(estimarTheta(g.resp));
      const nivel = nivelDesdeTheta(theta);
      const puntaje = total ? Math.round((g.aciertos / total) * 100) : 0;
      aciertosGlobal += g.aciertos;
      totalGlobal += total;
      nivelesPorTema.push({ temaId, nivel, theta, aciertos: g.aciertos, total, puntaje });
      por_tema.push({
        tema_id: temaId, unidad: g.tema.unidad.numero, numero: g.tema.numero, titulo: g.tema.titulo,
        aciertos: g.aciertos, total, puntaje, theta, nivel, nivel_label: ETIQUETA_NIVEL[nivel],
      });
    }
    por_tema.sort((a, b) => a.unidad - b.unidad || a.numero.localeCompare(b.numero, undefined, { numeric: true }));

    const puntajeGlobal = totalGlobal ? Math.round((aciertosGlobal / totalGlobal) * 100) : 0;
    const thetaGlobal = redondearTheta(estimarTheta(globalResp));
    const nivelGlobal = nivelDesdeTheta(thetaGlobal);
    const nivelInicial = nivelGlobal === 'avanzado' ? 2 : 1;
    const porCategoria = por_tema.map((t) => ({ categoria: `${t.titulo}`, aciertos: t.aciertos, total: t.total, porcentaje: t.puntaje }));

    await this.prisma.$transaction(async (tx) => {
      await tx.evaluacion.upsert({
        where: { usuarioId_tipo: { usuarioId, tipo: 'pre' } },
        create: { usuarioId, tipo: 'pre', puntajeTotal: puntajeGlobal, tiempoSeg, porCategoria },
        update: { puntajeTotal: puntajeGlobal, tiempoSeg, porCategoria, fecha: new Date() },
      });

      // Diagnóstico por tema (permanente) + arranque de la adaptatividad por tema.
      for (const n of nivelesPorTema) {
        await tx.diagnosticoTema.upsert({
          where: { usuarioId_temaId: { usuarioId, temaId: n.temaId } },
          create: { usuarioId, temaId: n.temaId, theta: n.theta, nivel: n.nivel, aciertos: n.aciertos, total: n.total, puntaje: n.puntaje },
          update: { theta: n.theta, nivel: n.nivel, aciertos: n.aciertos, total: n.total, puntaje: n.puntaje },
        });
        await tx.progresoTema.upsert({
          where: { usuarioId_temaId: { usuarioId, temaId: n.temaId } },
          // El diagnóstico SOLO fija el nivel con el que arrancará en el tema cuando
          // le toque. No abre temas ni unidades: eso se gana avanzando en orden.
          create: { usuarioId, temaId: n.temaId, nivelActual: n.nivel, desbloqueado: false },
          update: { nivelActual: n.nivel },
        });
      }

      // θ_inicial y nivel global son PERMANENTES (instrumento de la investigación):
      // se fijan solo la primera vez.
      const u = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } });
      const primeraVez = u?.nivelInicialAdaptativo == null;
      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          pretestCompletado: true,
          nivelInicial,
          ...(primeraVez ? { thetaInicial: thetaGlobal, nivelInicialAdaptativo: nivelGlobal } : {}),
        },
      });
      if (primeraVez) {
        await tx.historialTheta.create({ data: { usuarioId, theta: thetaGlobal, origen: 'pretest', n: globalResp.length } });
      }

      // Desbloqueo de niveles de gamificación según el nivel inicial (como antes).
      const niveles = await tx.nivel.findMany();
      for (const nv of niveles) {
        if (nv.numero <= nivelInicial) {
          await tx.progresoNivel.upsert({
            where: { usuarioId_nivelId: { usuarioId, nivelId: nv.id } },
            create: { usuarioId, nivelId: nv.id, desbloqueado: true },
            update: { desbloqueado: true },
          });
        }
      }
    });

    return {
      puntaje: puntajeGlobal,
      theta: thetaGlobal,
      nivel_adaptativo: nivelGlobal,
      nivel_adaptativo_label: ETIQUETA_NIVEL[nivelGlobal],
      nivel_inicial: nivelInicial,
      aciertos: aciertosGlobal,
      total: totalGlobal,
      por_tema,
      fortalezas: por_tema.filter((t) => t.nivel !== 'basico').map((t) => t.titulo),
      debilidades: por_tema.filter((t) => t.nivel === 'basico').map((t) => t.titulo),
    };
  }

  /** Revisión enumerada por tema: enunciado, opción elegida, correcta y explicación. */
  async revision(usuarioId: number) {
    const filas = await this.prisma.pretestRespuesta.findMany({
      where: { usuarioId, tipo: 'pre' },
      orderBy: [{ temaId: 'asc' }, { ejercicioId: 'asc' }],
      include: {
        ejercicio: { select: { enunciado: true, codigoPython: true, opciones: true, categoria: true, respuestaCorrecta: true, explicacionIa: true } },
        tema: { select: { numero: true, titulo: true } },
      },
    });
    // Mismo orden personal con el que rindió, para que la numeración coincida.
    return ordenPersonalPorGrupo(filas, (f) => f.temaId, usuarioId).map((f, i) => ({
      numero: i + 1,
      tema: f.tema ? `${f.tema.numero} ${f.tema.titulo}` : f.ejercicio.categoria,
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
}
