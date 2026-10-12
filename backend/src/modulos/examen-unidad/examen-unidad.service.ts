import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { barajarAlAzar } from '../../common/orden/orden-personal';
import { ETIQUETA_NIVEL, nivelAlMenos, nivelDominioAgregado } from '../../common/niveles/nivel-dificultad';
import { PREGUNTAS_POR_EVALUACION, UMBRAL_APROBACION, aprueba, notaSobre100 } from '../../common/niveles/reglas-evaluacion';
import { temaCompleto } from '../../common/niveles/desbloqueo';
import { corregirGraduado } from '../../ejercicios/correccion';
import { estimarTheta, nivelDesdeTheta, redondearTheta, RespuestaIrt } from '../../mediciones/irt/irt';

// Nivel mínimo que el estudiante debe tener EN CADA TEMA para que se le habilite
// el examen. El examen en sí se aprueba con nota ≥ 80/100 (reglas-evaluacion).
const NIVEL_MIN_APROBAR: NivelDificultad = 'intermedio';

// Campos públicos del ítem (sin la respuesta correcta) para servir el examen.
const SELECT_PUBLICO = {
  id: true, titulo: true, categoria: true, temaId: true, estrellas: true,
  nivelDificultad: true, tipo: true, enunciado: true, codigoPython: true, opciones: true,
  temasIntegrados: true,
} satisfies Prisma.EjercicioSelect;

/**
 * EXAMEN DE FIN DE UNIDAD — la evaluación final de CADA unidad.
 *
 *  · 10 preguntas, calificado sobre 100. Se aprueba con 80 o más.
 *  · Cada pregunta integra 2 o 3 temas o subtemas de la unidad.
 *  · Se habilita solo si el estudiante completó TODOS los temas y subtemas con
 *    nivel Intermedio o superior, o si su docente lo habilitó a mano.
 *  · Las respuestas parciales cuentan su fracción y NO se pueden complementar.
 *  · Aprobarlo es la única forma de desbloquear la unidad siguiente.
 * Cada intento guarda nota, θ (dato complementario) y el detalle por pregunta.
 * Reutiliza el patrón de "subir de nivel" (ver ejercicios/adaptatividad.service).
 */
@Injectable()
export class ExamenUnidadService {
  constructor(private readonly prisma: PrismaService) {}

  private async config() {
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    return {
      preguntas: cfg?.examenUnidadPreguntas ?? PREGUNTAS_POR_EVALUACION,
      umbralPct: cfg?.umbralPorcentaje ?? 80,
      esperaHoras: cfg?.examenUnidadEsperaHoras ?? 0,
    };
  }

  private async unidadOrThrow(unidadId: number) {
    const u = await this.prisma.unidad.findUnique({ where: { id: unidadId }, select: { id: true, numero: true, titulo: true } });
    if (!u) throw new NotFoundException('Unidad no encontrada');
    return u;
  }

  /**
   * REQUISITOS PARA RENDIR EL EXAMEN DE FIN DE UNIDAD.
   *
   * Antes la única condición era haber marcado el repaso como visto, así que con
   * uno o tres temas hechos ya se habilitaba el examen que desbloquea la unidad
   * siguiente. El motivo pedagógico de endurecerlo: pasar a la Unidad 2 con
   * dominio solo Básico de la Unidad 1 arrastra vacíos que hacen fracasar al
   * estudiante más adelante, y el examen deja de medir el cierre de la unidad
   * para medir suerte sobre el poco material que llegó a tocar.
   *
   * Se exigen las DOS condiciones:
   *   1. Todos los temas y subtemas publicados de la unidad, completos. "Completo"
   *      es la misma definición que ya usa la vista del estudiante:
   *      `ProgresoTema.ejerciciosCompletados >= Tema.umbral` (ver UnidadesService).
   *   2. Dominio agregado de la unidad al menos Intermedio, calculado con
   *      `nivelDominioAgregado()` sobre el nivel del estudiante en cada tema. No se
   *      inventa aquí ningún cálculo nuevo: es la misma función que gobierna el
   *      desbloqueo de unidades.
   */
  private async requisitos(usuarioId: number, unidadId: number) {
    const { umbralPct } = await this.config();
    const habilitacion = await this.prisma.habilitacionExamen.findUnique({
      where: { usuarioId_unidadId: { usuarioId, unidadId } },
      include: { docente: { select: { nombre: true } } },
    });
    const temas = await this.prisma.tema.findMany({
      where: { unidadId, publicado: true },
      select: {
        id: true, numero: true, titulo: true, umbral: true,
        progreso: { where: { usuarioId }, select: { ejerciciosCompletados: true, nivelActual: true } },
      },
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
    });

    const pendientes = temas.filter((t) => !temaCompleto(t.progreso[0]?.ejerciciosCompletados ?? 0, t.umbral, umbralPct));
    // Cada tema y subtema debe estar, como mínimo, en Intermedio (no el promedio).
    const bajoNivel = temas.filter((t) => !nivelAlMenos(t.progreso[0]?.nivelActual ?? 'basico', NIVEL_MIN_APROBAR));
    // Un tema que el estudiante nunca tocó cuenta como Básico: no tener progreso no
    // puede valer lo mismo que haberlo trabajado hasta Intermedio.
    const niveles = temas.map((t) => t.progreso[0]?.nivelActual ?? 'basico');
    const { dominioPct, nivelDominio } = nivelDominioAgregado(niveles);

    return {
      temas_total: temas.length,
      temas_completos: temas.length - pendientes.length,
      temas_pendientes: pendientes.map((t) => `${t.numero} ${t.titulo}`),
      dominio_pct: dominioPct,
      nivel_dominio: nivelDominio,
      nivel_dominio_label: ETIQUETA_NIVEL[nivelDominio],
      // Una unidad sin temas publicados no puede exigir temas completos: en ese
      // caso el requisito de cobertura se considera cumplido y manda el dominio.
      temas_ok: pendientes.length === 0,
      nivel_ok: bajoNivel.length === 0,
      temas_bajo_nivel: bajoNivel.map((t) => `${t.numero} ${t.titulo}`),
      // Habilitación manual del docente: salta los dos requisitos anteriores.
      habilitado_por_docente: !!habilitacion,
      habilitado_por: habilitacion?.docente?.nombre ?? null,
    };
  }

