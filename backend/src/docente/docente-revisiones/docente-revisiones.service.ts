import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificacionesService } from '../../modulos/notificaciones/notificaciones.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';
import { RevisarEntregaDto } from './dto/revision.dto';

/**
 * Revisión y calificación de entregas de retos (rol docente). Un docente solo
 * revisa entregas de SUS retos (autor validado contra el JWT). Al aprobar se
 * otorga el XP UNA sola vez, se recalcula el ranking y se notifica al estudiante.
 */
@Injectable()
export class DocenteRevisionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
    private readonly tutorIa: TutorIaService,
  ) {}

  /** Verifica que el reto exista y pertenezca al docente. */
  private async retoPropio(retoId: number, autorId: number) {
    const reto = await this.prisma.reto.findUnique({ where: { id: retoId } });
    if (!reto) throw new NotFoundException('Reto no encontrado');
    if (reto.autorId !== autorId) throw new ForbiddenException('No puedes revisar entregas de retos de otro docente');
    return reto;
  }

  /** Entregas de retos del docente (por defecto solo las pendientes de revisión). */
  async listar(autorId: number, soloPendientes = true) {
    const entregas = await this.prisma.retoUsuario.findMany({
      where: {
        reto: { autorId },
        ...(soloPendientes ? { estado: 'pendiente_revision' } : { estado: { not: 'sin_entregar' } }),
      },
      orderBy: [{ entregadoEn: 'asc' }],
      include: {
        reto: { select: { id: true, titulo: true, categoria: true, xp: true, enunciado: true } },
        usuario: { select: { id: true, nombre: true, email: true } },
      },
    });
    const ahora = Date.now();
    return entregas.map((e) => {
      // TIEMPO DE ESPERA. No es un adorno: la retroalimentación oportuna forma
      // parte del tratamiento. Si unas entregas se corrigen en un día y otras
      // en dos semanas, la intervención NO fue uniforme entre estudiantes, y
      // eso hay que poder verlo mientras aún se puede corregir.
      const referencia = e.revisadoEn ?? new Date(ahora);
      const horas = e.entregadoEn
        ? Math.max(0, Math.round((referencia.getTime() - e.entregadoEn.getTime()) / 3_600_000))
        : null;

      return {
        retoId: e.retoId, retoTitulo: e.reto.titulo, categoria: e.reto.categoria,
        enunciado: e.reto.enunciado, xpSugerido: e.reto.xp,
        estudianteId: e.usuario.id, estudiante: e.usuario.nombre, email: e.usuario.email,
        estado: e.estado, codigo: e.codigoEntregado, xp_obtenido: e.xpObtenido,
        feedback: e.feedbackDocente, entregado_en: e.entregadoEn, revisado_en: e.revisadoEn,
        /** Horas esperando (si sigue pendiente) o que esperó (si ya se revisó). */
        horas_espera: horas,
        dias_espera: horas === null ? null : Math.floor(horas / 24),
        /** Marca las que llevan más de 72 h sin revisar: ahí la demora ya es notable. */
        demorada: e.estado === 'pendiente_revision' && horas !== null && horas > 72,
      };
    });
  }

  /** Conteo de entregas pendientes (para el stat card del dashboard). */
  async conteoPendientes(autorId: number): Promise<number> {
    return this.prisma.retoUsuario.count({ where: { estado: 'pendiente_revision', reto: { autorId } } });
  }

  /**
   * Revisa una entrega. Si se aprueba, otorga XP (ranking) de forma transaccional,
   * recalcula posiciones y marca `resuelto`. Siempre notifica al estudiante.
   * El XP se otorga UNA sola vez: solo se puede revisar una entrega pendiente.
   */
  async revisar(retoId: number, estudianteId: number, autorId: number, dto: RevisarEntregaDto) {
    const reto = await this.retoPropio(retoId, autorId);
    const entrega = await this.prisma.retoUsuario.findUnique({
      where: { usuarioId_retoId: { usuarioId: estudianteId, retoId } },
    });
    if (!entrega || entrega.estado === 'sin_entregar') throw new NotFoundException('El estudiante no tiene una entrega para este reto');
    if (entrega.estado !== 'pendiente_revision') throw new BadRequestException('Esta entrega ya fue revisada');

    const aprobado = dto.aprobado;
    // El XP lo decide el backend: si aprueba, usa el enviado (acotado al máximo del reto); si no, 0.
    const xp = aprobado ? Math.max(0, Math.min(reto.xp, dto.xp ?? reto.xp)) : 0;
    const feedback = dto.feedback?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.retoUsuario.update({
        where: { usuarioId_retoId: { usuarioId: estudianteId, retoId } },
        data: {
          estado: aprobado ? 'aprobado' : 'necesita_mejorar',
          resuelto: aprobado,
          xpObtenido: xp,
          feedbackDocente: feedback,
          revisadoEn: new Date(),
        },
      });

      if (aprobado && xp > 0) {
        await tx.ranking.upsert({
          where: { usuarioId: estudianteId },
          create: { usuarioId: estudianteId, xpTotal: xp },
          update: { xpTotal: { increment: xp } },
        });
        // Recalcular posiciones del ranking (misma lógica que en ejercicios).
        const orden = await tx.ranking.findMany({ orderBy: [{ xpTotal: 'desc' }, { usuarioId: 'asc' }], select: { usuarioId: true } });
        for (let i = 0; i < orden.length; i++) {
          await tx.ranking.update({ where: { usuarioId: orden[i].usuarioId }, data: { posicion: i + 1 } });
        }
      }

      await this.notificaciones.crear({
        usuarioId: estudianteId,
        tipo: 'reto_revisado',
        titulo: aprobado ? `Reto aprobado: ${reto.titulo}` : `Reto revisado: ${reto.titulo}`,
        mensaje: aprobado
          ? `¡Bien! Tu reto "${reto.titulo}" fue aprobado (+${xp} XP).${feedback ? ` Comentario: ${feedback}` : ''}`
          : `Tu reto "${reto.titulo}" necesita mejoras.${feedback ? ` Comentario: ${feedback}` : ''} Puedes corregirlo y volver a entregar.`,
        enlace: '/retos',
        refId: retoId,
      }, tx);
    });

    return { ok: true, estado: aprobado ? 'aprobado' : 'necesita_mejorar', xp };
  }

  /** Borrador de feedback propuesto por PREXI (Gemini). El docente lo edita antes de enviar. */
  async sugerirFeedback(retoId: number, estudianteId: number, autorId: number, aprobado?: boolean) {
    const reto = await this.retoPropio(retoId, autorId);
    const entrega = await this.prisma.retoUsuario.findUnique({
      where: { usuarioId_retoId: { usuarioId: estudianteId, retoId } },
      select: { codigoEntregado: true, estado: true },
    });
    if (!entrega || entrega.estado === 'sin_entregar') throw new NotFoundException('El estudiante no tiene una entrega para este reto');
    return this.tutorIa.sugerirFeedbackDocente({
      enunciado: reto.enunciado,
      codigo: entrega.codigoEntregado ?? '',
      aprobado,
    });
  }
}
