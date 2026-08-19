import { Injectable } from '@nestjs/common';
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
   * Retos disponibles para el estudiante, agrupables por Unidad → Tema → Subtema.
   * Filtra por el nivel que tiene en cada tema. Los retos ya aprobados se
   * devuelven marcados (`completado`) en vez de ocultarse: el estudiante ve su
   * avance del tema completo, igual que en la lista de ejercicios.
   */
  async disponibles(usuarioId: number, filtros: { unidad?: number; temaCodigo?: string } = {}) {
    const [niveles, retos] = await Promise.all([
      this.nivelesPorTema(usuarioId),
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
        completado: entrega?.estado === 'aprobado',
        estado: estadoTarjeta(entrega?.estado),
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

/** Etiqueta de la tarjeta según el estado de la entrega. */
function estadoTarjeta(estado: string | undefined): 'nuevo' | 'pendiente' | 'aprobado' | 'necesita_mejorar' {
  switch (estado) {
    case 'pendiente_revision': return 'pendiente';
    case 'aprobado': return 'aprobado';
    case 'necesita_mejorar': return 'necesita_mejorar';
    default: return 'nuevo';
  }
}
