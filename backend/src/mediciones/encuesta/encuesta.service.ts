import { BadRequestException, Injectable } from '@nestjs/common';
import { MomentoEncuesta } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ANCLAJES, DIMENSIONES, ETIQUETA_DIMENSION, ITEMS, LIKERT_MAX, LIKERT_MIN,
  NOTA_INSTRUMENTO, VERSION_INSTRUMENTO, itemPorId, puntuar,
} from './instrumento';

/**
 * ENCUESTA DE MOTIVACIÓN ACADÉMICA.
 *
 * Aplica el instrumento Likert en dos momentos —antes y después de la
 * intervención— y guarda cada respuesta por separado. Cubre la dimensión
 * "motivación académica" que la tesis declara como variable dependiente y que
 * hasta ahora el sistema no podía medir.
 *
 * Decisiones que conviene conocer:
 *  · Se guarda el valor CRUDO (1–5) tal como lo marcó el estudiante. La
 *    recodificación de ítems inversos ocurre al puntuar, nunca al almacenar.
 *  · Cada respuesta lleva la VERSIÓN del instrumento: si los ítems cambian, las
 *    aplicaciones viejas no se mezclan con las nuevas en un mismo análisis.
 *  · Una vez enviada, la encuesta de ese momento no se puede repetir: permitir
 *    reenvíos convertiría el instrumento en algo que el estudiante ajusta a
 *    posteriori.
 */
@Injectable()
export class EncuestaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cuestionario a mostrar, con lo ya respondido si lo hubiera. */
  async cuestionario(usuarioId: number, momento: MomentoEncuesta) {
    const previas = await this.prisma.respuestaEncuesta.findMany({
      where: { usuarioId, momento },
      select: { itemId: true, valor: true },
    });
    const guardadas = new Map(previas.map((r) => [r.itemId, r.valor]));

    return {
      momento,
      version: VERSION_INSTRUMENTO,
      completada: previas.length >= ITEMS.length,
      anclajes: ANCLAJES,
      nota: NOTA_INSTRUMENTO,
      // El texto del ítem inverso NO se marca en la interfaz: señalarlo
      // anularía su función, que es romper el piloto automático al responder.
      items: ITEMS.map((i) => ({
        id: i.id,
        texto: i.texto,
        dimension: i.dimension,
        dimension_label: ETIQUETA_DIMENSION[i.dimension],
        valor: guardadas.get(i.id) ?? null,
      })),
    };
  }

  /** ¿Ya la respondió? Lo usa el gate del frontend. */
  async estado(usuarioId: number) {
    const [pre, post] = await Promise.all([
      this.prisma.respuestaEncuesta.count({ where: { usuarioId, momento: 'pre' } }),
      this.prisma.respuestaEncuesta.count({ where: { usuarioId, momento: 'post' } }),
    ]);
    return {
      total_items: ITEMS.length,
      pre_completada: pre >= ITEMS.length,
      post_completada: post >= ITEMS.length,
    };
  }

  /**
   * Guarda la encuesta completa de un momento. Se exige RESPONDERLA ENTERA: una
   * escala a medias no permite calcular ni el puntaje ni su fiabilidad, y
   * guardar respuestas parciales solo produciría casos que después hay que
   * descartar del análisis.
   */
  async responder(
    usuarioId: number,
    momento: MomentoEncuesta,
    respuestas: { itemId: string; valor: number }[],
  ) {
    const yaRespondio = await this.prisma.respuestaEncuesta.count({ where: { usuarioId, momento } });
    if (yaRespondio > 0) {
      throw new BadRequestException('Ya respondiste esta encuesta; no se puede modificar.');
    }

    const porItem = new Map(respuestas.map((r) => [r.itemId, r.valor]));
    for (const item of ITEMS) {
      const v = porItem.get(item.id);
      if (v === undefined) throw new BadRequestException(`Falta responder: "${item.texto}"`);
      if (!Number.isInteger(v) || v < LIKERT_MIN || v > LIKERT_MAX) {
        throw new BadRequestException(`Respuesta fuera de la escala (${LIKERT_MIN}–${LIKERT_MAX}).`);
      }
    }

    await this.prisma.respuestaEncuesta.createMany({
      data: ITEMS.map((i) => ({
        usuarioId, itemId: i.id, momento,
        valor: porItem.get(i.id)!,     // crudo, sin recodificar
        version: VERSION_INSTRUMENTO,
      })),
    });

    return { ok: true, ...this.puntuarRespuestas(ITEMS.map((i) => ({ itemId: i.id, valor: porItem.get(i.id)! }))) };
  }

  /**
   * Puntúa un conjunto de respuestas: total y media por dimensión, con los
   * ítems inversos ya recodificados.
   *
   * Se devuelve la MEDIA por dimensión y no la suma porque las dimensiones
   * tienen distinto número de ítems: sumar haría que la de más ítems pesara más
   * en cualquier comparación, sin que eso signifique nada.
   */
  puntuarRespuestas(respuestas: { itemId: string; valor: number }[]) {
    const porDimension = new Map<string, number[]>();
    let total = 0;
    let n = 0;

    for (const r of respuestas) {
      const item = itemPorId(r.itemId);
      if (!item) continue; // ítem de otra versión del instrumento
      const p = puntuar(item, r.valor);
      total += p;
      n++;
      const xs = porDimension.get(item.dimension) ?? [];
      xs.push(p);
      porDimension.set(item.dimension, xs);
    }

    const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

    return {
      // Puntaje global en la misma escala del ítem (1–5), para que sea legible.
      puntaje: n ? Math.round((total / n) * 100) / 100 : null,
      items_respondidos: n,
      por_dimension: DIMENSIONES.map((d) => ({
        dimension: d,
        label: ETIQUETA_DIMENSION[d],
        media: (() => {
          const m = media(porDimension.get(d) ?? []);
          return m === null ? null : Math.round(m * 100) / 100;
        })(),
        items: (porDimension.get(d) ?? []).length,
      })),
    };
  }
}
