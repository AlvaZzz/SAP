import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { corregir } from './correccion';
import {
  ORDEN_NIVEL,
  ETIQUETA_NIVEL,
  siguienteNivel,
  nivelInferior,
} from '../common/niveles/nivel-dificultad';
import { estimarTheta, informacionItem, redondearTheta, RespuestaIrt } from '../mediciones/irt/irt';

// Campos públicos del ejercicio (sin la respuesta correcta) — igual que el listado.
// Incluye `dificultadB` (parámetro b de Rasch) para la selección adaptativa por IRT.
const SELECT_PUBLICO = {
  id: true, titulo: true, categoria: true, nivelId: true, temaId: true, estrellas: true,
  nivelDificultad: true, dificultadB: true, tipo: true, enunciado: true, codigoPython: true,
  opciones: true, xp: true, maxPistas: true, banco: true,
} satisfies Prisma.EjercicioSelect;

/**
 * ADAPTATIVIDAD por NIVELES (Básico/Intermedio/Avanzado). El banco de ejercicios
 * es EL MISMO para todos (el pretest/postest también, son el instrumento de la
 * tesis); lo que se personaliza es QUÉ NIVEL de ejercicios ve cada estudiante en
 * cada tema:
 *  - El nivel arranca en la clasificación del pretest y es POR TEMA
 *    (ProgresoTema.nivelActual): puede diferir entre temas.
 *  - La ruta FILTRA los ejercicios del tema al nivel actual del estudiante
 *    (fundamento: Teoría de Respuesta al Ítem — ajustar dificultad a la habilidad).
 *  - El estudiante puede SUBIR de nivel en un tema con un mini-diagnóstico corto
 *    del nivel objetivo; si acierta ≥ umbral (por defecto 80%), sube.
 *  - Cada intento (práctica y subida de nivel) se registra como evidencia.
 */
@Injectable()
export class AdaptatividadService {
  constructor(private readonly prisma: PrismaService) {}

