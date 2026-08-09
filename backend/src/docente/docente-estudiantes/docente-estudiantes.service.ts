import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificacionesService } from '../../modulos/notificaciones/notificaciones.service';
import { detectarPatrones } from '../../tutor-ia/patrones-error';

export type EstadoEstudiante = 'completado' | 'en_progreso' | 'inactivo' | 'en_riesgo';

interface UmbralesRiesgo {
  diasInactivo: number;
  tasaAciertoMin: number;
  minIntentos: number;
}

const MS_DIA = 86_400_000;

/**
 * Seguimiento de estudiantes (rol docente). Todos los datos provienen de la
 * actividad REAL del estudiante (intentos, XP, progreso, pretest/postest).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  SEPARACIÓN OBLIGATORIA: EL DOCENTE NO VE EL GRUPO DEL ESTUDIO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Ninguna respuesta de ningún endpoint del rol docente puede incluir —ni
 *  permitir inferir— si un estudiante pertenece al grupo CONTROL o al
 *  EXPERIMENTAL.
 *
 *  Motivo: si el docente lo supiera, podría tratar a los dos grupos de forma
 *  distinta sin siquiera proponérselo (sesgo del experimentador), y la
 *  diferencia final dejaría de ser atribuible a la intervención. Es una amenaza
 *  a la validez interna que no se puede corregir después: o el docente está
 *  ciego al grupo, o el estudio queda comprometido.
 *
 *  El campo `Usuario.grupo` existe y es correcto — pero pertenece al rol
 *  INVESTIGADOR, que trabaja sobre datos anonimizados. Aquí no entra.
 *
 *  Hay una prueba que recorre TODO `backend/src/docente` y falla si `grupo`
 *  reaparece en cualquier respuesta: `docente-sin-grupo.spec.ts`.
 * ═══════════════════════════════════════════════════════════════════════════
 */
