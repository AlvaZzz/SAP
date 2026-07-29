import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ETIQUETA_NIVEL, nivelAlMenos } from '../../common/niveles/nivel-dificultad';
import { corregir } from '../../ejercicios/correccion';
import { estimarTheta, nivelDesdeTheta, redondearTheta, RespuestaIrt } from '../../mediciones/irt/irt';

// Nivel mínimo de dominio (θ) para APROBAR el examen y avanzar de unidad.
const NIVEL_MIN_APROBAR: NivelDificultad = 'intermedio';

// Campos públicos del ítem (sin la respuesta correcta) para servir el examen.
const SELECT_PUBLICO = {
  id: true, titulo: true, categoria: true, temaId: true, estrellas: true,
  nivelDificultad: true, tipo: true, enunciado: true, codigoPython: true, opciones: true,
} satisfies Prisma.EjercicioSelect;

/**
 * EXAMEN DE FIN DE UNIDAD — instrumento INTERNO de avance (distinto del pretest/
 * postest). Valida el paso a la siguiente unidad: el estudiante repasa la unidad,
 * rinde un examen del banco 'examen' de sus temas, y si su desempeño estimado por
 * IRT (θ) alcanza al menos nivel Intermedio, APRUEBA y se desbloquea la siguiente
 * unidad. Cada intento se registra (θ, nivel, puntaje, aprobado) para la tesis.
 * Reutiliza el patrón de "subir de nivel" (ver ejercicios/adaptatividad.service).
 */
@Injectable()
export class ExamenUnidadService {
  constructor(private readonly prisma: PrismaService) {}

  private async config() {
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    return {
      preguntas: cfg?.examenUnidadPreguntas ?? 8,
      esperaHoras: cfg?.examenUnidadEsperaHoras ?? 0,
    };
  }

  private async unidadOrThrow(unidadId: number) {
    const u = await this.prisma.unidad.findUnique({ where: { id: unidadId }, select: { id: true, numero: true, titulo: true } });
    if (!u) throw new NotFoundException('Unidad no encontrada');
    return u;
  }

  /** IDs de los temas (y subtemas) de la unidad. */
  private async temasDeUnidad(unidadId: number): Promise<number[]> {
    const temas = await this.prisma.tema.findMany({ where: { unidadId }, select: { id: true } });
    return temas.map((t) => t.id);
  }

  /** Estado del examen de la unidad para el estudiante (gate, cooldown, último intento). */
  async estado(usuarioId: number, unidadId: number) {
    const unidad = await this.unidadOrThrow(unidadId);
    const cfg = await this.config();
    const temaIds = await this.temasDeUnidad(unidadId);

    const [repaso, aprobadoRow, ultimo, itemsDisponibles] = await Promise.all([
      this.prisma.repasoUnidad.findUnique({ where: { usuarioId_unidadId: { usuarioId, unidadId } } }),
      this.prisma.examenUnidad.findFirst({ where: { usuarioId, unidadId, aprobado: true }, select: { id: true } }),
      this.prisma.examenUnidad.findFirst({ where: { usuarioId, unidadId }, orderBy: { fecha: 'desc' } }),
      this.prisma.ejercicio.count({ where: { banco: 'examen', activo: true, temaId: { in: temaIds } } }),
    ]);

    const repasoRevisado = !!repaso;
    const aprobado = !!aprobadoRow;
    const cooldownHasta = this.cooldownHasta(ultimo, cfg.esperaHoras);
    const enCooldown = cooldownHasta != null && cooldownHasta > new Date();
    const hayBanco = itemsDisponibles >= 1;

    return {
      unidad: { id: unidad.id, numero: unidad.numero, titulo: unidad.titulo },
      repaso_revisado: repasoRevisado,
      aprobado,
      hay_banco: hayBanco,
      items_disponibles: itemsDisponibles,
      total_preguntas: Math.min(cfg.preguntas, itemsDisponibles),
      puede_intentar: repasoRevisado && !aprobado && hayBanco && !enCooldown,
      en_cooldown: enCooldown,
      cooldown_hasta: enCooldown ? cooldownHasta : null,
      ultimo_intento: ultimo
        ? { theta: ultimo.theta, nivel: ultimo.nivel, nivel_label: ETIQUETA_NIVEL[ultimo.nivel], puntaje: ultimo.puntaje, aprobado: ultimo.aprobado, fecha: ultimo.fecha }
        : null,
    };
  }