  /** Mensaje que dice al estudiante QUÉ le falta, no un rechazo genérico. */
  private motivoBloqueo(r: Awaited<ReturnType<ExamenUnidadService['requisitos']>>): string | null {
    if (r.habilitado_por_docente) return null;
    if (!r.temas_ok) {
      const faltan = r.temas_total - r.temas_completos;
      return `Te falta completar ${faltan} tema(s) de esta unidad antes del examen: ${r.temas_pendientes.slice(0, 3).join(', ')}` +
        `${r.temas_pendientes.length > 3 ? `, y ${r.temas_pendientes.length - 3} más` : ''}.`;
    }
    if (!r.nivel_ok) {
      return `Para rendir el examen necesitas al menos nivel ${ETIQUETA_NIVEL[NIVEL_MIN_APROBAR]} en TODOS los temas. ` +
        `Te falta subir de nivel en: ${r.temas_bajo_nivel.slice(0, 3).join(', ')}` +
        `${r.temas_bajo_nivel.length > 3 ? `, y ${r.temas_bajo_nivel.length - 3} más` : ''}. ` +
        'Si crees que ya estás listo, pide a tu docente que te habilite.';
    }
    return null;
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

    const [repaso, aprobadoRow, ultimo, itemsDisponibles, req] = await Promise.all([
      this.prisma.repasoUnidad.findUnique({ where: { usuarioId_unidadId: { usuarioId, unidadId } } }),
      this.prisma.examenUnidad.findFirst({ where: { usuarioId, unidadId, aprobado: true }, select: { id: true } }),
      this.prisma.examenUnidad.findFirst({ where: { usuarioId, unidadId }, orderBy: { fecha: 'desc' } }),
      this.prisma.ejercicio.count({ where: { banco: 'examen', activo: true, temaId: { in: temaIds } } }),
      this.requisitos(usuarioId, unidadId),
    ]);
    // El estudiante ve su avance hacia el examen ANTES de pulsar el botón; el
    // bloqueo no debe descubrirse al intentarlo.
    const bloqueo = this.motivoBloqueo(req);

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
      requisitos: {
        temas_total: req.temas_total,
        temas_completos: req.temas_completos,
        temas_pendientes: req.temas_pendientes,
        temas_ok: req.temas_ok,
        dominio_pct: req.dominio_pct,
        nivel_dominio: req.nivel_dominio,
        nivel_dominio_label: req.nivel_dominio_label,
        nivel_ok: req.nivel_ok,
        nivel_requerido: NIVEL_MIN_APROBAR,
        nivel_requerido_label: ETIQUETA_NIVEL[NIVEL_MIN_APROBAR],
        temas_bajo_nivel: req.temas_bajo_nivel,
        habilitado_por_docente: req.habilitado_por_docente,
        habilitado_por: req.habilitado_por,
      },
      nota_aprobacion: UMBRAL_APROBACION,
      motivo_bloqueo: bloqueo,
      puede_intentar: repasoRevisado && !aprobado && hayBanco && !enCooldown && !bloqueo,
      en_cooldown: enCooldown,
      cooldown_hasta: enCooldown ? cooldownHasta : null,
      ultimo_intento: ultimo
        ? { nivel: ultimo.nivel, nivel_label: ETIQUETA_NIVEL[ultimo.nivel], puntaje: ultimo.puntaje, aprobado: ultimo.aprobado, fecha: ultimo.fecha }
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

    // Cobertura y dominio: las dos condiciones reales de cierre de unidad.
    const bloqueo = this.motivoBloqueo(await this.requisitos(usuarioId, unidadId));
    if (bloqueo) throw new ForbiddenException(bloqueo);

    const aprobado = await this.prisma.examenUnidad.findFirst({ where: { usuarioId, unidadId, aprobado: true }, select: { id: true } });
    if (aprobado) throw new BadRequestException('Ya aprobaste el examen de esta unidad.');

    await this.verificarCooldown(usuarioId, unidadId, cfg.esperaHoras);

    const temaIds = await this.temasDeUnidad(unidadId);
    const disponibles = await this.prisma.ejercicio.findMany({
      where: { banco: 'examen', activo: true, temaId: { in: temaIds } },
      select: SELECT_PUBLICO,
    });
    if (disponibles.length === 0) throw new BadRequestException('Aún no hay preguntas de examen para esta unidad.');

    // Selección: primero las preguntas INTEGRADORAS (2 o más temas) de nivel
    // Intermedio, que son las que el examen debe tener; el resto solo completa
    // hasta 10 si el banco aún es corto. Dentro de cada grupo, al azar.
    const prioridad = (e: { temasIntegrados: number[]; nivelDificultad: NivelDificultad }) =>
      (e.temasIntegrados.length >= 2 ? 0 : 2) + (e.nivelDificultad === 'intermedio' ? 0 : 1);
    const seleccion = [...disponibles]
      .map((e) => ({ e, azar: Math.random() }))
      .sort((a, b) => prioridad(a.e) - prioridad(b.e) || a.azar - b.azar)
      .slice(0, cfg.preguntas)
      .map(({ e }) => e);
    // Cada intento sale en un orden distinto para cada estudiante.
    const barajado = barajarAlAzar(seleccion);
    return {
      unidad: { id: unidad.id, numero: unidad.numero, titulo: unidad.titulo },
      total: barajado.length,
      nota_aprobacion: UMBRAL_APROBACION,
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
      select: { id: true, titulo: true, tipo: true, respuestaCorrecta: true, dificultadB: true, temaId: true, tema: { select: { numero: true, titulo: true } } },
    });
    if (ejercicios.length === 0) throw new BadRequestException('Las preguntas no corresponden al examen de esta unidad.');

