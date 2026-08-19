import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { MomentoEncuesta } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ANCLAJES, ESCALA_MAX, ESCALA_MIN, ITEMS, MENSAJE_SIN_INSTRUMENTO, REFERENCIA,
  SUBESCALAS, Subescala, VERSION_INSTRUMENTO, definicionSubescala, instrumentoCargado,
  itemPorCodigo, puntuar,
} from './instrumento';

/**
 * ENCUESTA DE MOTIVACIÓN ACADÉMICA (MSLQ, sección de motivación).
 *
 * Aplica el instrumento en dos momentos —antes y después de la intervención—
 * para poder contrastar el cambio. Cubre la variable dependiente "motivación
 * académica" que la tesis declara y que el sistema no medía.
 *
 * Decisiones que conviene conocer:
 *  · Se guarda el valor CRUDO (1–7) tal como lo marcó el estudiante. La
 *    recodificación de ítems inversos ocurre al puntuar, nunca al almacenar:
 *    así el dato original queda siempre auditable.
 *  · Cada respuesta lleva la VERSIÓN del instrumento. Si los ítems cambian, las
 *    aplicaciones anteriores no se mezclan con las nuevas en un mismo análisis.
 *  · No se puede responder dos veces el mismo momento: permitir reenvíos
 *    convertiría el instrumento en algo que el estudiante ajusta a posteriori.
 *  · Si los ítems oficiales no están cargados, el servicio FALLA en vez de
 *    aplicar una encuesta vacía. Ver `items-mslq.ts`.
 */
