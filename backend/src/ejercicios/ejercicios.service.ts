import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AdaptatividadService } from './adaptatividad.service';
import { ResponderDto } from './dto/responder.dto';
import { corregir } from './correccion';
import { EmblemasService } from '../gamificacion/emblemas.service';
import { RangosService } from '../gamificacion/rangos.service';
import { factorXpNivel, nivelAlMenos, nivelDominioAgregado } from '../common/niveles/nivel-dificultad';
import { estimarTheta, redondearTheta, RespuestaIrt } from '../mediciones/irt/irt';

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
   * ¿El estudiante puede resolver ejercicios de este tema/subtema? Si ya existe
   * una fila de progreso, manda su `desbloqueado`. Si no existe aún (nunca lo
   * tocó), se considera desbloqueado SOLO si es el primer tema de la primera
   * unidad, o el primer subtema de un tema ya desbloqueado (mismo criterio por
   * defecto que usa la vista del estudiante en UnidadesService).
   */
  private async temaDesbloqueado(tx: Prisma.TransactionClient, usuarioId: number, temaId: number): Promise<boolean> {
    const pr = await tx.progresoTema.findUnique({ where: { usuarioId_temaId: { usuarioId, temaId } } });
    if (pr) return pr.desbloqueado;

    const tema = await tx.tema.findUnique({ where: { id: temaId } });
    if (!tema) return false;

    if (tema.padreId) {
      const hermanos = await tx.tema.findMany({
        where: { unidadId: tema.unidadId, padreId: tema.padreId, publicado: true },
        orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
        select: { id: true },
      });
      const esPrimero = hermanos[0]?.id === tema.id;
      return esPrimero && (await this.temaDesbloqueado(tx, usuarioId, tema.padreId));
    }

    const primeraUnidad = await tx.unidad.findFirst({ orderBy: [{ orden: 'asc' }, { numero: 'asc' }], select: { id: true } });
    if (primeraUnidad?.id !== tema.unidadId) return false;
    const hermanos = await tx.tema.findMany({
      where: { unidadId: tema.unidadId, padreId: null, publicado: true },
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      select: { id: true },
    });
    return hermanos[0]?.id === tema.id;
  }

  /**
   * ¿La unidad de este tema está desbloqueada? La primera unidad (menor orden)
   * siempre lo está; cualquier otra exige que la unidad inmediatamente anterior
   * alcance dominio agregado ≥ Intermedio. Espejo del gate de UnidadesService.
   */
  private async unidadDesbloqueada(tx: Prisma.TransactionClient, usuarioId: number, unidadId: number): Promise<boolean> {
    const unidad = await tx.unidad.findUnique({ where: { id: unidadId }, select: { orden: true, numero: true, institucion: true } });
    if (!unidad) return false;
    // Unidad anterior en el mismo plan/institución por (orden, numero).
    const previas = await tx.unidad.findMany({
      where: { institucion: unidad.institucion },
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      select: { id: true, orden: true, numero: true },
    });
    const idx = previas.findIndex((u) => u.id === unidadId);
    if (idx <= 0) return true; // primera unidad (o no encontrada en la secuencia)
    const anterior = previas[idx - 1];
    // Dominio de la unidad anterior calculado EN VIVO desde el NIVEL por tema
    // (misma lógica que la vista de unidad → gate y UI coherentes; no depende de
    // un DesempenoUnidad persistido que pudiera estar desactualizado).
    const nivelDominio = await this.nivelDominioUnidad(tx, usuarioId, anterior.id);
    return nivelAlMenos(nivelDominio, 'intermedio');
  }

  /** Dominio (nivel) de una unidad = promedio del nivel del estudiante en sus temas publicados. */
  private async nivelDominioUnidad(tx: Prisma.TransactionClient, usuarioId: number, unidadId: number): Promise<NivelDificultad> {
    const [usuario, temas] = await Promise.all([
      tx.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } }),
      tx.tema.findMany({ where: { unidadId, publicado: true }, select: { progreso: { where: { usuarioId }, select: { nivelActual: true } } } }),
    ]);
    const nivelInicial: NivelDificultad = usuario?.nivelInicialAdaptativo ?? 'basico';
    const niveles = temas.map((t) => t.progreso[0]?.nivelActual ?? nivelInicial);
    return nivelDominioAgregado(niveles).nivelDominio;
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

      // Seguridad: igual candado para la jerarquía académica (tema/subtema).
      if (ej.temaId && !(await this.temaDesbloqueado(tx, usuarioId, ej.temaId))) {
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

      const correcto = corregir(ej.tipo, dto.respuestaDada, ej.respuestaCorrecta);

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
          const prev = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { thetaActual: true } });
          await tx.usuario.update({ where: { id: usuarioId }, data: { thetaActual: theta } });
          if (prev?.thetaActual == null || Math.abs(theta - prev.thetaActual) >= 0.1) {
            await tx.historialTheta.create({
              data: { usuarioId, theta, origen: 'practica', n: respuestas.length, temaId: ej.temaId },
            });
          }
        }
      } catch {
        /* la evolución de θ es best-effort: no interrumpe el flujo del estudiante */
      }

      // Recalcular posiciones del ranking.
      const orden = await tx.ranking.findMany({ orderBy: [{ xpTotal: 'desc' }, { usuarioId: 'asc' }], select: { usuarioId: true } });
      for (let i = 0; i < orden.length; i++) {
        await tx.ranking.update({ where: { usuarioId: orden[i].usuarioId }, data: { posicion: i + 1 } });
      }

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
        respuesta_correcta: ej.respuestaCorrecta,
        explicacion_base: ej.explicacionIa,
        xp: { xpOtorgado, multiplicador, rachaDias },
        nivel: { nivelCompletado, nivelDesbloqueadoNumero },
        // `logros_nuevos` (claves) se mantiene por compatibilidad; `emblemas_nuevos`
        // trae los datos completos para la animación de "¡Logro desbloqueado!".
        logros_nuevos: emblemasNuevos.map((e) => e.clave),
        emblemas_nuevos: emblemasNuevos,
        rango_subido: rangoSubido,
      };
    });
  }
}
