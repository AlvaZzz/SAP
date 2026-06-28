import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ResponderDto } from './dto/responder.dto';

// Campos del ejercicio que SÍ ve el estudiante (sin la respuesta correcta).
const SELECT_PUBLICO = {
  id: true, titulo: true, categoria: true, nivelId: true, estrellas: true,
  tipo: true, enunciado: true, codigoPython: true, opciones: true, xp: true,
  maxPistas: true, banco: true,
} satisfies Prisma.EjercicioSelect;

/** Multiplicador de XP según racha de días consecutivos. */
function multiplicadorRacha(dias: number): number {
  if (dias >= 14) return 2.0;
  if (dias >= 7) return 1.5;
  if (dias >= 3) return 1.2;
  return 1.0;
}

@Injectable()
export class EjerciciosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Niveles con el progreso del usuario ──
  async niveles(usuarioId: number) {
    const niveles = await this.prisma.nivel.findMany({
      orderBy: { numero: 'asc' },
      include: {
        _count: { select: { ejercicios: { where: { banco: 'practica' } } } },
        progreso: { where: { usuarioId } },
      },
    });
    return niveles.map((n) => {
      const pr = n.progreso[0];
      return {
        id: n.id, numero: n.numero, titulo: n.titulo, descripcion: n.descripcion, umbral: n.umbral,
        total_ejercicios: n._count.ejercicios,
        ejercicios_completados: pr?.ejerciciosCompletados ?? 0,
        desbloqueado: pr?.desbloqueado ?? n.numero === 1,
      };
    });
  }

  // ── Listado de práctica (sin respuesta) ──
  async listar(nivel?: number, categoria?: string) {
    return this.prisma.ejercicio.findMany({
      where: { banco: 'practica', ...(nivel ? { nivelId: nivel } : {}), ...(categoria ? { categoria } : {}) },
      orderBy: [{ nivelId: 'asc' }, { id: 'asc' }],
      select: SELECT_PUBLICO,
    });
  }

  async detalle(id: number) {
    const ej = await this.prisma.ejercicio.findUnique({ where: { id }, select: SELECT_PUBLICO });
    if (!ej) throw new NotFoundException('Ejercicio no encontrado');
    return ej;
  }

  /** IDs de ejercicios que el usuario ya resolvió correctamente. */
  async resueltos(usuarioId: number): Promise<number[]> {
    const rows = await this.prisma.intento.findMany({
      where: { usuarioId, correcto: true }, distinct: ['ejercicioId'], select: { ejercicioId: true },
    });
    return rows.map((r) => r.ejercicioId);
  }

  // ── Registrar intento (corrección + XP + desbloqueo en backend) ──
  async responder(usuarioId: number, dto: ResponderDto) {
    return this.prisma.$transaction(async (tx) => {
      const ej = await tx.ejercicio.findUnique({
        where: { id: dto.ejercicioId },
        include: { nivel: true },
      });
      if (!ej) throw new NotFoundException('Ejercicio no encontrado');

      // Seguridad: no se puede resolver un ejercicio de un nivel bloqueado.
      if (ej.nivel.numero > 1) {
        const pr = await tx.progresoNivel.findUnique({
          where: { usuarioId_nivelId: { usuarioId, nivelId: ej.nivelId } },
        });
        if (!pr?.desbloqueado) {
          throw new ForbiddenException('Este nivel aún está bloqueado. Completa el nivel anterior primero.');
        }
      }

      const correcto =
        dto.respuestaDada.trim().toUpperCase() === ej.respuestaCorrecta.trim().toUpperCase();

      const cfg = await tx.configuracionSistema.findUnique({ where: { id: 1 } });
      let xpOtorgado = 0;
      let multiplicador = 1;
      let rachaDias = 0;
      let nivelCompletado = false;
      let nivelDesbloqueadoNumero: number | null = null;

      if (correcto) {
        // XP base menos penalización por pistas usadas.
        const penal = (cfg?.penalizacionPista ?? 5) * (dto.pistasUsadas ?? 0);
        const xpBase = Math.max(5, ej.xp - penal);

        // Racha.
        const rk = await tx.ranking.findUnique({ where: { usuarioId } });
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const ult = rk?.ultimaActividad ? new Date(rk.ultimaActividad) : null;
        if (ult) ult.setHours(0, 0, 0, 0);
        const dias = ult ? Math.round((hoy.getTime() - ult.getTime()) / 86_400_000) : null;
        rachaDias = dias === null ? 1 : dias === 0 ? (rk?.rachaDias ?? 1) : dias === 1 ? (rk?.rachaDias ?? 0) + 1 : 1;
        multiplicador = multiplicadorRacha(rachaDias);
        xpOtorgado = Math.round(xpBase * multiplicador);

        await tx.ranking.upsert({
          where: { usuarioId },
          create: { usuarioId, xpTotal: xpOtorgado, rachaDias, ultimaActividad: hoy },
          update: { xpTotal: { increment: xpOtorgado }, rachaDias, ultimaActividad: hoy },
        });

        // Avanzar progreso del nivel + desbloquear el siguiente al alcanzar umbral.
        const completados = await tx.intento.count({
          where: { usuarioId, correcto: true, ejercicio: { nivelId: ej.nivelId } },
        });
        // (incluye este intento que aún no se inserta; se cuenta abajo)
        const completadosTotal = completados + 1;
        await tx.progresoNivel.upsert({
          where: { usuarioId_nivelId: { usuarioId, nivelId: ej.nivelId } },
          create: { usuarioId, nivelId: ej.nivelId, ejerciciosCompletados: completadosTotal, desbloqueado: true },
          update: { ejerciciosCompletados: completadosTotal, desbloqueado: true },
        });

        const umbralPct = cfg?.umbralPorcentaje ?? 80;
        const requeridos = Math.ceil((ej.nivel.umbral * umbralPct) / 100);
        if (completadosTotal >= requeridos) {
          nivelCompletado = true;
          const sig = await tx.nivel.findUnique({ where: { numero: ej.nivel.numero + 1 } });
          if (sig) {
            await tx.progresoNivel.upsert({
              where: { usuarioId_nivelId: { usuarioId, nivelId: sig.id } },
              create: { usuarioId, nivelId: sig.id, desbloqueado: true },
              update: { desbloqueado: true },
            });
            nivelDesbloqueadoNumero = sig.numero;
          }
        }
      }

      await tx.intento.create({
        data: {
          usuarioId, ejercicioId: ej.id, respuestaDada: dto.respuestaDada, correcto,
          tiempoSeg: dto.tiempoSeg ?? 0, pistasUsadas: dto.pistasUsadas ?? 0, xpOtorgado,
        },
      });

      // Recalcular posiciones del ranking.
      const orden = await tx.ranking.findMany({ orderBy: [{ xpTotal: 'desc' }, { usuarioId: 'asc' }], select: { usuarioId: true } });
      for (let i = 0; i < orden.length; i++) {
        await tx.ranking.update({ where: { usuarioId: orden[i].usuarioId }, data: { posicion: i + 1 } });
      }

      return {
        correcto,
        respuesta_correcta: ej.respuestaCorrecta,
        explicacion_base: ej.explicacionIa,
        xp: { xpOtorgado, multiplicador, rachaDias },
        nivel: { nivelCompletado, nivelDesbloqueadoNumero },
      };
    });
  }
}
