import { fuentePractica } from './fuente-practica';
import { BadRequestException, Injectable } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ETIQUETA_NIVEL } from '../../common/niveles/nivel-dificultad';

/**
 * RETOS — selección por NIVEL REAL DEL ESTUDIANTE EN CADA TEMA.
 *
 * Regla vigente (sustituye a la anterior de "solo Intermedio/Avanzado con permiso
 * del docente"): un reto se muestra si su `nivelDificultad` coincide con el nivel
 * que el estudiante tiene EN ESE TEMA (`ProgresoTema.nivelActual`), exactamente
 * igual que los ejercicios de práctica. El docente conserva un único interruptor
 * general (`ConfiguracionSistema.retosHabilitado`); el nivel lo decide el motor
 * adaptativo, no una lista de permisos.
 *
 * Consecuencia buscada: al subir de Básico a Intermedio en el tema 2.3, el
 * estudiante deja de ver los retos básicos de 2.3 y empieza a ver los intermedios.
 */
@Injectable()
export class RetosService {
  constructor(private readonly prisma: PrismaService) {}

  /** ¿El docente activó el módulo Retos? */
  async moduloHabilitado(): Promise<boolean> {
    const cfg = await this.prisma.configuracionSistema.findUnique({
      where: { id: 1 },
      select: { retosHabilitado: true },
    });
    return cfg?.retosHabilitado ?? false;
  }

  /** El estudiante abrió el reto: desde ahora ya no está «Sin empezar». */
  async registrarApertura(usuarioId: number, retoId: number): Promise<void> {
    const previo = await this.prisma.retoUsuario.findUnique({ where: { usuarioId_retoId: { usuarioId, retoId } }, select: { iniciadoEn: true } });
    if (!previo) await this.prisma.retoUsuario.create({ data: { usuarioId, retoId, iniciadoEn: new Date() } });
    else if (!previo.iniciadoEn) await this.prisma.retoUsuario.update({ where: { usuarioId_retoId: { usuarioId, retoId } }, data: { iniciadoEn: new Date() } });
  }

  /**
   * «Comprobar» de un reto autocalificable («Encuentra el bug»).
   *
   * El código se ejecuta en el navegador (Pyodide), así que el servidor compara la
   * salida que le reporta el cliente con la esperada. Antes eso no daba XP por
   * miedo a que se falsificara; el resultado era que resolver un reto no contaba
   * para nada y el ranking quedaba inútil. Ahora el acierto SÍ otorga el XP del
   * reto, con estos resguardos:
   *  · una sola vez por reto (si ya está aprobado no suma de nuevo);
   *  · el código tiene que ser distinto del inicial (no basta con pulsar Comprobar);
   *  · el código queda guardado en la entrega, así el docente puede verlo y, si
   *    hiciera falta, revisarlo desde «Revisar retos».
   * Cada comprobación fallida se cuenta (sello «Incompleto»).
   */
  async comprobar(usuarioId: number, retoId: number, salidaCliente: string, codigo: string) {
    const reto = await this.prisma.reto.findFirst({
      where: { id: retoId, activo: true },
      select: { id: true, esBugHunt: true, autoCalificable: true, ejemploSalida: true, codigoInicial: true, xp: true },
    });
    if (!reto) throw new BadRequestException('El reto no existe o no está disponible');
    if (!reto.esBugHunt && !reto.autoCalificable) throw new BadRequestException('Este reto lo revisa tu docente; usa «Entregar».');
    if (!reto.ejemploSalida) throw new BadRequestException('Este reto no tiene salida esperada configurada.');

    const sinEspacios = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '');
    const cambioElCodigo = sinEspacios(codigo) !== sinEspacios(reto.codigoInicial);
    const salida = salidaCliente ?? '';
    const correcto = cambioElCodigo && salida.trim() === reto.ejemploSalida.trim();
    const clave = { usuarioId_retoId: { usuarioId, retoId } };
    const previo = await this.prisma.retoUsuario.findUnique({ where: clave });
    const ahora = new Date();