  private cooldownHasta(ultimo: { fecha: Date; aprobado: boolean } | null, esperaHoras: number): Date | null {
    if (!ultimo || ultimo.aprobado || esperaHoras <= 0) return null;
    return new Date(ultimo.fecha.getTime() + esperaHoras * 3_600_000);
  }

  /** Temas de la unidad con su contenido de REPASO (una pestaña por tema). */
  async repaso(unidadId: number) {
    await this.unidadOrThrow(unidadId);
    const temas = await this.prisma.tema.findMany({
      where: { unidadId },
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      select: { id: true, numero: true, titulo: true, repaso: true, descripcion: true },
    });
    return temas;
  }

  /** Marca el repaso de la unidad como revisado (habilita el examen). */
  async completarRepaso(usuarioId: number, unidadId: number) {
    await this.unidadOrThrow(unidadId);
    await this.prisma.repasoUnidad.upsert({
      where: { usuarioId_unidadId: { usuarioId, unidadId } },
      create: { usuarioId, unidadId },
      update: {},
    });
    return { completado: true };
  }

  /** Sirve las preguntas del examen (sin la respuesta correcta). Valida gate y cooldown. */
  async iniciar(usuarioId: number, unidadId: number) {
    const unidad = await this.unidadOrThrow(unidadId);
    const cfg = await this.config();

    const repaso = await this.prisma.repasoUnidad.findUnique({ where: { usuarioId_unidadId: { usuarioId, unidadId } } });
    if (!repaso) throw new BadRequestException('Revisa el repaso de la unidad antes de rendir el examen.');

    const aprobado = await this.prisma.examenUnidad.findFirst({ where: { usuarioId, unidadId, aprobado: true }, select: { id: true } });
    if (aprobado) throw new BadRequestException('Ya aprobaste el examen de esta unidad.');

    await this.verificarCooldown(usuarioId, unidadId, cfg.esperaHoras);

    const temaIds = await this.temasDeUnidad(unidadId);
    const disponibles = await this.prisma.ejercicio.findMany({
      where: { banco: 'examen', activo: true, temaId: { in: temaIds } },
      select: SELECT_PUBLICO,
    });
    if (disponibles.length === 0) throw new BadRequestException('Aún no hay preguntas de examen para esta unidad.');

    const barajado = [...disponibles].sort(() => Math.random() - 0.5).slice(0, cfg.preguntas);
    return {
      unidad: { id: unidad.id, numero: unidad.numero, titulo: unidad.titulo },
      total: barajado.length,
      requiere_nivel: NIVEL_MIN_APROBAR,
      requiere_nivel_label: ETIQUETA_NIVEL[NIVEL_MIN_APROBAR],
      preguntas: barajado,
    };
  }

  private async verificarCooldown(usuarioId: number, unidadId: number, esperaHoras: number) {
    if (esperaHoras <= 0) return;
    const ultimo = await this.prisma.examenUnidad.findFirst({
      where: { usuarioId, unidadId, aprobado: false },
      orderBy: { fecha: 'desc' },
      select: { fecha: true },
    });
    if (!ultimo) return;
    const proximo = new Date(ultimo.fecha.getTime() + esperaHoras * 3_600_000);
    if (proximo > new Date()) throw new ForbiddenException('Debes esperar antes de reintentar el examen de la unidad.');
  }