@Injectable()
export class EncuestaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Barrera única: nada se aplica sin instrumento cargado. */
  private exigirInstrumento(): void {
    if (!instrumentoCargado()) throw new ServiceUnavailableException(MENSAJE_SIN_INSTRUMENTO);
  }

  /** Metadatos del instrumento: sirven a la pantalla y a la documentación. */
  info() {
    return {
      cargado: instrumentoCargado(),
      version: VERSION_INSTRUMENTO,
      escala: { min: ESCALA_MIN, max: ESCALA_MAX, anclajes: ANCLAJES },
      total_items: ITEMS.length,
      subescalas: SUBESCALAS.map((s) => ({
        clave: s.clave,
        nombre: s.nombre,
        descripcion: s.descripcion,
        justificacion: s.justificacion,
        items: ITEMS.filter((i) => i.subescala === s.clave).length,
        alfa_referencia: s.alfaReferencia,
        fuente_alfa: s.fuenteAlfa,
      })),
      referencia: REFERENCIA,
      mensaje: instrumentoCargado() ? null : MENSAJE_SIN_INSTRUMENTO,
    };
  }

  /** Cuestionario a mostrar, con lo ya respondido si lo hubiera. */
  async cuestionario(usuarioId: number, momento: MomentoEncuesta) {
    this.exigirInstrumento();

    const previas = await this.prisma.respuestaEncuesta.findMany({
      where: { usuarioId, momento },
      select: { itemId: true, valor: true },
    });
    const guardadas = new Map(previas.map((r) => [r.itemId, r.valor]));

    return {
      momento,
      version: VERSION_INSTRUMENTO,
      completada: previas.length >= ITEMS.length,
      escala: { min: ESCALA_MIN, max: ESCALA_MAX, anclajes: ANCLAJES },
      referencia: REFERENCIA,
      // El carácter inverso de un ítem NO se señala en pantalla: marcarlo
      // anularía su función, que es romper el piloto automático al responder.
      items: ITEMS.map((i) => ({
        codigo: i.codigo,
        texto: i.texto,
        subescala: i.subescala,
        valor: guardadas.get(i.codigo) ?? null,
      })),
    };
  }

  /**
   * Estado de aplicación. Lo consulta el gate de la interfaz y también sirve
   * al rol investigador para saber quién tiene el dato y quién no: un
   * estudiante que no la respondió es un DATO FALTANTE, nunca un cero.
   */
  async estado(usuarioId: number) {
    const [pre, post] = await Promise.all([
      this.prisma.respuestaEncuesta.count({ where: { usuarioId, momento: 'pre' } }),
      this.prisma.respuestaEncuesta.count({ where: { usuarioId, momento: 'post' } }),
    ]);
    return {
      instrumento_cargado: instrumentoCargado(),
      total_items: ITEMS.length,
      pre_completada: instrumentoCargado() && pre >= ITEMS.length,
      post_completada: instrumentoCargado() && post >= ITEMS.length,
    };
  }

  /**
   * Guarda la encuesta completa de un momento. Se exige responderla ENTERA: una
   * escala a medias no permite calcular el puntaje de la subescala ni su
   * fiabilidad, y guardar respuestas parciales solo produce casos que después
   * hay que descartar del análisis.
   */
  async responder(
    usuarioId: number,
    momento: MomentoEncuesta,
    respuestas: { itemId: string; valor: number }[],
  ) {
    this.exigirInstrumento();

    const yaRespondio = await this.prisma.respuestaEncuesta.count({ where: { usuarioId, momento } });
    if (yaRespondio > 0) {
      throw new BadRequestException('Ya respondiste esta encuesta; no se puede modificar.');
    }

    const porItem = new Map(respuestas.map((r) => [r.itemId, r.valor]));
    for (const item of ITEMS) {
      const v = porItem.get(item.codigo);
      if (v === undefined) throw new BadRequestException(`Falta responder: "${item.texto}"`);
      if (!Number.isInteger(v) || v < ESCALA_MIN || v > ESCALA_MAX) {
        throw new BadRequestException(`Respuesta fuera de la escala (${ESCALA_MIN}–${ESCALA_MAX}).`);
      }
    }

    await this.prisma.respuestaEncuesta.createMany({
      data: ITEMS.map((i) => ({
        usuarioId, itemId: i.codigo, momento,
        valor: porItem.get(i.codigo)!,  // crudo, sin recodificar
        version: VERSION_INSTRUMENTO,
      })),
    });

    return {
      ok: true,
      ...this.puntuar(ITEMS.map((i) => ({ itemId: i.codigo, valor: porItem.get(i.codigo)! }))),
    };
  }

  /**
   * Puntúa un conjunto de respuestas: media por subescala y total, con los
   * ítems inversos ya recodificados.
   *
   * Se usa la MEDIA de los ítems y no la suma porque las subescalas tienen
   * distinto número de ítems: sumar haría que la más larga pesara más en
   * cualquier comparación sin que eso signifique nada. La media además deja el
   * resultado en la escala original (1–7), que es como lo reporta la
   * literatura y por tanto lo hace comparable con los valores publicados.
   */
  puntuar(respuestas: { itemId: string; valor: number }[]) {
    const porSubescala = new Map<Subescala, number[]>();
    let total = 0;
    let n = 0;

    for (const r of respuestas) {
      const item = itemPorCodigo(r.itemId);
      if (!item) continue; // ítem de otra versión del instrumento
      const p = puntuar(item, r.valor);
      total += p;
      n++;
      const xs = porSubescala.get(item.subescala) ?? [];
      xs.push(p);
      porSubescala.set(item.subescala, xs);
    }

    const media = (xs: number[]) =>
      (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

    return {
      puntaje_total: n ? Math.round((total / n) * 100) / 100 : null,
      items_respondidos: n,
      por_subescala: SUBESCALAS.map((s) => {
        const xs = porSubescala.get(s.clave) ?? [];
        return {
          subescala: s.clave,
          nombre: s.nombre,
          media: media(xs),
          items: xs.length,
        };
      }),
    };
  }

  /**
   * Matriz de respuestas por ítem para el análisis de fiabilidad, restringida a
   * una subescala. Es la materia prima del alfa de Cronbach: una fila por
   * estudiante, una columna por ítem, con los inversos ya recodificados.
   *
   * Solo entran los estudiantes que respondieron la subescala COMPLETA: con
   * huecos, ni el alfa ni la correlación ítem-total son calculables.
   */
  async matrizSubescala(
    subescala: Subescala,
    momento: MomentoEncuesta,
    usuarioIds?: number[],
  ): Promise<{ matriz: number[][]; usuarios: number[]; codigos: string[] }> {
    const items = ITEMS.filter((i) => i.subescala === subescala);
    if (items.length === 0) return { matriz: [], usuarios: [], codigos: [] };

    const filas = await this.prisma.respuestaEncuesta.findMany({
      where: {
        momento,
        itemId: { in: items.map((i) => i.codigo) },
        ...(usuarioIds ? { usuarioId: { in: usuarioIds } } : {}),
      },
      select: { usuarioId: true, itemId: true, valor: true },
    });

    const porUsuario = new Map<number, Map<string, number>>();
    for (const f of filas) {
      if (!porUsuario.has(f.usuarioId)) porUsuario.set(f.usuarioId, new Map());
      porUsuario.get(f.usuarioId)!.set(f.itemId, f.valor);
    }

    const usuarios: number[] = [];
    const matriz: number[][] = [];
    for (const [uid, respuestas] of [...porUsuario.entries()].sort((a, b) => a[0] - b[0])) {
      if (items.some((i) => !respuestas.has(i.codigo))) continue; // subescala incompleta
      usuarios.push(uid);
      matriz.push(items.map((i) => puntuar(i, respuestas.get(i.codigo)!)));
    }

    return { matriz, usuarios, codigos: items.map((i) => i.codigo) };
  }

  /** Puntajes de todos los estudiantes en un momento (para el dataset canónico). */
  async puntajesPorEstudiante(momento: MomentoEncuesta) {
    const filas = await this.prisma.respuestaEncuesta.findMany({
      where: { momento },
      select: { usuarioId: true, itemId: true, valor: true },
    });

    const porUsuario = new Map<number, { itemId: string; valor: number }[]>();
    for (const f of filas) {
      const xs = porUsuario.get(f.usuarioId) ?? [];
      xs.push({ itemId: f.itemId, valor: f.valor });
      porUsuario.set(f.usuarioId, xs);
    }

    const salida = new Map<number, ReturnType<EncuestaService['puntuar']>>();
    for (const [uid, respuestas] of porUsuario) {
      // Solo se puntúa a quien respondió el instrumento COMPLETO: un puntaje
      // calculado sobre media encuesta no es comparable con el de los demás.
      if (respuestas.length < ITEMS.length) continue;
      salida.set(uid, this.puntuar(respuestas));
    }
    return salida;
  }

  /** Definición de una subescala (nombre, alfa de referencia…). */
  definicion(clave: Subescala) {
    return definicionSubescala(clave);
  }
}