@Injectable()
export class DocenteEstudiantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  /**
   * Notifica a TODOS los docentes cuando un estudiante entra en riesgo (no hay
   * asignación docente↔curso en el modelo actual: el curso es compartido). Es
   * idempotente por día: no repite el aviso si ya se notificó en las últimas 24h.
   */
  private async notificarRiesgoSiNuevo(estudianteId: number, nombre: string) {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yaAvisado = await this.prisma.notificacion.findFirst({
      where: { tipo: 'estudiante_riesgo', refId: estudianteId, creadoEn: { gt: desde } },
    });
    if (yaAvisado) return;

    const docentes = await this.prisma.usuario.findMany({ where: { rol: { in: ['docente', 'admin'] }, activo: true }, select: { id: true } });
    await Promise.all(docentes.map((d) => this.notificaciones.crear({
      usuarioId: d.id,
      tipo: 'estudiante_riesgo',
      titulo: 'Estudiante en riesgo',
      mensaje: `${nombre} muestra baja tasa de acierto o inactividad prolongada. Revisa su seguimiento.`,
      enlace: `/docente/estudiantes/${estudianteId}`,
      refId: estudianteId,
    })));
  }

  private async umbrales(): Promise<UmbralesRiesgo> {
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    return {
      diasInactivo: cfg?.riesgoDiasInactivo ?? 7,
      tasaAciertoMin: cfg?.riesgoTasaAciertoMin ?? 40,
      minIntentos: cfg?.riesgoMinIntentos ?? 4,
    };
  }

  /** Clasifica el estado de un estudiante según su actividad y los umbrales. */
  private clasificar(
    u: { totalIntentos: number; correctos: number; ultimaActividad: Date | null; nivelesCompletados: number; nivelesTotal: number },
    umb: UmbralesRiesgo,
  ): EstadoEstudiante {
    if (u.nivelesTotal > 0 && u.nivelesCompletados >= u.nivelesTotal) return 'completado';

    const tasa = u.totalIntentos > 0 ? (u.correctos / u.totalIntentos) * 100 : 0;
    if (u.totalIntentos >= umb.minIntentos && tasa < umb.tasaAciertoMin) return 'en_riesgo';

    if (!u.ultimaActividad) return 'inactivo';
    const dias = Math.floor((Date.now() - u.ultimaActividad.getTime()) / MS_DIA);
    if (dias > umb.diasInactivo) return 'inactivo';

    return 'en_progreso';
  }

  async listar() {
    const [umb, niveles, estudiantes] = await Promise.all([
      this.umbrales(),
      this.prisma.nivel.findMany({ orderBy: { numero: 'asc' } }),
      this.prisma.usuario.findMany({
        where: { rol: 'estudiante' },
        orderBy: { nombre: 'asc' },
        include: { ranking: true, progreso: true },
      }),
    ]);
    const nivelesTotal = niveles.length;
    const umbralPorNivel = new Map(niveles.map((n) => [n.id, n.umbral]));
    const numeroPorNivel = new Map(niveles.map((n) => [n.id, n.numero]));

    // Intentos de todos los estudiantes de una sola vez (evita N+1).
    const intentos = await this.prisma.intento.findMany({
      select: { usuarioId: true, ejercicioId: true, correcto: true, fecha: true },
    });
    const porUsuario = new Map<number, { total: number; correctos: number; completados: Set<number>; ultima: Date | null }>();
    for (const it of intentos) {
      const e = porUsuario.get(it.usuarioId) ?? { total: 0, correctos: 0, completados: new Set<number>(), ultima: null };
      e.total++;
      if (it.correcto) { e.correctos++; e.completados.add(it.ejercicioId); }
      if (!e.ultima || it.fecha > e.ultima) e.ultima = it.fecha;
      porUsuario.set(it.usuarioId, e);
    }

    return estudiantes.map((u) => {
      const agg = porUsuario.get(u.id) ?? { total: 0, correctos: 0, completados: new Set<number>(), ultima: null };
      const desbloqueados = u.progreso.filter((p) => p.desbloqueado);
      const nivelActual = desbloqueados.length
        ? Math.max(...desbloqueados.map((p) => numeroPorNivel.get(p.nivelId) ?? 1))
        : 1;
      const nivelesCompletados = u.progreso.filter(
        (p) => p.ejerciciosCompletados >= (umbralPorNivel.get(p.nivelId) ?? Infinity),
      ).length;
      const ultimaActividad = u.ranking?.ultimaActividad ?? agg.ultima ?? null;

      const estado = this.clasificar(
        { totalIntentos: agg.total, correctos: agg.correctos, ultimaActividad, nivelesCompletados, nivelesTotal },
        umb,
      );

      return {
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        nivel_actual: nivelActual,
        xp: u.ranking?.xpTotal ?? 0,
        ejercicios_completados: agg.completados.size,
        ultima_sesion: ultimaActividad,
        estado,
      };
    }).map((r) => {
      // Best-effort y sin bloquear la respuesta: avisa a los docentes una vez por día.
      if (r.estado === 'en_riesgo') this.notificarRiesgoSiNuevo(r.id, r.nombre).catch(() => undefined);
      return r;
    });
  }

  async detalle(estudianteId: number, docenteId: number) {
    const u = await this.prisma.usuario.findFirst({
      where: { id: estudianteId, rol: 'estudiante' },
      include: { ranking: true, progreso: true, evaluaciones: true },
    });
    if (!u) throw new NotFoundException('Estudiante no encontrado');

    const [umb, niveles, intentos, nota] = await Promise.all([
      this.umbrales(),
      this.prisma.nivel.findMany({ orderBy: { numero: 'asc' } }),
      this.prisma.intento.findMany({
        where: { usuarioId: estudianteId },
        orderBy: { fecha: 'desc' },
        include: { ejercicio: { select: { titulo: true, categoria: true, tipo: true, respuestaCorrecta: true } } },
      }),
      this.prisma.notaDocente.findUnique({
        where: { estudianteId_docenteId: { estudianteId, docenteId } },
      }),
    ]);

    const umbralPorNivel = new Map(niveles.map((n) => [n.id, n.umbral]));
    const progresoPorNivel = niveles.map((n) => {
      const pr = u.progreso.find((p) => p.nivelId === n.id);
      const completados = pr?.ejerciciosCompletados ?? 0;
      const completo = completados >= n.umbral;
      return {
        numero: n.numero, titulo: n.titulo, umbral: n.umbral,
        ejercicios_completados: completados,
        desbloqueado: pr?.desbloqueado ?? n.numero === 1,
        estado: completo ? 'completado' : pr?.desbloqueado ? 'en_progreso' : 'bloqueado',
      };
    });

    // Gráfico de actividad (últimos 7 días).
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const actividad: { dia: string; intentos: number; aciertos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy); d.setDate(hoy.getDate() - i);
      const sig = new Date(d); sig.setDate(d.getDate() + 1);
      const delDia = intentos.filter((it) => it.fecha >= d && it.fecha < sig);
      actividad.push({
        dia: d.toISOString().slice(0, 10),
        intentos: delDia.length,
        aciertos: delDia.filter((it) => it.correcto).length,
      });
    }

    const total = intentos.length;
    const correctos = intentos.filter((it) => it.correcto).length;
    const completados = new Set(intentos.filter((it) => it.correcto).map((it) => it.ejercicioId));
    const nivelesCompletados = u.progreso.filter(
      (p) => p.ejerciciosCompletados >= (umbralPorNivel.get(p.nivelId) ?? Infinity),
    ).length;
    const ultimaActividad = u.ranking?.ultimaActividad ?? intentos[0]?.fecha ?? null;
    const estado = this.clasificar(
      { totalIntentos: total, correctos, ultimaActividad, nivelesCompletados, nivelesTotal: niveles.length },
      umb,
    );

    const pre = u.evaluaciones.find((e) => e.tipo === 'pre');
    const post = u.evaluaciones.find((e) => e.tipo === 'post');

    // Patrones de error recurrentes (mismo detector que usa ALVARO): nutre el
    // seguimiento del docente sobre las debilidades concretas del estudiante.
    const patronesError = detectarPatrones(intentos.map((it) => ({
      correcto: it.correcto,
      respuestaDada: it.respuestaDada ?? '',
      categoria: it.ejercicio.categoria,
      tipo: it.ejercicio.tipo,
      respuestaCorrecta: it.ejercicio.respuestaCorrecta,
    })));

    return {
      estudiante: {
        // SIN `grupo`: ver la nota de separación al inicio del archivo.
        id: u.id, nombre: u.nombre, email: u.email, carrera: u.carrera,
        estado, xp: u.ranking?.xpTotal ?? 0, racha_dias: u.ranking?.rachaDias ?? 0,
        ejercicios_completados: completados.size, total_intentos: total,
        tasa_acierto: total ? Math.round((correctos / total) * 100) : 0,
        ultima_sesion: ultimaActividad,
      },
      progreso_niveles: progresoPorNivel,
      actividad,
      historial: intentos.slice(0, 15).map((it) => ({
        titulo: it.ejercicio.titulo, categoria: it.ejercicio.categoria,
        correcto: it.correcto, xp: it.xpOtorgado, tiempo_seg: it.tiempoSeg, fecha: it.fecha,
      })),
      patrones_error: patronesError.map((p) => ({ clave: p.clave, descripcion: p.descripcion, frecuencia: p.frecuencia })),
      pretest: pre ? { puntaje: pre.puntajeTotal, tiempo_seg: pre.tiempoSeg, por_categoria: pre.porCategoria, fecha: pre.fecha } : null,
      postest: post ? { puntaje: post.puntajeTotal, tiempo_seg: post.tiempoSeg, por_categoria: post.porCategoria, fecha: post.fecha } : null,
      ganancia: pre && post ? post.puntajeTotal - pre.puntajeTotal : null,
      nota: nota?.texto ?? '',
    };
  }

  async guardarNota(estudianteId: number, docenteId: number, texto: string) {
    const existe = await this.prisma.usuario.findFirst({ where: { id: estudianteId, rol: 'estudiante' }, select: { id: true } });
    if (!existe) throw new NotFoundException('Estudiante no encontrado');
    await this.prisma.notaDocente.upsert({
      where: { estudianteId_docenteId: { estudianteId, docenteId } },
      create: { estudianteId, docenteId, texto },
      update: { texto },
    });
    return { ok: true };
  }
}
