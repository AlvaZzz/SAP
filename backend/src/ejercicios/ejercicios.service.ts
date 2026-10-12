import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AdaptatividadService } from './adaptatividad.service';
import { ResponderDto } from './dto/responder.dto';
import { corregirGraduado } from './correccion';
import { EmblemasService } from '../gamificacion/emblemas.service';
import { RangosService } from '../gamificacion/rangos.service';
import { factorXpNivel } from '../common/niveles/nivel-dificultad';
import { desbloqueoSecuencial } from '../common/niveles/desbloqueo';
import { estimarTheta, redondearTheta, RespuestaIrt } from '../mediciones/irt/irt';
import { msDesde } from '../mediciones/motor/motor';
import type { DecisionMotor } from './log-adaptacion.service';

// Campos del ejercicio que SÍ ve el estudiante (sin la respuesta correcta).
const SELECT_PUBLICO = {
  id: true, titulo: true, categoria: true, nivelId: true, temaId: true, estrellas: true,
  nivelDificultad: true, tipo: true, enunciado: true, codigoPython: true, opciones: true, xp: true,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly emblemas: EmblemasService,
    private readonly rangos: RangosService,
    // Punto único del gating por nivel (ver AdaptatividadService).
    private readonly adaptatividad: AdaptatividadService,
  ) {}

  // ── Niveles con el progreso del usuario ──
  async niveles(usuarioId: number) {
    const niveles = await this.prisma.nivel.findMany({
      orderBy: { numero: 'asc' },
      include: {
        _count: { select: { ejercicios: { where: { banco: 'practica', activo: true } } } },
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
  async listar(nivel?: number, categoria?: string, temaId?: number) {
    return this.prisma.ejercicio.findMany({
      // `nivel` es el NÚMERO del nivel (1–5), no su id autoincremental.
      where: {
        banco: 'practica', activo: true,
        ...(nivel ? { nivel: { numero: nivel } } : {}),
        ...(categoria ? { categoria } : {}),
        ...(temaId ? { temaId } : {}),
      },
      orderBy: [{ nivelId: 'asc' }, { id: 'asc' }],
      select: SELECT_PUBLICO,
    });
  }

  async detalle(id: number) {
    const ej = await this.prisma.ejercicio.findUnique({
      where: { id },
      select: {
        ...SELECT_PUBLICO,
        // Info de la jerarquía académica para los badges del header (unidad/tema).
        tema: { select: { numero: true, titulo: true, unidad: { select: { numero: true, titulo: true } } } },
        nivel: { select: { numero: true, titulo: true } },
      },
    });
    if (!ej) throw new NotFoundException('Ejercicio no encontrado');
    return ej;
  }

  /**
   * ¿El estudiante puede resolver ejercicios de este tema/subtema?
   *
   * Se CALCULA desde su avance real (ver common/niveles/desbloqueo): el primer
   * tema de la unidad está abierto y cada siguiente se abre al completar el
   * anterior; un subtema exige además que su tema padre esté abierto. La marca
   * guardada `ProgresoTema.desbloqueado` NO se usa: el diagnóstico inicial la
   * ponía en verdadero para temas de cualquier unidad.
   */
  private async temaDesbloqueado(tx: Prisma.TransactionClient, usuarioId: number, temaId: number, umbralPct = 80): Promise<boolean> {
    const tema = await tx.tema.findUnique({ where: { id: temaId } });
    if (!tema) return false;

    const hermanos = await tx.tema.findMany({
      where: { unidadId: tema.unidadId, padreId: tema.padreId, publicado: true },
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      select: { id: true, umbral: true, progreso: { where: { usuarioId }, select: { ejerciciosCompletados: true } } },
    });
    const padreAbierto = tema.padreId ? await this.temaDesbloqueado(tx, usuarioId, tema.padreId, umbralPct) : true;
    const abiertos = desbloqueoSecuencial(
      hermanos.map((h) => ({ completados: h.progreso[0]?.ejerciciosCompletados ?? 0, umbral: h.umbral })),
      umbralPct,
      padreAbierto,
    );
    const idx = hermanos.findIndex((h) => h.id === tema.id);
    return idx >= 0 && abiertos[idx];
  }

  /**
   * ¿La unidad de este tema está desbloqueada? La primera siempre lo está;
   * cualquier otra exige haber APROBADO el examen de la unidad anterior (ver
   * unidadSuperada). Tener buen diagnóstico no abre unidades.
   */
  private async unidadDesbloqueada(tx: Prisma.TransactionClient, usuarioId: number, unidadId: number): Promise<boolean> {
    const unidad = await tx.unidad.findUnique({ where: { id: unidadId }, select: { institucion: true } });
    if (!unidad) return false;
    const secuencia = await tx.unidad.findMany({
      where: { institucion: unidad.institucion, temas: { some: { publicado: true, padreId: null } } },
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      select: { id: true },
    });
    const idx = secuencia.findIndex((u) => u.id === unidadId);
    if (idx <= 0) return true; // primera unidad (o fuera de la secuencia publicada)
    const aprobado = await tx.examenUnidad.findFirst({
      where: { usuarioId, unidadId: secuencia[idx - 1].id, aprobado: true }, select: { id: true },
    });
    return !!aprobado;
  }

  /**
   * Avanza el progreso del tema (o subtema) resuelto y, al completarlo,
   * desbloquea el siguiente hermano (mismo padre) y —si corresponde—
   * propaga la finalización al tema padre y a la unidad (bono de XP único).
   */
  private async avanzarProgresoTema(
    tx: Prisma.TransactionClient,
    usuarioId: number,
    temaId: number,
    umbralPct: number,
    nivelInicial: NivelDificultad,
  ): Promise<void> {
    const tema = await tx.tema.findUnique({ where: { id: temaId } });
    if (!tema) return;

    const completados = await tx.intento.count({
      where: { usuarioId, correcto: true, ejercicio: { temaId } },
    });
    const completadosTotal = completados + 1; // incluye el intento que se inserta después
    // Al crear la fila por primera vez, se siembra el nivel actual del tema con la
    // clasificación inicial del estudiante (no degradar a básico).
    await tx.progresoTema.upsert({
      where: { usuarioId_temaId: { usuarioId, temaId } },
      create: { usuarioId, temaId, ejerciciosCompletados: completadosTotal, desbloqueado: true, nivelActual: nivelInicial },
      update: { ejerciciosCompletados: completadosTotal, desbloqueado: true },
    });

    const requeridos = Math.ceil((tema.umbral * umbralPct) / 100);
    if (completadosTotal < requeridos) return;

    // Desbloquea el siguiente hermano (mismo padre, o mismo nivel superior si no tiene padre).
    const hermanos = await tx.tema.findMany({
      where: { unidadId: tema.unidadId, padreId: tema.padreId, publicado: true },
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
    });
    const idx = hermanos.findIndex((h) => h.id === tema.id);
    const siguiente = idx >= 0 ? hermanos[idx + 1] : undefined;
    if (siguiente) {
      await tx.progresoTema.upsert({
        where: { usuarioId_temaId: { usuarioId, temaId: siguiente.id } },
        create: { usuarioId, temaId: siguiente.id, desbloqueado: true, nivelActual: nivelInicial },
        update: { desbloqueado: true },
      });
    }

    if (tema.padreId) {
      // Es un subtema: si TODOS los subtemas hermanos ya están completos, el
      // tema padre se da por completado y se propaga (unidad).
      const todosCompletos = hermanos.length > 0 && (await Promise.all(
        hermanos.map(async (h) => {
          if (h.id === tema.id) return true;
          const pr = await tx.progresoTema.findUnique({ where: { usuarioId_temaId: { usuarioId, temaId: h.id } } });
          const req = Math.ceil((h.umbral * umbralPct) / 100);
          return (pr?.ejerciciosCompletados ?? 0) >= req;
        }),
      )).every(Boolean);
      if (todosCompletos) {
        await tx.progresoTema.upsert({
          where: { usuarioId_temaId: { usuarioId, temaId: tema.padreId } },
          create: { usuarioId, temaId: tema.padreId, ejerciciosCompletados: 999_999, desbloqueado: true, nivelActual: nivelInicial },
          update: { ejerciciosCompletados: 999_999, desbloqueado: true },
        });
        await this.verificarUnidadCompleta(tx, usuarioId, tema.unidadId, umbralPct);
      }
    } else {
      // Tema de primer nivel completado directamente (sin subtemas): revisa la unidad.
      await this.verificarUnidadCompleta(tx, usuarioId, tema.unidadId, umbralPct);
    }
  }

  /** Otorga el bono de XP de la unidad UNA sola vez, cuando todos sus temas publicados están completos. */
  private async verificarUnidadCompleta(
    tx: Prisma.TransactionClient,
    usuarioId: number,
    unidadId: number,
    umbralPct: number,
  ): Promise<void> {
    const yaOtorgado = await tx.unidadCompletada.findUnique({ where: { usuarioId_unidadId: { usuarioId, unidadId } } });
    if (yaOtorgado) return;

    const temasTop = await tx.tema.findMany({ where: { unidadId, padreId: null, publicado: true } });
    if (temasTop.length === 0) return;

    const todos = (await Promise.all(
      temasTop.map(async (t) => {
        const pr = await tx.progresoTema.findUnique({ where: { usuarioId_temaId: { usuarioId, temaId: t.id } } });
        const req = Math.ceil((t.umbral * umbralPct) / 100);
        return (pr?.ejerciciosCompletados ?? 0) >= req;
      }),
    )).every(Boolean);
    if (!todos) return;

    const unidad = await tx.unidad.findUnique({ where: { id: unidadId } });
    await tx.unidadCompletada.create({ data: { usuarioId, unidadId } });
    if (unidad && unidad.xp > 0) {
      await tx.ranking.upsert({
        where: { usuarioId },
        create: { usuarioId, xpTotal: unidad.xp },
        update: { xpTotal: { increment: unidad.xp } },
      });
    }
  }

  /** IDs de ejercicios que el usuario ya resolvió correctamente. */
  async resueltos(usuarioId: number): Promise<number[]> {
    const rows = await this.prisma.intento.findMany({
      where: { usuarioId, correcto: true }, distinct: ['ejercicioId'], select: { ejercicioId: true },
    });
    return rows.map((r) => r.ejercicioId);
  }

  // ── Registrar intento (corrección + XP + desbloqueo en backend) ──
  // `inicio` es el instante en que llegó la respuesta (process.hrtime.bigint),
  // medido en el backend: de él salen la latencia de reajuste y el tiempo de
  // retroalimentación del log del motor adaptativo.
  async responder(usuarioId: number, dto: ResponderDto, inicio: bigint = process.hrtime.bigint()) {
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

      // Seguridad: igual candado para la jerarquía académica (tema/subtema).
      const cfgGate = await tx.configuracionSistema.findUnique({ where: { id: 1 }, select: { umbralPorcentaje: true } });
      if (ej.temaId && !(await this.temaDesbloqueado(tx, usuarioId, ej.temaId, cfgGate?.umbralPorcentaje ?? 80))) {
        throw new ForbiddenException('Este tema aún está bloqueado. Completa el tema anterior primero.');
      }

      // Seguridad: la unidad debe estar desbloqueada (dominio ≥ Intermedio en la anterior).
      if (ej.temaId) {
        const temaU = await tx.tema.findUnique({ where: { id: ej.temaId }, select: { unidadId: true } });
        if (temaU && !(await this.unidadDesbloqueada(tx, usuarioId, temaU.unidadId))) {
          throw new ForbiddenException('Esta unidad aún está bloqueada. Alcanza nivel Intermedio en la unidad anterior.');
        }
      }

      // GATING POR NIVEL. Va aquí, ANTES de corregir, de otorgar XP y de registrar
      // el intento: si el ejercicio no es del nivel del estudiante en este tema, no
      // debe dejar ningún rastro en los datos del estudio.
      await this.adaptatividad.verificarAccesoEjercicio(usuarioId, ej);

      // LOG DEL MOTOR: habilidad con la que el motor ASIGNÓ este ejercicio (antes de
      // que esta respuesta la modifique). Sin práctica previa, la del diagnóstico.
      const uAntes = await tx.usuario.findUnique({
        where: { id: usuarioId }, select: { thetaActual: true, thetaInicial: true },
      });
      const thetaAntes = uAntes?.thetaActual ?? uAntes?.thetaInicial ?? null;
      let thetaDespues: number | null = thetaAntes;

      // Corrección GRADUADA. Solo una respuesta totalmente correcta resuelve el
      // ejercicio (XP y avance); una parcial se devuelve con lo que falta para que
      // el estudiante la complemente y vuelva a enviar.
      const correccion = corregirGraduado(ej.tipo, dto.respuestaDada, ej.respuestaCorrecta);
      const correcto = correccion.estado === 'correcta';

      const cfg = await tx.configuracionSistema.findUnique({ where: { id: 1 } });

      // Pistas usadas: se cuentan desde consultas_ia (PREXI) para este ejercicio
      // posteriores al último intento. Fuente de verdad en el backend, no el cliente.
      const ultimoIntento = await tx.intento.findFirst({
        where: { usuarioId, ejercicioId: ej.id },
        orderBy: { fecha: 'desc' },
        select: { fecha: true },
      });
      const pistasUsadas = await tx.consultaIa.count({
        where: {
          usuarioId, ejercicioId: ej.id, tipo: 'pista',
          ...(ultimoIntento ? { fecha: { gt: ultimoIntento.fecha } } : {}),
        },
      });

      let xpOtorgado = 0;
      let multiplicador = 1;
      let rachaDias = 0;
      let nivelCompletado = false;
      let nivelDesbloqueadoNumero: number | null = null;

      if (correcto) {
        // XP base menos penalización por pistas usadas, escalado por el NIVEL del
        // ejercicio: estar en un nivel más alto otorga MÁS XP (incentivo a subir
        // de nivel → acelera el rango; hipótesis de la tesis).
        const penal = (cfg?.penalizacionPista ?? 5) * pistasUsadas;
        const factorNivel = factorXpNivel(ej.nivelDificultad, {
          xpFactorIntermedio: cfg?.xpFactorIntermedio ?? 125,
          xpFactorAvanzado: cfg?.xpFactorAvanzado ?? 150,
        });
        const xpBase = Math.max(5, Math.round((ej.xp - penal) * factorNivel));

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

        // Progreso por la jerarquía académica real (Unidad → Tema → Subtema),
        // en paralelo al progreso por nivel. Solo si el ejercicio pertenece a un tema.
        if (ej.temaId) {
          const u = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } });
          await this.avanzarProgresoTema(tx, usuarioId, ej.temaId, cfg?.umbralPorcentaje ?? 80, u?.nivelInicialAdaptativo ?? 'basico');
        }
      }

      await tx.intento.create({
        data: {
          usuarioId, ejercicioId: ej.id, respuestaDada: dto.respuestaDada, correcto,
          estado: correccion.estado, puntaje: correccion.puntaje,
          tiempoSeg: dto.tiempoSeg ?? 0, pistasUsadas, xpOtorgado,
        },
      });

      // ACTUALIZACIÓN CONTINUA de θ (IRT/Rasch): re-estima la habilidad con TODAS
      // las respuestas de práctica (incluida la recién insertada) y la persiste
      // (thetaActual). Añade un punto a la evolución de θ solo si cambió de forma
      // apreciable (≥0.1 logit) para no generar ruido. Best-effort: nunca
      // interrumpe el flujo del estudiante ni altera la respuesta.
      try {
        const filas = await tx.intento.findMany({
          where: { usuarioId },
          select: { correcto: true, ejercicio: { select: { dificultadB: true } } },
        });
        const respuestas: RespuestaIrt[] = (filas ?? [])
          .filter((f) => typeof f.ejercicio?.dificultadB === 'number')
          .map((f) => ({ b: f.ejercicio!.dificultadB, correcto: !!f.correcto }));
        if (respuestas.length > 0) {
          const theta = redondearTheta(estimarTheta(respuestas));
          await tx.usuario.update({ where: { id: usuarioId }, data: { thetaActual: theta } });
          thetaDespues = theta;
          if (uAntes?.thetaActual == null || Math.abs(theta - uAntes.thetaActual) >= 0.1) {
            await tx.historialTheta.create({
              data: { usuarioId, theta, origen: 'practica', n: respuestas.length, temaId: ej.temaId },
            });
          }
        }
      } catch {
        /* la evolución de θ es best-effort: no interrumpe el flujo del estudiante */
      }
      // LATENCIA DE REAJUSTE: la nueva habilidad (y con ella la dificultad que el
      // motor usará para el siguiente ejercicio) ya está lista en este punto.
      const latenciaMs = msDesde(inicio);

      // Recalcular posiciones del ranking. Solo se escribe a quien CAMBIA de
      // posición, y cada cambio queda en HistorialRanking (indicador de
      // gamificación de la tesis: "cambios de posición en el ranking").
      const orden = await tx.ranking.findMany({
        orderBy: [{ xpTotal: 'desc' }, { usuarioId: 'asc' }],
        select: { usuarioId: true, posicion: true },
      });
      const cambios: { usuarioId: number; posicionAntes: number | null; posicionDespues: number }[] = [];
      for (let i = 0; i < orden.length; i++) {
        if (orden[i].posicion === i + 1) continue;
        await tx.ranking.update({ where: { usuarioId: orden[i].usuarioId }, data: { posicion: i + 1 } });
        cambios.push({ usuarioId: orden[i].usuarioId, posicionAntes: orden[i].posicion ?? null, posicionDespues: i + 1 });
      }
      if (cambios.length) await tx.historialRanking.createMany({ data: cambios });


      // Emblemas disparados por este intento (validados en el backend, sin duplicar).
      const emblemasNuevos = await this.emblemas.evaluarIntento(tx, usuarioId, {
        ejercicio: { id: ej.id, categoria: ej.categoria, temaId: ej.temaId },
        correcto, pistasUsadas, rachaDias,
      });

      // Recalcular el rango del estudiante en la unidad del ejercicio (si aplica).
      let rangoSubido: { titulo: string; rangoClave: string } | null = null;
      if (ej.temaId) {
        const tema = await tx.tema.findUnique({ where: { id: ej.temaId }, select: { unidadId: true } });
        if (tema) {
          const cambios = await this.rangos.recalcular(usuarioId, tema.unidadId, tx);
          if (cambios.length) rangoSubido = { titulo: cambios[0].titulo, rangoClave: cambios[0].rangoClave };
        }
      }

      return {
        correcto,
        // Resultado graduado: correcta | parcial | incorrecta.
        estado: correccion.estado,
        puntaje: correccion.puntaje,
        faltantes: correccion.faltantes,
        retroalimentacion: correccion.retroalimentacion,
        puede_complementar: correccion.estado === 'parcial',
        // Con una respuesta PARCIAL no se revela la solución: el estudiante debe
        // poder completarla por sí mismo.
        respuesta_correcta: correccion.estado === 'parcial' ? null : ej.respuestaCorrecta,
        explicacion_base: correccion.estado === 'parcial' ? null : ej.explicacionIa,
        xp: { xpOtorgado, multiplicador, rachaDias },
        nivel: { nivelCompletado, nivelDesbloqueadoNumero },
        // `logros_nuevos` (claves) se mantiene por compatibilidad; `emblemas_nuevos`
        // trae los datos completos para la animación de "¡Logro desbloqueado!".
        logros_nuevos: emblemasNuevos.map((e) => e.clave),
        emblemas_nuevos: emblemasNuevos,
        rango_subido: rangoSubido,
        // Datos de la decisión del motor para LogAdaptacion. El controlador los
        // separa: NO viajan al cliente.
        motor: {
          ejercicioId: ej.id,
          temaId: ej.temaId,
          dificultadB: ej.dificultadB,
          thetaAntes,
          thetaDespues,
          nivelAntes: ej.temaId != null ? ej.nivelDificultad : null,
          // Personalizado = servido por la ruta adaptativa de un tema (filtrada
          // por el nivel del estudiante y ordenada por información respecto a θ).
          personalizado: ej.temaId != null && ej.banco === 'practica',
          correcto,
          latenciaMs,
        } satisfies DecisionMotor,
      };
    });
  }
}