    const respuestasIrt: RespuestaIrt[] = [];
    let correctos = 0;
    const puntajes: number[] = [];
    const detalle: { ejercicioId: number; titulo: string; tema: string | null; estado: string; puntaje: number }[] = [];
    // Acumula acierto/total por tema para la retroalimentación.
    const porTema = new Map<number, { numero: string; titulo: string; aciertos: number; total: number }>();
    for (const ej of ejercicios) {
      const dada = respuestas.find((r) => r.ejercicioId === ej.id)?.respuesta ?? '';
      // Corrección GRADUADA: una respuesta parcial cuenta su fracción. En el examen
      // no se puede complementar: queda como se envió.
      const res = corregirGraduado(ej.tipo, dada, ej.respuestaCorrecta);
      const ok = res.estado === 'correcta';
      if (ok) correctos++;
      puntajes.push(res.puntaje);
      detalle.push({ ejercicioId: ej.id, titulo: ej.titulo, tema: ej.tema ? `${ej.tema.numero} ${ej.tema.titulo}` : null, estado: res.estado, puntaje: res.puntaje });
      if (typeof ej.dificultadB === 'number') respuestasIrt.push({ b: ej.dificultadB, correcto: ok });
      if (ej.temaId && ej.tema) {
        const g = porTema.get(ej.temaId) ?? { numero: ej.tema.numero, titulo: ej.tema.titulo, aciertos: 0, total: 0 };
        g.total++; g.aciertos += res.puntaje;
        porTema.set(ej.temaId, g);
      }
    }

    const total = ejercicios.length;
    // NOTA SOBRE 100 (con fracciones de las parciales). Se aprueba con 80 o más.
    const puntaje = notaSobre100(puntajes);
    const aprobado = aprueba(puntaje);
    // θ se sigue estimando y guardando como dato complementario; ya NO decide.
    const theta = respuestasIrt.length > 0 ? redondearTheta(estimarTheta(respuestasIrt)) : null;
    const nivel = theta != null ? nivelDesdeTheta(theta) : 'basico';
    const parciales = detalle.filter((d) => d.estado === 'parcial').length;

    await this.prisma.examenUnidad.create({
      data: { usuarioId, unidadId, theta, nivel, puntaje, aprobado, aciertos: correctos, total, detalle },
    });
    if (theta != null) {
      await this.prisma.historialTheta.create({ data: { usuarioId, theta, origen: 'examen_unidad', n: respuestasIrt.length } });
    }

    // Temas a reforzar: los de menor desempeño (< 60%), como retroalimentación.
    const temasReforzar = [...porTema.values()]
      .filter((t) => (t.total ? t.aciertos / t.total : 0) < 0.6)
      .map((t) => `${t.numero} ${t.titulo}`);

    return {
      aprobado, puntaje, correctos, parciales, total,
      nota_aprobacion: UMBRAL_APROBACION,
      nivel, nivel_label: ETIQUETA_NIVEL[nivel],
      requiere_nivel: NIVEL_MIN_APROBAR, requiere_nivel_label: ETIQUETA_NIVEL[NIVEL_MIN_APROBAR],
      temas_reforzar: temasReforzar,
    };
  }
}