  /**
   * Evalúa el examen: corrige en el BACKEND, estima θ (IRT/Rasch) desde el patrón
   * de respuestas, deriva el nivel de dominio y determina si APRUEBA (≥ Intermedio).
   * Registra el intento (ExamenUnidad) y un punto de la evolución de θ. Devuelve
   * retroalimentación por tema (temas a reforzar). El avance a la siguiente unidad
   * lo habilita el gate al existir un intento aprobado.
   */
  async evaluar(usuarioId: number, unidadId: number, respuestas: { ejercicioId: number; respuesta: string }[]) {
    await this.unidadOrThrow(unidadId);
    if (!respuestas?.length) throw new BadRequestException('No se recibieron respuestas.');

    const aprobadoPrevio = await this.prisma.examenUnidad.findFirst({ where: { usuarioId, unidadId, aprobado: true }, select: { id: true } });
    if (aprobadoPrevio) throw new BadRequestException('Ya aprobaste el examen de esta unidad.');

    const cfg = await this.config();
    await this.verificarCooldown(usuarioId, unidadId, cfg.esperaHoras);

    const temaIds = await this.temasDeUnidad(unidadId);
    const ids = respuestas.map((r) => r.ejercicioId);
    const ejercicios = await this.prisma.ejercicio.findMany({
      where: { id: { in: ids }, banco: 'examen', activo: true, temaId: { in: temaIds } },
      select: { id: true, tipo: true, respuestaCorrecta: true, dificultadB: true, temaId: true, tema: { select: { numero: true, titulo: true } } },
    });
    if (ejercicios.length === 0) throw new BadRequestException('Las preguntas no corresponden al examen de esta unidad.');

    const respuestasIrt: RespuestaIrt[] = [];
    let correctos = 0;
    // Acumula acierto/total por tema para la retroalimentación.
    const porTema = new Map<number, { numero: string; titulo: string; aciertos: number; total: number }>();
    for (const ej of ejercicios) {
      const dada = respuestas.find((r) => r.ejercicioId === ej.id)?.respuesta ?? '';
      const ok = corregir(ej.tipo, dada, ej.respuestaCorrecta);
      if (ok) correctos++;
      if (typeof ej.dificultadB === 'number') respuestasIrt.push({ b: ej.dificultadB, correcto: ok });
      if (ej.temaId && ej.tema) {
        const g = porTema.get(ej.temaId) ?? { numero: ej.tema.numero, titulo: ej.tema.titulo, aciertos: 0, total: 0 };
        g.total++; if (ok) g.aciertos++;
        porTema.set(ej.temaId, g);
      }
    }

    const total = ejercicios.length;
    const puntaje = Math.round((correctos / total) * 100);
    const theta = respuestasIrt.length > 0 ? redondearTheta(estimarTheta(respuestasIrt)) : null;
    const nivel = theta != null ? nivelDesdeTheta(theta) : 'basico';
    const aprobado = nivelAlMenos(nivel, NIVEL_MIN_APROBAR);

    await this.prisma.examenUnidad.create({
      data: { usuarioId, unidadId, theta, nivel, puntaje, aprobado, aciertos: correctos, total },
    });
    if (theta != null) {
      await this.prisma.historialTheta.create({ data: { usuarioId, theta, origen: 'examen_unidad', n: respuestasIrt.length } });
    }

    // Temas a reforzar: los de menor desempeño (< 60%), como retroalimentación.
    const temasReforzar = [...porTema.values()]
      .filter((t) => (t.total ? t.aciertos / t.total : 0) < 0.6)
      .map((t) => `${t.numero} ${t.titulo}`);

    return {
      aprobado, puntaje, correctos, total,
      theta,
      nivel, nivel_label: ETIQUETA_NIVEL[nivel],
      requiere_nivel: NIVEL_MIN_APROBAR, requiere_nivel_label: ETIQUETA_NIVEL[NIVEL_MIN_APROBAR],
      temas_reforzar: temasReforzar,
    };
  }
}