    let xp = 0;
    if (correcto && previo?.estado !== 'aprobado') {
      xp = Math.max(0, reto.xp);
      await this.prisma.$transaction(async (tx) => {
        await tx.retoUsuario.upsert({
          where: clave,
          create: { usuarioId, retoId, estado: 'aprobado', resuelto: true, codigoEntregado: codigo, xpObtenido: xp, iniciadoEn: ahora, entregadoEn: ahora, revisadoEn: ahora },
          update: { estado: 'aprobado', resuelto: true, codigoEntregado: codigo, xpObtenido: xp, entregadoEn: ahora, revisadoEn: ahora, iniciadoEn: previo?.iniciadoEn ?? ahora },
        });
        if (xp > 0) {
          await tx.ranking.upsert({ where: { usuarioId }, create: { usuarioId, xpTotal: xp }, update: { xpTotal: { increment: xp } } });
          const orden = await tx.ranking.findMany({ orderBy: [{ xpTotal: 'desc' }, { usuarioId: 'asc' }], select: { usuarioId: true } });
          for (let i = 0; i < orden.length; i++) await tx.ranking.update({ where: { usuarioId: orden[i].usuarioId }, data: { posicion: i + 1 } });
        }
      });
    } else if (!correcto && previo?.estado !== 'aprobado') {
      await this.prisma.retoUsuario.upsert({
        where: clave,
        create: { usuarioId, retoId, iniciadoEn: ahora, intentosFallidos: 1, codigoEntregado: codigo },
        update: { intentosFallidos: { increment: 1 }, codigoEntregado: codigo, iniciadoEn: previo?.iniciadoEn ?? ahora },
      });
    }

