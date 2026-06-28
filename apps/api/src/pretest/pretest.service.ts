import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export const TOTAL_PRETEST = 20;

export interface ResultadoPretest {
  puntaje: number;
  nivel: 'Bajo' | 'Medio' | 'Alto';
  nivel_inicial: number;
  aciertos: number;
  total: number;
  por_categoria: { categoria: string; aciertos: number; total: number; porcentaje: number }[];
  fortalezas: string[];
  debilidades: string[];
}

function clasificar(p: number): ResultadoPretest['nivel'] {
  if (p < 40) return 'Bajo';
  if (p <= 70) return 'Medio';
  return 'Alto';
}

@Injectable()
export class PretestService {
  constructor(private readonly prisma: PrismaService) {}

  async estado(usuarioId: number): Promise<{ completado: boolean; resultado: ResultadoPretest | null }> {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { pretestCompletado: true } });
    if (!u?.pretestCompletado) return { completado: false, resultado: null };
    return { completado: true, resultado: await this.calcular(usuarioId) };
  }

  /** Devuelve (y fija) las 20 preguntas del pretest del usuario. */
  async preguntas(usuarioId: number) {
    const n = await this.prisma.pretestRespuesta.count({ where: { usuarioId, tipo: 'pre' } });
    if (n === 0) {
      const elegidas = await this.prisma.$queryRaw<{ id: number; categoria: string }[]>(
        Prisma.sql`SELECT id, categoria FROM ejercicios WHERE banco = 'pretest' ORDER BY random() LIMIT ${TOTAL_PRETEST}`,
      );
      await this.prisma.pretestRespuesta.createMany({
        data: elegidas.map((e) => ({ usuarioId, ejercicioId: e.id, tipo: 'pre' as const, categoria: e.categoria })),
        skipDuplicates: true,
      });
    }

    const filas = await this.prisma.pretestRespuesta.findMany({
      where: { usuarioId, tipo: 'pre' },
      orderBy: { ejercicioId: 'asc' },
      include: { ejercicio: { select: { id: true, categoria: true, estrellas: true, tipo: true, enunciado: true, codigoPython: true, opciones: true } } },
    });
    return filas.map((f) => ({ ...f.ejercicio, opcion_guardada: f.opcionDada || null }));
  }

  /** Autosave: la corrección se evalúa en el backend. */
  async responder(usuarioId: number, ejercicioId: number, opcion: string) {
    const fila = await this.prisma.pretestRespuesta.findUnique({
      where: { usuarioId_ejercicioId_tipo: { usuarioId, ejercicioId, tipo: 'pre' } },
      include: { ejercicio: { select: { respuestaCorrecta: true } } },
    });
    if (!fila) throw new BadRequestException('La pregunta no pertenece a tu pretest');

    const correcto = opcion.trim().toUpperCase() === fila.ejercicio.respuestaCorrecta.trim().toUpperCase();
    await this.prisma.pretestRespuesta.update({
      where: { usuarioId_ejercicioId_tipo: { usuarioId, ejercicioId, tipo: 'pre' } },
      data: { opcionDada: opcion, correcto },
    });
    return { ok: true };
  }

  private async agregadoPorCategoria(usuarioId: number) {
    const grupos = await this.prisma.pretestRespuesta.groupBy({
      by: ['categoria'],
      where: { usuarioId, tipo: 'pre' },
      _count: { _all: true },
    });
    // groupBy no suma booleanos; contamos aciertos aparte.
    const resultado: { categoria: string; aciertos: number; total: number; porcentaje: number }[] = [];
    for (const g of grupos) {
      const aciertos = await this.prisma.pretestRespuesta.count({
        where: { usuarioId, tipo: 'pre', categoria: g.categoria, correcto: true },
      });
      const total = g._count._all;
      resultado.push({ categoria: g.categoria, aciertos, total, porcentaje: total ? Math.round((aciertos / total) * 100) : 0 });
    }
    return resultado.sort((a, b) => a.categoria.localeCompare(b.categoria));
  }

  private async calcular(usuarioId: number): Promise<ResultadoPretest> {
    const por = await this.agregadoPorCategoria(usuarioId);
    const total = por.reduce((a, c) => a + c.total, 0) || TOTAL_PRETEST;
    const aciertos = por.reduce((a, c) => a + c.aciertos, 0);
    const puntaje = Math.round((aciertos / total) * 100);
    const nivel = clasificar(puntaje);
    return {
      puntaje, nivel, nivel_inicial: nivel === 'Alto' ? 2 : 1, aciertos, total,
      por_categoria: por,
      fortalezas: por.filter((c) => c.porcentaje >= 60).map((c) => c.categoria),
      debilidades: por.filter((c) => c.porcentaje < 60).map((c) => c.categoria),
    };
  }

  /** Cierra el pretest: calcula, persiste y configura el nivel inicial. */
  async finalizar(usuarioId: number, tiempoSeg = 0): Promise<ResultadoPretest> {
    const r = await this.calcular(usuarioId);
    await this.prisma.$transaction(async (tx) => {
      await tx.evaluacion.upsert({
        where: { usuarioId_tipo: { usuarioId, tipo: 'pre' } },
        create: { usuarioId, tipo: 'pre', puntajeTotal: r.puntaje, tiempoSeg, porCategoria: r.por_categoria },
        update: { puntajeTotal: r.puntaje, tiempoSeg, porCategoria: r.por_categoria, fecha: new Date() },
      });
      await tx.usuario.update({ where: { id: usuarioId }, data: { pretestCompletado: true, nivelInicial: r.nivel_inicial } });

      const niveles = await tx.nivel.findMany();
      for (const n of niveles) {
        if (n.numero <= r.nivel_inicial) {
          await tx.progresoNivel.upsert({
            where: { usuarioId_nivelId: { usuarioId, nivelId: n.id } },
            create: { usuarioId, nivelId: n.id, desbloqueado: true },
            update: { desbloqueado: true },
          });
        }
      }
    });
    return r;
  }
}
