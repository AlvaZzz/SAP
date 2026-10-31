import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Banco, NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ordenPersonal, barajarAlAzar } from '../common/orden/orden-personal';
import { corregirGraduado } from './correccion';
import { PREGUNTAS_POR_EVALUACION, UMBRAL_APROBACION, notaSobre100 } from '../common/niveles/reglas-evaluacion';
import {
  ORDEN_NIVEL,
  ETIQUETA_NIVEL,
  siguienteNivel,
  nivelInferior,
  retoAlAlcance,
} from '../common/niveles/nivel-dificultad';
import { estimarTheta, informacionItem, redondearTheta, RespuestaIrt } from '../mediciones/irt/irt';
import { avanceTemaGuardado } from '../common/niveles/desbloqueo';

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

  /* ══════════════════════════════════════════════════════════════════════
     GATING ESTRICTO POR NIVEL — PUNTO ÚNICO DE VERDAD

     La regla del sistema es: un estudiante con nivel N en un tema practica SOLO
     los ítems de nivel N de ESE tema. Hasta ahora la regla vivía únicamente en
     los listados (`ruta()` y `RetosService.disponibles()`), no en el acceso
     directo ni en el envío: con un id antiguo, o desde las DevTools, se podía
     abrir, responder y GANAR XP por un ejercicio de otro nivel. Eso contamina
     XP, ranking, rangos y θ — es decir, los datos del estudio.

     Toda la comparación y el mensaje de rechazo viven aquí. Las cuatro rutas
     protegidas (`GET /ejercicios/:id`, `POST /intentos`, `GET /retos/:id`,
     `POST /retos/:id/entregar`) llaman a estos métodos y no repiten la lógica.
     ══════════════════════════════════════════════════════════════════════ */

  /**
   * Bancos EXENTOS del gating, por diseño y no por descuido:
   *  · `examen`  — el examen de fin de unidad mezcla intermedio y avanzado a
   *                propósito; filtrarlo por nivel lo dejaría incompleto.
   *  · `pretest` — instrumento de medición: idéntico para todos los estudiantes.
   *  · `postest` — ídem, y su comparabilidad con el pretest es la hipótesis.
   */
  private static readonly BANCOS_EXENTOS: Banco[] = ['examen', 'pretest', 'postest'];

  /** Roles que gestionan contenido y deben poder ver cualquier ítem. */
  private static readonly ROLES_SIN_GATING = new Set(['docente', 'admin', 'investigador']);

  /**
   * Nivel que la RUTA sirve hoy en este tema. No es siempre el nivel del
   * estudiante: si su nivel no tiene ejercicios en el tema, `ruta()` cae al
   * inmediato inferior para no dejarlo sin práctica. El gate debe resolver el
   * nivel EXACTAMENTE igual que el listado, o rechazaría ejercicios que la propia
   * ruta acaba de ofrecer.
   */
  async nivelServidoEnTema(usuarioId: number, temaId: number): Promise<NivelDificultad> {
    return this.nivelConEjercicios(temaId, await this.nivelDeTema(usuarioId, temaId));
  }

  /**
   * Comparación y rechazo. El mensaje es para el estudiante: dice qué pasa y no
   * revela nada del ítem (ni su nivel, ni su contenido).
   */
  private rechazarSiNoCoincide(nivelItem: NivelDificultad, nivelEstudiante: NivelDificultad, que: 'ejercicio' | 'reto') {
    if (nivelItem === nivelEstudiante) return;
    throw new ForbiddenException(
      `Este ${que} no corresponde a tu nivel actual en este tema. ` +
        `Estás practicando en nivel ${ETIQUETA_NIVEL[nivelEstudiante]}.`,
    );
  }

  /**
   * Verifica el acceso a un EJERCICIO. Lanza 403 si no corresponde al nivel.
   *
   * Ítems sin tema (`temaId = null`): se permiten. No cuelgan de ningún
   * `ProgresoTema`, así que no hay nivel contra el que comparar; son los bancos
   * de medición y el contenido antiguo previo a la jerarquía académica. La
   * alternativa —bloquearlos— dejaría inaccesible contenido legítimo.
   */
  async verificarAccesoEjercicio(
    usuarioId: number,
    ej: { temaId: number | null; nivelDificultad: NivelDificultad; banco: Banco },
    rol?: string,
  ): Promise<void> {
    if (rol && AdaptatividadService.ROLES_SIN_GATING.has(rol)) return;
    if (AdaptatividadService.BANCOS_EXENTOS.includes(ej.banco)) return;
    if (ej.temaId == null) return;
    this.rechazarSiNoCoincide(ej.nivelDificultad, await this.nivelServidoEnTema(usuarioId, ej.temaId), 'ejercicio');
  }

  /**
   * Verifica el acceso a un RETO. Igual que los ejercicios, salvo en cómo se
   * resuelve el nivel esperado: `RetosService.disponibles()` compara contra
   * `ProgresoTema.nivelActual` SIN caída a un nivel inferior, así que el gate
   * hace lo mismo. Mezclar las dos resoluciones abriría una grieta justo entre
   * lo que el listado muestra y lo que el acceso directo acepta.
   */
  async verificarAccesoReto(
    usuarioId: number,
    reto: { temaId: number | null; nivelDificultad: NivelDificultad },
    rol?: string,
  ): Promise<void> {
    if (rol && AdaptatividadService.ROLES_SIN_GATING.has(rol)) return;
    if (reto.temaId == null) return;
    // Retos: su nivel, uno anterior o el siguiente (ver retoAlAlcance), igual que el listado.
    const nivel = await this.nivelDeTema(usuarioId, reto.temaId);
    if (retoAlAlcance(reto.nivelDificultad, nivel)) return;
    throw new ForbiddenException(`Este reto está por encima de tu nivel actual en este tema (${ETIQUETA_NIVEL[nivel]}). Sube de nivel para abrirlo.`);
  }

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

    // ORDEN PERSONAL: mismo banco para todos los del nivel, pero cada estudiante
    // lo recorre en su propio orden (estable entre visitas). Ver common/orden.
    const propios = ordenPersonal(ejercicios, usuarioId, opts.temaId ?? 0, opts.nivel ?? 0);
    const pendientes = propios.filter((e) => !resueltos.has(e.id));
    const hechos = propios.filter((e) => resueltos.has(e.id));

    // SELECCIÓN ADAPTATIVA (IRT): ordena los pendientes por MÁXIMA INFORMACIÓN
    // respecto a la habilidad estimada θ del estudiante. En el modelo de Rasch la
    // información I(θ)=P(1−P) es máxima cuando la dificultad b del ítem ≈ θ, así
    // que se presentan primero los ejercicios cuyo b está más cerca de θ.
    // El orden es estable: entre ejercicios de igual información (lo habitual
    // dentro de un nivel) manda el orden personal del estudiante.
    const theta = await this.thetaActual(usuarioId);
    const pendientesOrdenados =
      theta == null
        ? pendientes
        : [...pendientes].sort((a, b) => informacionItem(theta, b.dificultadB) - informacionItem(theta, a.dificultadB));

    // Progreso dentro del nivel (gate del mini-diagnóstico y del cierre de tema).
    const progreso = opts.temaId ? await this.progresoNivel(usuarioId, opts.temaId) : null;

    return {
      nivel_actual: nivelActual,
      nivel_actual_label: nivelActual ? ETIQUETA_NIVEL[nivelActual] : null,
      nivel_usado: nivelUsado,
      theta,
      ejercicios: [...pendientesOrdenados, ...hechos],
      pendientes: pendientesOrdenados.length,
      // IDs PENDIENTES en orden, como lista propia. El detalle de ejercicio
      // navegaba con `ejercicios[idx + 1]`, y como los resueltos van al final de
      // esa misma lista, en cuanto el índice entraba en la cola de resueltos
      // "Siguiente" empezaba a servir ejercicios YA HECHOS teniendo pendientes.
      // Con la lista separada, el front siempre puede pedir el próximo pendiente.
      pendientes_ids: pendientesOrdenados.map((e) => e.id),
      resueltos_ids: hechos.map((e) => e.id),
      progreso_nivel: progreso,
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
      preguntas: cfg?.subirNivelPreguntas ?? PREGUNTAS_POR_EVALUACION,
      umbral: cfg?.subirNivelUmbral ?? UMBRAL_APROBACION,
      esperaHoras: cfg?.subirNivelEsperaHoras ?? 0,
      minimos: {
        basico: cfg?.minPracticaBasico ?? 8,
        intermedio: cfg?.minPracticaIntermedio ?? 8,
        avanzado: cfg?.minPracticaAvanzado ?? 8,
      } as Record<NivelDificultad, number>,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════
     PRÁCTICA MÍNIMA POR NIVEL — PUNTO ÚNICO DE VERDAD

     Antes no había ningún mínimo: `puedeSubir` (en UnidadesService) solo miraba
     que el tema tuviera ejercicios del nivel objetivo, así que el botón
     "¿Intentar subir a nivel X?" aparecía desde el primer momento y el
     mini-diagnóstico lo aceptaba. Un estudiante podía pasar de Básico a
     Avanzado sin resolver un solo ejercicio del nivel que decía haber superado,
     lo que rompe el supuesto de la adaptatividad (y contamina θ y el dominio).

     Ahora hay que RESOLVER un mínimo de ejercicios DEL NIVEL VIGENTE en ESE
     tema antes de poder intentar la subida. Los mínimos son configurables
     (ConfiguracionSistema.minPractica*), no constantes incrustadas.
     ══════════════════════════════════════════════════════════════════════ */

  /**
   * Progreso del estudiante DENTRO de su nivel actual en un tema: cuántos
   * ejercicios de ese nivel ha resuelto, cuántos exige la configuración y
   * cuántos existen. `cumplido` es el gate del mini-diagnóstico.
   *
   * Se cuentan ejercicios DISTINTOS resueltos correctamente (no intentos): dos
   * aciertos sobre el mismo ítem no valen por dos. Si el tema tiene MENOS
   * ejercicios del nivel que el mínimo configurado, el mínimo efectivo es el
   * total disponible — de lo contrario el estudiante quedaría atrapado en un
   * tema al que le falta contenido.
   */
  async progresoNivel(usuarioId: number, temaId: number) {
    const nivel = await this.nivelServidoEnTema(usuarioId, temaId);
    const cfg = await this.config();

    const ejercicios = await this.prisma.ejercicio.findMany({
      where: { temaId, banco: 'practica', activo: true, nivelDificultad: nivel },
      select: { id: true },
    });
    const total = ejercicios.length;
    const resueltos = await this.prisma.intento.findMany({
      where: { usuarioId, correcto: true, ejercicioId: { in: ejercicios.map((e) => e.id) } },
      distinct: ['ejercicioId'],
      select: { ejercicioId: true },
    });

    const minimoConfig = cfg.minimos[nivel] ?? 0;
    const minimo = Math.min(minimoConfig, total);
    const hechos = resueltos.length;
    return {
      nivel,
      nivel_label: ETIQUETA_NIVEL[nivel],
      resueltos: hechos,
      total,
      minimo,
      minimo_config: minimoConfig,
      faltan: Math.max(0, minimo - hechos),
      cumplido: total > 0 && hechos >= minimo,
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
    await this.exigirPracticaMinima(usuarioId, temaId);
    await this.verificarCooldown(usuarioId, temaId, cfg.esperaHoras);

    const disponibles = await this.prisma.ejercicio.findMany({
      where: { temaId, banco: 'practica', activo: true, nivelDificultad: objetivo },
      select: SELECT_PUBLICO,
    });
    if (disponibles.length === 0) {
      throw new BadRequestException('Aún no hay ejercicios del nivel objetivo en este tema.');
    }

    // Selección aleatoria de hasta N preguntas del nivel objetivo.
    const elegidas = barajarAlAzar(disponibles).slice(0, cfg.preguntas);
    // La prueba SIEMPRE llega a N preguntas: si el nivel objetivo tiene menos, se
    // completa con los ejercicios MÁS DIFÍCILES del nivel vigente (mayor b). No se
    // inventa contenido y la prueba sigue midiendo el tramo alto de lo que domina.
    if (elegidas.length < cfg.preguntas) {
      const usados = new Set(elegidas.map((e) => e.id));
      const refuerzo = await this.prisma.ejercicio.findMany({
        where: { temaId, banco: 'practica', activo: true, nivelDificultad: actual },
        orderBy: [{ dificultadB: 'desc' }, { id: 'asc' }],
        select: SELECT_PUBLICO,
      });
      for (const e of refuerzo) {
        if (elegidas.length >= cfg.preguntas) break;
        if (!usados.has(e.id)) { usados.add(e.id); elegidas.push(e); }
      }
    }
    const barajado = barajarAlAzar(elegidas);
    return {
      tema: { id: tema.id, numero: tema.numero, titulo: tema.titulo },
      nivel_actual: actual, nivel_actual_label: ETIQUETA_NIVEL[actual],
      nivel_objetivo: objetivo, nivel_objetivo_label: ETIQUETA_NIVEL[objetivo],
      umbral: cfg.umbral, total: barajado.length,
      preguntas: barajado,
    };
  }

  /**
   * Exige la práctica mínima del nivel vigente antes de dejar subir. Se llama
   * DESDE LAS DOS PUERTAS (`iniciarSubida` y `evaluarSubida`): comprobarlo solo
   * al iniciar dejaría pasar un POST directo a la evaluación con preguntas
   * obtenidas antes, que es justo el hueco que el gating por nivel cierra en el
   * resto del módulo.
   *
   * Va ANTES del cooldown a propósito: no haber practicado no es un reintento
   * fallido, y el mensaje debe decir qué falta en vez de "espera".
   */
  private async exigirPracticaMinima(usuarioId: number, temaId: number) {
    const prog = await this.progresoNivel(usuarioId, temaId);
    if (prog.cumplido) return;
    throw new BadRequestException(
      `Antes de subir de nivel practica un poco más: llevas ${prog.resueltos} de ${prog.minimo} ` +
        `ejercicios de nivel ${prog.nivel_label} resueltos en este tema.`,
    );
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
    await this.exigirPracticaMinima(usuarioId, temaId);
    await this.verificarCooldown(usuarioId, temaId, cfg.esperaHoras);

    // Solo se aceptan ejercicios que REALMENTE pertenecen a este tema: los del nivel
    // objetivo y, si hizo falta completar la prueba, los del nivel vigente.
    const ids = respuestas.map((r) => r.ejercicioId);
    const ejercicios = await this.prisma.ejercicio.findMany({
      where: { id: { in: ids }, temaId, banco: 'practica', activo: true, nivelDificultad: { in: [objetivo, actual] } },
      select: { id: true, tipo: true, respuestaCorrecta: true, dificultadB: true },
    });
    if (ejercicios.length === 0) throw new BadRequestException('Las preguntas no corresponden al mini-diagnóstico.');

    let correctos = 0;
    const puntajes: number[] = [];
    const respuestasIrt: RespuestaIrt[] = [];
    for (const ej of ejercicios) {
      const dada = respuestas.find((r) => r.ejercicioId === ej.id)?.respuesta ?? '';
      // Evaluación: una respuesta parcial cuenta su fracción y no se complementa.
      const res = corregirGraduado(ej.tipo, dada, ej.respuestaCorrecta);
      const ok = res.estado === 'correcta';
      puntajes.push(res.puntaje);
      if (ok) correctos++;
      if (typeof ej.dificultadB === 'number') respuestasIrt.push({ b: ej.dificultadB, correcto: ok });
    }
    // Nota sobre 100. Se sube de nivel con 80 o más.
    const puntaje = notaSobre100(puntajes);
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
      // El avance del tema pasa a medirse en el NIVEL NUEVO (los 10 de ese nivel
      // completan el tema), salvo que el tema ya estuviera completo: eso no se pierde.
      const previo = await this.prisma.progresoTema.findUnique({ where: { usuarioId_temaId: { usuarioId, temaId } } });
      const [tema, delNivel, resueltos] = await Promise.all([
        this.prisma.tema.findUnique({ where: { id: temaId }, select: { umbral: true } }),
        this.prisma.ejercicio.count({ where: { temaId, banco: 'practica', activo: true, nivelDificultad: objetivo } }),
        this.prisma.intento.findMany({
          where: { usuarioId, correcto: true, ejercicio: { temaId, banco: 'practica', nivelDificultad: objetivo } },
          distinct: ['ejercicioId'], select: { ejercicioId: true },
        }),
      ]);
      const avance = avanceTemaGuardado(previo?.ejerciciosCompletados ?? 0, resueltos.length, delNivel, tema?.umbral ?? 10);
      await this.prisma.progresoTema.upsert({
        where: { usuarioId_temaId: { usuarioId, temaId } },
        create: { usuarioId, temaId, nivelActual: objetivo, desbloqueado: true, ejerciciosCompletados: avance },
        update: { nivelActual: objetivo, ejerciciosCompletados: avance },
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