    return {
      correcto,
      salida,
      esperado: reto.ejemploSalida,
      xp,
      ya_aprobado: previo?.estado === 'aprobado',
      sin_cambios: !cambioElCodigo,
      emblemas_nuevos: [] as { clave: string; nombre: string; descripcion: string; svgKey: string; icono: string }[],
    };
  }

  /**
   * Nivel del estudiante en cada tema. Sin fila de progreso (nunca tocó el tema)
   * el nivel es `basico`, que es el valor por defecto del propio ProgresoTema.
   */
  async nivelesPorTema(usuarioId: number): Promise<Map<number, NivelDificultad>> {
    const filas = await this.prisma.progresoTema.findMany({
      where: { usuarioId },
      select: { temaId: true, nivelActual: true },
    });
    return new Map(filas.map((f) => [f.temaId, f.nivelActual]));
  }

  /**
   * Unidades que el estudiante tiene abiertas, con la misma regla que Ejercicios
   * (EjerciciosService.unidadDesbloqueada): la primera de la secuencia publicada
   * siempre; cualquier otra, solo si aprobó el examen de la anterior. Una unidad
   * fuera de la secuencia publicada no se bloquea.
   */
  async unidadesAbiertas(usuarioId: number): Promise<(unidadId: number) => boolean> {
    const [unidades, aprobados] = await Promise.all([
      this.prisma.unidad.findMany({
        where: { temas: { some: { publicado: true, padreId: null } } },
        orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
        select: { id: true, institucion: true },
      }),
      this.prisma.examenUnidad.findMany({ where: { usuarioId, aprobado: true }, select: { unidadId: true } }),
    ]);
    const conExamen = new Set((aprobados ?? []).map((e) => e.unidadId));
    const anterior = new Map<number, number | null>();
    const ultimaPorInstitucion = new Map<string, number>();
    for (const u of unidades ?? []) {
      const clave = String(u.institucion ?? '');
      anterior.set(u.id, ultimaPorInstitucion.get(clave) ?? null);
      ultimaPorInstitucion.set(clave, u.id);
    }
    return (unidadId) => {
      if (!anterior.has(unidadId)) return true;
      const previa = anterior.get(unidadId);
      return previa == null || conExamen.has(previa);
    };
  }

  /**
   * Retos disponibles para el estudiante, agrupables por Unidad → Tema → Subtema.
   * Filtra por el nivel que tiene en cada tema. Los retos ya aprobados se
   * devuelven marcados (`completado`) en vez de ocultarse: el estudiante ve su
   * avance del tema completo, igual que en la lista de ejercicios.
   */
  async disponibles(usuarioId: number, filtros: { unidad?: number; temaCodigo?: string } = {}) {
    const [niveles, abiertas, retos] = await Promise.all([
      this.nivelesPorTema(usuarioId),
      this.unidadesAbiertas(usuarioId),
      this.prisma.reto.findMany({
        where: {
          activo: true,
          ...(filtros.unidad ? { tema: { unidad: { numero: filtros.unidad } } } : {}),
          ...(filtros.temaCodigo ? { tema: { numero: filtros.temaCodigo } } : {}),
        },
        include: {
          autor: { select: { nombre: true } },
          resueltos: { where: { usuarioId } },
          origenEjercicio: { select: { id: true, fuenteDoc: true } },
          tema: {
            select: {
              id: true, numero: true, titulo: true, orden: true,
              unidad: { select: { id: true, numero: true, titulo: true } },
              padre: { select: { id: true, numero: true, titulo: true, orden: true } },
            },
          },
        },
      }),
    ]);

    const visibles = retos.filter((r) => {
      // Sin tema no hay nivel del que colgarse: se muestra siempre ("General").
      if (!r.temaId) return true;
      // Igual que en Ejercicios: los retos de una unidad aún cerrada no se muestran.
      if (r.tema && !abiertas(r.tema.unidad.id)) return false;
      const nivelEnTema = niveles.get(r.temaId) ?? 'basico';
      return r.nivelDificultad === nivelEnTema;
    });

    const salida = visibles.map((r) => {
      const entrega = r.resueltos[0];
      const esSubtema = !!r.tema?.padre;
      const temaRaiz = esSubtema ? r.tema!.padre! : r.tema ?? null;
      const fd = (r.origenEjercicio?.fuenteDoc ?? {}) as { codigo?: string };
      return {
        id: r.id, codigo: r.codigo, titulo: r.titulo, categoria: r.categoria,
        estrellas: r.estrellas, tipo: r.tipo, enunciado: r.enunciado,
        codigo_inicial: r.codigoInicial,
        es_bug_hunt: r.esBugHunt, auto_calificable: r.autoCalificable,
        // `nivel_dificultad` es el adaptativo (básico/intermedio/avanzado). No se
        // reutiliza `nivel`, que en el contrato antiguo era el número de Nivel.
        nivel_dificultad: r.nivelDificultad, nivel_label: ETIQUETA_NIVEL[r.nivelDificultad],
        nivel: null as number | null,
        ejemplo_entrada: r.ejemploEntrada, ejemplo_salida: r.ejemploSalida,
        xp: r.xp, fecha_limite: r.fechaLimite, autor: r.autor.nombre, fecha: r.creadoEn,
        // Trazabilidad visible: "este reto sale del ejercicio E1.5.I.06".
        origen_ejercicio: r.origenEjercicioId
          ? { id: r.origenEjercicioId, codigo: fd.codigo ?? null }
          : null,
        // «Práctica Nro. 1 · Secuenciales, ejercicio 4»: para estudiarlo con la práctica impresa.
        fuente_practica: fuentePractica(r.fuenteDoc),
        completado: entrega?.estado === 'aprobado',
        estado: estadoTarjeta(entrega),
        intentos_fallidos: entrega?.intentosFallidos ?? 0,
        xp_obtenido: entrega?.xpObtenido ?? 0,
        feedback: entrega?.feedbackDocente ?? null,
        unidad: r.tema ? r.tema.unidad : null,
        tema: temaRaiz ? { id: temaRaiz.id, numero: temaRaiz.numero, titulo: temaRaiz.titulo } : null,
        subtema: esSubtema ? { id: r.tema!.id, numero: r.tema!.numero, titulo: r.tema!.titulo } : null,
        _orden: {
          unidad: r.tema?.unidad.numero ?? Number.MAX_SAFE_INTEGER,
          tema: (esSubtema ? r.tema!.padre!.orden : r.tema?.orden) ?? 0,
          subtema: esSubtema ? r.tema!.orden : -1,
        },
      };
    });

    salida.sort((a, b) =>
      a._orden.unidad - b._orden.unidad
      || a._orden.tema - b._orden.tema
      || a._orden.subtema - b._orden.subtema
      || a.titulo.localeCompare(b.titulo, 'es'));

    // Progreso por tema (para la barra del frontend): completados / visibles.
    const progreso = new Map<number, { completados: number; total: number }>();
    for (const r of salida) {
      if (!r.tema) continue;
      const p = progreso.get(r.tema.id) ?? { completados: 0, total: 0 };
      p.total += 1;
      if (r.completado) p.completados += 1;
      progreso.set(r.tema.id, p);
    }

    return {
      retos: salida.map(({ _orden, ...r }) => r),
      progreso_por_tema: [...progreso.entries()].map(([temaId, p]) => ({ tema_id: temaId, ...p })),
    };
  }
}

/**
 * Sello de cada reto para el estudiante:
 *  · aprobado   → «Completado» (verde)
 *  · revision   → «En revisión» (azul): lo entregó y espera al docente
 *  · incompleto → «Incompleto» (rojo): lo intentó y no le salió (o el docente pidió mejoras)
 *  · en_curso   → «Pendiente» (ámbar): entró, pero lo dejó a medias
 *  · nuevo      → «Sin empezar» (gris): nunca lo abrió
 */
export type EstadoTarjetaReto = 'nuevo' | 'en_curso' | 'incompleto' | 'revision' | 'aprobado';
export function estadoTarjeta(e: { estado: string; intentosFallidos?: number | null; iniciadoEn?: Date | null; codigoEntregado?: string | null } | undefined | null): EstadoTarjetaReto {
  if (!e) return 'nuevo';
  if (e.estado === 'aprobado') return 'aprobado';
  if (e.estado === 'pendiente_revision') return 'revision';
  if (e.estado === 'necesita_mejorar' || (e.intentosFallidos ?? 0) > 0) return 'incompleto';
  if (e.iniciadoEn || e.codigoEntregado) return 'en_curso';
  return 'nuevo';
}