  /** Nivel ACTUAL del estudiante en un tema: su ProgresoTema o, si aún no existe, su nivel inicial del pretest. */
  async nivelDeTema(usuarioId: number, temaId: number): Promise<NivelDificultad> {
    const pr = await this.prisma.progresoTema.findUnique({
      where: { usuarioId_temaId: { usuarioId, temaId } },
      select: { nivelActual: true },
    });
    if (pr) return pr.nivelActual;
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } });
    return u?.nivelInicialAdaptativo ?? 'basico';
  }

  /**
   * Ruta de práctica de un tema (o nivel de gamificación): SOLO los ejercicios del
   * nivel actual del estudiante en ese tema. Si ese nivel no tuviera ejercicios,
   * cae al nivel disponible más cercano hacia abajo (para no dejarlo sin práctica).
   * Pendientes primero, resueltos al final (repaso).
   */
  async ruta(usuarioId: number, opts: { nivel?: number; temaId?: number }) {
    // El filtrado por nivel de dificultad solo aplica cuando hay un tema (la ruta
    // por "nivel" de gamificación se mantiene sin filtro de dificultad).
    let nivelActual: NivelDificultad | null = null;
    let nivelUsado: NivelDificultad | null = null;

    if (opts.temaId) {
      nivelActual = await this.nivelDeTema(usuarioId, opts.temaId);
      nivelUsado = await this.nivelConEjercicios(opts.temaId, nivelActual);
    }

    const ejercicios = await this.prisma.ejercicio.findMany({
      where: {
        banco: 'practica', activo: true,
        ...(opts.nivel ? { nivel: { numero: opts.nivel } } : {}),
        ...(opts.temaId ? { temaId: opts.temaId } : {}),
        ...(nivelUsado ? { nivelDificultad: nivelUsado } : {}),
      },
      orderBy: [{ estrellas: 'asc' }, { id: 'asc' }],
      select: SELECT_PUBLICO,
    });

    const resueltos = new Set(
      (await this.prisma.intento.findMany({
        where: { usuarioId, correcto: true, ejercicioId: { in: ejercicios.map((e) => e.id) } },
        distinct: ['ejercicioId'], select: { ejercicioId: true },
      })).map((r) => r.ejercicioId),
    );

    const pendientes = ejercicios.filter((e) => !resueltos.has(e.id));
    const hechos = ejercicios.filter((e) => resueltos.has(e.id));

    // SELECCIÓN ADAPTATIVA (IRT): ordena los pendientes por MÁXIMA INFORMACIÓN
    // respecto a la habilidad estimada θ del estudiante. En el modelo de Rasch la
    // información I(θ)=P(1−P) es máxima cuando la dificultad b del ítem ≈ θ, así
    // que se presentan primero los ejercicios cuyo b está más cerca de θ.
    const theta = await this.thetaActual(usuarioId);
    const pendientesOrdenados =
      theta == null
        ? pendientes
        : [...pendientes].sort((a, b) => informacionItem(theta, b.dificultadB) - informacionItem(theta, a.dificultadB));

    return {
      nivel_actual: nivelActual,
      nivel_actual_label: nivelActual ? ETIQUETA_NIVEL[nivelActual] : null,
      nivel_usado: nivelUsado,
      theta,
      ejercicios: [...pendientesOrdenados, ...hechos],
      pendientes: pendientesOrdenados.length,
    };
  }

  /**
   * HABILIDAD θ ACTUAL del estudiante, re-estimada de forma continua desde TODAS
   * sus respuestas de práctica (MLE del modelo de Rasch, ver src/irt). Si aún no
   * tiene intentos con dificultad b válida, cae a su θ_inicial del pretest; y si
   * tampoco existe, devuelve null (se conserva el orden por defecto).
   */
  async thetaActual(usuarioId: number): Promise<number | null> {
    // ── POR QUÉ AQUÍ YA NO SE RECALCULA DESDE CERO ────────────────────────
    // Antes esta función cargaba TODOS los intentos del usuario y volvía a
    // estimar θ por máxima verosimilitud, en cada llamada. Se invoca desde la
    // ruta adaptativa y desde el acceso a retos, así que con el historial
    // creciendo durante el semestre se degradaba sola: un estudiante con 800
    // intentos pagaba esa consulta cada vez que abría la lista de ejercicios.
    //
    // No hace falta: `ejercicios.service.responder()` ya re-estima θ con todas
    // las respuestas y la PERSISTE en `Usuario.thetaActual` tras cada intento.
    // El valor guardado es el mismo que se calcularía aquí, solo que ya hecho.
    const u = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { thetaActual: true, thetaInicial: true },
    });
    if (u?.thetaActual != null) return u.thetaActual;

    // Sin θ persistida todavía (nunca practicó, o son datos anteriores a que se
    // guardara): se estima una vez desde los intentos que existan, y si tampoco
    // hay, se cae a la θ del diagnóstico inicial.
    const filas = await this.prisma.intento.findMany({
      where: { usuarioId },
      select: { correcto: true, ejercicio: { select: { dificultadB: true } } },
    });
    const respuestas: RespuestaIrt[] = (filas ?? [])
      .filter((f) => typeof f.ejercicio?.dificultadB === 'number')
      .map((f) => ({ b: f.ejercicio!.dificultadB, correcto: !!f.correcto }));
    if (respuestas.length === 0) return u?.thetaInicial ?? null;
    return redondearTheta(estimarTheta(respuestas));
  }

  /** El nivel deseado si tiene ejercicios activos en el tema; si no, baja hasta encontrar uno con ejercicios. */
  private async nivelConEjercicios(temaId: number, deseado: NivelDificultad): Promise<NivelDificultad> {
    let n: NivelDificultad | null = deseado;
    while (n) {
      const count = await this.prisma.ejercicio.count({
        where: { temaId, banco: 'practica', activo: true, nivelDificultad: n },
      });
      if (count > 0) return n;
      n = nivelInferior(n);
    }
    return deseado; // ningún nivel tiene ejercicios → devuelve el deseado (la ruta saldrá vacía)
  }

  /**
   * Registra el paso de la ruta (evidencia para la tesis). Se retiró el ajuste de
   * `dificultadObjetivo`: el nivel ahora es discreto y por tema. `dificultadObjetivo`
   * del paso se conserva como el ORDEN del nivel del ejercicio (1-3) para trazar la
   * progresión. Best-effort: nunca interrumpe el flujo del estudiante.
   */
  async registrarIntento(usuarioId: number, ejercicioId: number, correcto: boolean, nivelDificultad: NivelDificultad, estrellas: number) {
    try {
      await this.prisma.pasoRuta.create({
        data: { usuarioId, ejercicioId, estrellas, dificultadObjetivo: ORDEN_NIVEL[nivelDificultad], correcto },
      });
    } catch {
      /* la evidencia de ruta es best-effort: no interrumpe el flujo del estudiante */
    }
  }

  /** Ruta seguida por el estudiante (evidencia para la tesis). */
  async miRuta(usuarioId: number) {
    const pasos = await this.prisma.pasoRuta.findMany({
      where: { usuarioId },
      orderBy: { fecha: 'asc' },
      include: { ejercicio: { select: { titulo: true, categoria: true, nivelDificultad: true } } },
    });
    return pasos.map((p, i) => ({
      orden: i + 1, ejercicioId: p.ejercicioId, titulo: p.ejercicio.titulo, categoria: p.ejercicio.categoria,
      nivel: p.ejercicio.nivelDificultad, correcto: p.correcto, fecha: p.fecha,
    }));
  }

  // ══════════════════ SUBIR DE NIVEL (mini-diagnóstico) ══════════════════

  /** Config del mini-diagnóstico desde la configuración central (fuente única). */
  private async config() {
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    return {
      preguntas: cfg?.subirNivelPreguntas ?? 5,
      umbral: cfg?.subirNivelUmbral ?? 80,
      esperaHoras: cfg?.subirNivelEsperaHoras ?? 0,
    };
  }

  /**
   * Arranca el mini-diagnóstico para subir de nivel en un tema: valida que no esté
   * ya en Avanzado y que respete el cooldown, y devuelve N preguntas del NIVEL
   * OBJETIVO (sin la respuesta correcta).
   */
  async iniciarSubida(usuarioId: number, temaId: number) {
    const tema = await this.prisma.tema.findUnique({ where: { id: temaId }, select: { id: true, titulo: true, numero: true } });
    if (!tema) throw new NotFoundException('Tema no encontrado');

    const actual = await this.nivelDeTema(usuarioId, temaId);
    const objetivo = siguienteNivel(actual);
    if (!objetivo) throw new BadRequestException('Ya estás en el nivel máximo (Avanzado) de este tema.');

    const cfg = await this.config();
    await this.verificarCooldown(usuarioId, temaId, cfg.esperaHoras);

    const disponibles = await this.prisma.ejercicio.findMany({
      where: { temaId, banco: 'practica', activo: true, nivelDificultad: objetivo },
      select: SELECT_PUBLICO,
    });
    if (disponibles.length === 0) {
      throw new BadRequestException('Aún no hay ejercicios del nivel objetivo en este tema.');
    }

    // Selección aleatoria de hasta N preguntas del nivel objetivo.
    const barajado = [...disponibles].sort(() => Math.random() - 0.5).slice(0, cfg.preguntas);
    return {
      tema: { id: tema.id, numero: tema.numero, titulo: tema.titulo },
      nivel_actual: actual, nivel_actual_label: ETIQUETA_NIVEL[actual],
      nivel_objetivo: objetivo, nivel_objetivo_label: ETIQUETA_NIVEL[objetivo],
      umbral: cfg.umbral, total: barajado.length,
      preguntas: barajado,
    };
  }

  /** Cooldown: rechaza si el último intento NO aprobado es demasiado reciente. */
  private async verificarCooldown(usuarioId: number, temaId: number, esperaHoras: number) {
    if (esperaHoras <= 0) return;
    const ultimo = await this.prisma.intentoSubidaNivel.findFirst({
      where: { usuarioId, temaId, aprobado: false },
      orderBy: { fecha: 'desc' },
      select: { fecha: true },
    });
    if (!ultimo) return;
    const proximo = new Date(ultimo.fecha.getTime() + esperaHoras * 3_600_000);
    if (proximo > new Date()) {
      throw new ForbiddenException(`Debes esperar antes de reintentar subir de nivel. Inténtalo de nuevo más tarde.`);
    }
  }

  /**
   * Evalúa el mini-diagnóstico: corrige en el BACKEND, calcula el %, registra el
   * intento y —si alcanza el umbral— sube el nivel del estudiante en ese tema.
   */
  async evaluarSubida(usuarioId: number, temaId: number, respuestas: { ejercicioId: number; respuesta: string }[]) {
    const tema = await this.prisma.tema.findUnique({ where: { id: temaId }, select: { id: true } });
    if (!tema) throw new NotFoundException('Tema no encontrado');
    if (!respuestas?.length) throw new BadRequestException('No se recibieron respuestas.');

    const actual = await this.nivelDeTema(usuarioId, temaId);
    const objetivo = siguienteNivel(actual);
    if (!objetivo) throw new BadRequestException('Ya estás en el nivel máximo (Avanzado) de este tema.');

    const cfg = await this.config();
    await this.verificarCooldown(usuarioId, temaId, cfg.esperaHoras);

    // Solo se aceptan ejercicios que REALMENTE pertenecen a este tema y nivel objetivo.
    const ids = respuestas.map((r) => r.ejercicioId);
    const ejercicios = await this.prisma.ejercicio.findMany({
      where: { id: { in: ids }, temaId, banco: 'practica', activo: true, nivelDificultad: objetivo },
      select: { id: true, tipo: true, respuestaCorrecta: true, dificultadB: true },
    });
    if (ejercicios.length === 0) throw new BadRequestException('Las preguntas no corresponden al mini-diagnóstico.');

    let correctos = 0;
    const respuestasIrt: RespuestaIrt[] = [];
    for (const ej of ejercicios) {
      const dada = respuestas.find((r) => r.ejercicioId === ej.id)?.respuesta ?? '';
      const ok = corregir(ej.tipo, dada, ej.respuestaCorrecta);
      if (ok) correctos++;
      if (typeof ej.dificultadB === 'number') respuestasIrt.push({ b: ej.dificultadB, correcto: ok });
    }
    const puntaje = Math.round((correctos / ejercicios.length) * 100);
    const aprobado = puntaje >= cfg.umbral;

    await this.prisma.intentoSubidaNivel.create({
      data: { usuarioId, temaId, desde: actual, hacia: objetivo, puntaje, aprobado },
    });

    // IRT: re-estima θ con las NUEVAS respuestas del mini-diagnóstico y lo registra
    // como punto de la evolución de θ (origen = subir_nivel). El nivel se opera con
    // el umbral de % (equivalente al gate por θ del nivel objetivo); θ queda como
    // evidencia cuantitativa del avance de la habilidad.
    if (respuestasIrt.length > 0) {
      const theta = redondearTheta(estimarTheta(respuestasIrt));
      await this.prisma.historialTheta.create({
        data: { usuarioId, theta, origen: 'subir_nivel', n: respuestasIrt.length, temaId },
      });
      await this.prisma.usuario.update({ where: { id: usuarioId }, data: { thetaActual: theta } });
    }

    if (aprobado) {
      await this.prisma.progresoTema.upsert({
        where: { usuarioId_temaId: { usuarioId, temaId } },
        create: { usuarioId, temaId, nivelActual: objetivo, desbloqueado: true },
        update: { nivelActual: objetivo },
      });
    }

    return {
      aprobado, puntaje, umbral: cfg.umbral,
      correctos, total: ejercicios.length,
      nivel_anterior: actual, nivel_anterior_label: ETIQUETA_NIVEL[actual],
      nivel_actual: aprobado ? objetivo : actual,
      nivel_actual_label: ETIQUETA_NIVEL[aprobado ? objetivo : actual],
    };
  }

  /** Historial de intentos de subida de nivel de un tema (para la UI y la tesis). */
  async intentosSubida(usuarioId: number, temaId: number) {
    const filas = await this.prisma.intentoSubidaNivel.findMany({
      where: { usuarioId, temaId },
      orderBy: { fecha: 'desc' },
    });
    return filas.map((f) => ({
      desde: f.desde, hacia: f.hacia, puntaje: f.puntaje, aprobado: f.aprobado, fecha: f.fecha,
    }));
  }
}
