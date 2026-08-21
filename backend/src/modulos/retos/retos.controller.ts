import { Body, Controller, Get, Post, Param, ParseIntPipe, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { RetosAccessService } from './retos-access.service';
import { RetosAccessGuard } from './retos-access.guard';
import { RetosService } from './retos.service';
import { AdaptatividadService } from '../../ejercicios/adaptatividad.service';

class EntregarRetoDto {
  @IsString() @MinLength(1) codigo!: string;
}

/**
 * Retos del docente (ejercicios extra) — vista estudiante.
 * El estudiante los resuelve en la Zona de Práctica (contexto = reto) y pulsa
 * "Entregar reto": queda en pendiente_revision (SIN XP). El docente lo revisa y
 * otorga XP + feedback (ver docente-retos). El estudiante recibe una notificación.
 */
@Controller('retos')
@UseGuards(JwtAuthGuard)
export class RetosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
    private readonly retosAccess: RetosAccessService,
    private readonly retos: RetosService,
    // Punto único del gating por nivel (ver AdaptatividadService).
    private readonly adaptatividad: AdaptatividadService,
  ) {}

  /** Estado de acceso del estudiante a los retos (nivel + habilitación docente). */
  @Get('acceso')
  async acceso(@CurrentUser('sub') usuarioId: number) {
    return this.retosAccess.estado(usuarioId);
  }

  /**
   * Retos disponibles: filtrados por el nivel que el estudiante tiene EN CADA
   * TEMA (no por su nivel global). Ver RetosService.
   */
  @Get()
  @UseGuards(RetosAccessGuard)
  async listar(
    @CurrentUser('sub') usuarioId: number,
    @Query('unidad') unidad?: string,
    @Query('tema') tema?: string,
  ) {
    return this.retos.disponibles(usuarioId, {
      unidad: unidad ? Number(unidad) : undefined,
      temaCodigo: tema,
    });
  }

  /** Entregas del estudiante con su estado, XP y feedback (vista "Mis entregas"). */
  // TODO: REVISAR_ANTES_DE_ELIMINAR — sin llamadas desde el frontend: las entregas se ven dentro de cada reto.
  @Get('mis-entregas')
  @UseGuards(RetosAccessGuard)
  async misEntregas(@CurrentUser('sub') usuarioId: number) {
    const entregas = await this.prisma.retoUsuario.findMany({
      where: { usuarioId, estado: { not: 'sin_entregar' } },
      orderBy: [{ revisadoEn: 'desc' }, { entregadoEn: 'desc' }],
      include: { reto: { select: { id: true, titulo: true, categoria: true, xp: true } } },
    });
    return {
      entregas: entregas.map((e) => ({
        retoId: e.retoId, titulo: e.reto.titulo, categoria: e.reto.categoria,
        estado: e.estado, xp_obtenido: e.xpObtenido, feedback: e.feedbackDocente,
        codigo: e.codigoEntregado, entregado_en: e.entregadoEn, revisado_en: e.revisadoEn,
      })),
    };
  }

  @Get(':id')
  @UseGuards(RetosAccessGuard)
  async detalle(
    @CurrentUser('sub') usuarioId: number,
    @CurrentUser('rol') rol: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const r = await this.prisma.reto.findFirst({
      where: { id, activo: true },
      include: {
        autor: { select: { nombre: true } },
        tema: { select: { numero: true, titulo: true, unidad: { select: { numero: true } } } },
        // Campos del ejercicio ORIGEN que ya son públicos en el resto del sistema
        // (son los mismos con los que se renderiza un ejercicio normal).
        // `respuestaCorrecta` y `explicacionIa` NO se piden: la solución del origen
        // resolvería el reto de un vistazo.
        origenEjercicio: {
          select: {
            id: true, enunciado: true, fuenteDoc: true,
            tipo: true, codigoPython: true, opciones: true,
            nivelDificultad: true,
            tema: { select: { numero: true, titulo: true, unidad: { select: { numero: true } } } },
          },
        },
      },
    });
    if (!r) return { reto: null, entrega: null };
    // GATING POR NIVEL: el listado ya filtra, pero el acceso directo por id no lo
    // hacía. Se comprueba después de resolver el reto y antes de devolver nada suyo.
    await this.adaptatividad.verificarAccesoReto(usuarioId, r, rol);
    const e = await this.prisma.retoUsuario.findUnique({ where: { usuarioId_retoId: { usuarioId, retoId: id } } });
    // Contexto académico legible para el tutor PREXI (ej. "U2 · 2.4 Bucles").
    const contextoTema = r.tema
      ? `U${r.tema.unidad.numero} · ${r.tema.numero} ${r.tema.titulo}`
      : r.categoria;

    // NUNCA se expone la solución de referencia al cliente: `respuestaCorrecta`
    // guarda el código correcto y `pistas` se sirven de a una desde PREXI.
    const { respuestaCorrecta: _solucion, pistas: _pistas, origenEjercicio, ...publico } = r;
    const fd = (origenEjercicio?.fuenteDoc ?? {}) as { codigo?: string };

    return {
      reto: {
        ...publico,
        contextoTema,
        // Trazabilidad visible: "este reto se basa en el ejercicio E1.5.I.06".
        // Se manda lo necesario para MOSTRAR el ejercicio origen (enunciado
        // completo, tipo, snippet y opciones), nunca su respuesta correcta.
        origen: origenEjercicio
          ? {
              ejercicio_id: origenEjercicio.id,
              codigo: fd.codigo ?? null,
              enunciado: origenEjercicio.enunciado,
              tipo: origenEjercicio.tipo,
              nivel: origenEjercicio.nivelDificultad,
              codigo_python: origenEjercicio.codigoPython,
              opciones: origenEjercicio.opciones,
              unidad: origenEjercicio.tema?.unidad.numero ?? null,
              tema: origenEjercicio.tema ? `${origenEjercicio.tema.numero} ${origenEjercicio.tema.titulo}` : null,
            }
          : null,
        total_pistas: Array.isArray(r.pistas) ? r.pistas.length : 0,
      },
      entrega: e
        ? { estado: e.estado, xp_obtenido: e.xpObtenido, feedback: e.feedbackDocente, codigo: e.codigoEntregado, entregado_en: e.entregadoEn, revisado_en: e.revisadoEn }
        : null,
    };
  }

  /** Entrega el reto para revisión del docente. No otorga XP todavía. */
  @Post(':id/entregar')
  @UseGuards(RetosAccessGuard)
  async entregar(
    @CurrentUser('sub') usuarioId: number,
    @CurrentUser('rol') rol: string,
    @Param('id', ParseIntPipe) retoId: number,
    @Body() dto: EntregarRetoDto,
  ) {
    const reto = await this.prisma.reto.findFirst({
      where: { id: retoId, activo: true },
      select: { id: true, titulo: true, autorId: true, temaId: true, nivelDificultad: true },
    });
    if (!reto) throw new BadRequestException('El reto no existe o no está disponible');
    // GATING POR NIVEL, antes de registrar la entrega: una entrega de otro nivel
    // llegaría al docente y podría acabar otorgando XP fuera de la ruta adaptativa.
    await this.adaptatividad.verificarAccesoReto(usuarioId, reto, rol);

    const actual = await this.prisma.retoUsuario.findUnique({ where: { usuarioId_retoId: { usuarioId, retoId } } });
    if (actual?.estado === 'pendiente_revision') throw new BadRequestException('Ya entregaste este reto; espera la revisión del docente.');
    if (actual?.estado === 'aprobado') throw new BadRequestException('Este reto ya fue aprobado.');

    await this.prisma.retoUsuario.upsert({
      where: { usuarioId_retoId: { usuarioId, retoId } },
      create: { usuarioId, retoId, estado: 'pendiente_revision', codigoEntregado: dto.codigo, entregadoEn: new Date() },
      update: { estado: 'pendiente_revision', codigoEntregado: dto.codigo, entregadoEn: new Date(), revisadoEn: null },
    });

    // Avisa al docente autor del reto: tiene una entrega nueva por revisar.
    const estudiante = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } });
    await this.notificaciones.crear({
      usuarioId: reto.autorId,
      tipo: 'entrega_pendiente',
      titulo: `Nueva entrega: ${reto.titulo}`,
      mensaje: `${estudiante?.nombre ?? 'Un estudiante'} entregó el reto "${reto.titulo}" y espera tu revisión.`,
      enlace: '/docente/revisiones',
      refId: retoId,
    });

    return { ok: true, estado: 'pendiente_revision' };
  }
}
