import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RANGOS, rangoParaPuntaje, rangoSiguiente } from './catalogo';
import { nivelDominioAgregado } from '../common/niveles/nivel-dificultad';

/**
 * Rangos de programador POR UNIDAD. El rango se DERIVA del desempeño real del
 * estudiante en cada unidad (tasa de acierto + temas completados + postest),
 * nunca se asigna a mano. Se recalcula en el backend tras cada intento. Subir
 * de rango exige mejorar — conecta con la hipótesis de la tesis (gamificación
 * motiva el esfuerzo).
 */
@Injectable()
export class RangosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Puntaje 0-100 de la unidad. Combina la tasa de acierto de sus ejercicios,
   * el % de temas completados y —como proxy de dominio— el postest global.
   */
  private calcularPuntaje(aciertoPct: number, temasCompletados: number, temasTotal: number, postestPct: number | null): number {
    const temasPct = temasTotal > 0 ? (temasCompletados / temasTotal) * 100 : 0;
    if (postestPct != null) {
      return Math.round(aciertoPct * 0.5 + temasPct * 0.3 + postestPct * 0.2);
    }
    return Math.round(aciertoPct * 0.6 + temasPct * 0.4);
  }

  /**
   * Recalcula el DesempenoUnidad de UNA unidad (o de todas si `unidadId` es
   * undefined) para el estudiante. Idempotente: se puede llamar tras cada intento.
   * Devuelve las unidades cuyo rango CAMBIÓ (para animaciones de "subiste de rango").
   */
  async recalcular(usuarioId: number, unidadId?: number, tx?: Prisma.TransactionClient): Promise<{ unidadId: number; titulo: string; rangoClave: string; subio: boolean }[]> {
    const db = tx ?? this.prisma;
    const unidades = await db.unidad.findMany({
      where: unidadId ? { id: unidadId } : {},
      include: {
        temas: { where: { publicado: true }, include: { ejercicios: { where: { activo: true, banco: 'practica' }, select: { id: true } } } },
      },
    });

    // Postest global como proxy de dominio (no hay postest por-unidad en el sistema).
    const evalPost = await db.evaluacion.findUnique({ where: { usuarioId_tipo: { usuarioId, tipo: 'post' } } });
    const postestPct = evalPost?.puntajeTotal ?? null;

    // Nivel adaptativo inicial: fallback del nivel de un tema sin ProgresoTema aún
    // (mismo criterio que la vista de unidad → dominio y nivel por tema coherentes).
    const usuario = await db.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } });
    const nivelInicial = usuario?.nivelInicialAdaptativo ?? 'basico';

    const cambios: { unidadId: number; titulo: string; rangoClave: string; subio: boolean }[] = [];

    for (const u of unidades) {
      const ejercicioIds = u.temas.flatMap((t) => t.ejercicios.map((e) => e.id));
      const temasTotal = u.temas.length;
      if (temasTotal === 0) continue;

      // Aciertos/intentos del estudiante en los ejercicios de esta unidad.
      const [correctos, intentosTotal, progresoTemas] = await Promise.all([
        ejercicioIds.length ? db.intento.count({ where: { usuarioId, correcto: true, ejercicioId: { in: ejercicioIds } } }) : Promise.resolve(0),
        ejercicioIds.length ? db.intento.count({ where: { usuarioId, ejercicioId: { in: ejercicioIds } } }) : Promise.resolve(0),
        db.progresoTema.findMany({ where: { usuarioId, tema: { unidadId: u.id } } }),
      ]);

      const ejerciciosResueltos = ejercicioIds.length
        ? (await db.intento.findMany({ where: { usuarioId, correcto: true, ejercicioId: { in: ejercicioIds } }, distinct: ['ejercicioId'], select: { ejercicioId: true } })).length
        : 0;
      const aciertoPct = intentosTotal > 0 ? Math.round((correctos / intentosTotal) * 100) : 0;
      const temasCompletados = u.temas.filter((t) => {
        const pr = progresoTemas.find((p) => p.temaId === t.id);
        return (pr?.ejerciciosCompletados ?? 0) >= t.umbral;
      }).length;

      const puntaje = this.calcularPuntaje(aciertoPct, temasCompletados, temasTotal, postestPct);
      const rango = rangoParaPuntaje(puntaje);

      // DOMINIO AGREGADO: promedia el NIVEL del estudiante en cada tema (su
      // habilidad, no el progreso de ejercicios). Gobierna el avance de unidad
      // (mínimo Intermedio para desbloquear la siguiente — no basta con Básico).
      // Sin ProgresoTema aún, el tema hereda el nivel inicial del pretest (mismo
      // fallback que la vista de unidad → nivel por tema y dominio coherentes).
      const nivelesTema = u.temas.map((t) => progresoTemas.find((p) => p.temaId === t.id)?.nivelActual ?? nivelInicial);
      const { dominioPct, nivelDominio } = nivelDominioAgregado(nivelesTema);

      const previo = await db.desempenoUnidad.findUnique({ where: { usuarioId_unidadId: { usuarioId, unidadId: u.id } } });
      const ordenPrevio = RANGOS.find((r) => r.clave === previo?.rangoClave)?.orden ?? 0;
      const subio = rango.orden > ordenPrevio && previo != null;

      await db.desempenoUnidad.upsert({
        where: { usuarioId_unidadId: { usuarioId, unidadId: u.id } },
        create: {
          usuarioId, unidadId: u.id, ejerciciosResueltos, ejerciciosTotal: ejercicioIds.length,
          temasCompletados, temasTotal, aciertoPct, postestPct, puntaje, rangoClave: rango.clave,
          dominioPct, nivelDominio,
        },
        update: {
          ejerciciosResueltos, ejerciciosTotal: ejercicioIds.length, temasCompletados, temasTotal,
          aciertoPct, postestPct, puntaje, rangoClave: rango.clave, dominioPct, nivelDominio,
        },
      });

      if (subio) cambios.push({ unidadId: u.id, titulo: u.titulo, rangoClave: rango.clave, subio });
    }
    return cambios;
  }

  /** Catálogo de rangos (para pintar la escalera en el frontend). */
  catalogo() {
    return RANGOS.map((r) => ({ clave: r.clave, nombre: r.nombre, orden: r.orden, umbral: r.umbral, svgKey: r.svgKey, color: r.color }));
  }

  /**
   * Rango del estudiante por unidad + rango GLOBAL (el mejor promedio) con el
   * progreso hacia el siguiente. Para el banner de "Tu progreso académico".
   */
  async resumen(usuarioId: number) {
    // ── POR QUÉ ESTO YA NO RECALCULA SIEMPRE ──────────────────────────────
    // Antes se llamaba a `recalcular()` en CADA lectura, lo que convertía una
    // simple visita al dashboard en un puñado de ESCRITURAS a la base. Con
    // varios estudiantes conectados a la vez, esa escritura-en-lectura es lo
    // primero que satura la capa gratuita de Neon.
    //
    // No hace falta: `recalcular()` ya se invoca en los eventos que de verdad
    // cambian el desempeño — tras cada intento (`ejercicios.service.ts`) y al
    // finalizar el postest. Aquí solo se recalcula en el caso que esos eventos
    // no cubren: que el estudiante NUNCA haya tenido un cálculo (por ejemplo,
    // datos migrados o una unidad publicada después).
    let desempenos = await this.prisma.desempenoUnidad.findMany({ where: { usuarioId } });
    if (desempenos.length === 0) {
      await this.recalcular(usuarioId).catch(() => undefined);
      desempenos = await this.prisma.desempenoUnidad.findMany({ where: { usuarioId } });
    }

    const unidades = await this.prisma.unidad.findMany({
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      select: { id: true, numero: true, titulo: true },
    });

    const porUnidad = unidades.map((u) => {
      const d = desempenos.find((x) => x.unidadId === u.id);
      const puntaje = d?.puntaje ?? 0;
      const rango = rangoParaPuntaje(puntaje);
      const sig = rangoSiguiente(rango.clave);
      return {
        unidadId: u.id, numero: u.numero, titulo: u.titulo,
        puntaje, acierto_pct: d?.aciertoPct ?? 0,
        temas_completados: d?.temasCompletados ?? 0, temas_total: d?.temasTotal ?? 0,
        // Dominio agregado (nivel) de la unidad: para el gate de avance y la UI.
        dominio_pct: d?.dominioPct ?? 0, nivel_dominio: d?.nivelDominio ?? 'basico',
        rango: { clave: rango.clave, nombre: rango.nombre, orden: rango.orden, svgKey: rango.svgKey, color: rango.color },
        siguiente: sig ? { clave: sig.clave, nombre: sig.nombre, umbral: sig.umbral, faltan: Math.max(0, sig.umbral - puntaje) } : null,
      };
    });

    // Rango global = el del promedio de puntajes de las unidades con desempeño.
    const conDatos = porUnidad.filter((u) => u.temas_total > 0);
    const promedio = conDatos.length ? Math.round(conDatos.reduce((a, u) => a + u.puntaje, 0) / conDatos.length) : 0;
    const rangoGlobal = rangoParaPuntaje(promedio);
    const sigGlobal = rangoSiguiente(rangoGlobal.clave);

    return {
      global: {
        puntaje: promedio,
        rango: { clave: rangoGlobal.clave, nombre: rangoGlobal.nombre, orden: rangoGlobal.orden, svgKey: rangoGlobal.svgKey, color: rangoGlobal.color },
        siguiente: sigGlobal ? { clave: sigGlobal.clave, nombre: sigGlobal.nombre, umbral: sigGlobal.umbral, faltan: Math.max(0, sigGlobal.umbral - promedio) } : null,
      },
      unidades: porUnidad,
    };
  }
}
