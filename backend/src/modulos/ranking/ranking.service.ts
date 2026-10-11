import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { rangoParaPuntaje } from '../../gamificacion/catalogo';

export type Ambito = 'global' | 'paralelo';
export type Periodo = 'temporada' | 'historico';

export interface FilaRanking {
  posicion: number;
  usuario_id: number;
  nombre: string;
  xp: number;
  racha_dias: number;
  /** Rango (Aprendiz→Maestro) derivado del desempeño; se LEE, no se recalcula. */
  rango: { clave: string; nombre: string; svgKey: string; color: string };
  /** Puestos ganados (+) o perdidos (−) desde el corte. null = sin referencia. */
  movimiento: number | null;
  es_yo: boolean;
}

/**
 * RANKING — competencia por TEMPORADA, por ámbito y con el rango cruzado.
 *
 * Por qué no es solo el acumulado de siempre: con XP de por vida, en cuanto
 * alguien saca ventaja el resto deja de tener a quién alcanzar y la tabla deja de
 * motivar. La temporada (7 días) reabre la competencia cada semana.
 *
 * SIN MIGRACIÓN: el XP del periodo y la posición anterior se DERIVAN de `Intento`,
 * que ya guarda `xpOtorgado` y `fecha`. No hizo falta añadir tablas ni columnas.
 *
 * PRIVACIDAD: el ámbito "paralelo" filtra por el paralelo DEL PROPIO usuario y
 * jamás expone el paralelo de nadie.
 */
@Injectable()
export class RankingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Inicio de la temporada vigente: lunes 00:00 de la semana actual. */
  private inicioTemporada(ahora = new Date()): Date {
    const d = new Date(ahora);
    const dia = (d.getDay() + 6) % 7; // 0 = lunes
    d.setDate(d.getDate() - dia);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** XP por usuario acumulado en los intentos dentro del rango de fechas. */
  private async xpPorIntentos(desde?: Date, hasta?: Date): Promise<Map<number, number>> {
    const filas = await this.prisma.intento.groupBy({
      by: ['usuarioId'],
      where: { ...(desde || hasta ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lt: hasta } : {}) } } : {}) },
      _sum: { xpOtorgado: true },
    });
    return new Map(filas.map((f) => [f.usuarioId, f._sum.xpOtorgado ?? 0]));
  }

  /** Posiciones a partir de un mapa de XP (empate → id menor primero). */
  private posiciones(xp: Map<number, number>, elegibles: number[]): Map<number, number> {
    const orden = elegibles
      .map((id) => ({ id, xp: xp.get(id) ?? 0 }))
      .sort((a, b) => b.xp - a.xp || a.id - b.id);
    return new Map(orden.map((o, i) => [o.id, i + 1]));
  }

  async tabla(usuarioId: number, opciones: { ambito?: Ambito; periodo?: Periodo; limite?: number }) {
    const ambito: Ambito = opciones.ambito === 'paralelo' ? 'paralelo' : 'global';
    const periodo: Periodo = opciones.periodo === 'historico' ? 'historico' : 'temporada';
    const take = Math.min(Math.max(opciones.limite ?? 20, 1), 100);

    const yo = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, paralelo: true },
    });
    // Sin paralelo asignado no hay contra quién competir en ese ámbito. Se informa
    // para que la interfaz lo diga, en vez de mostrar el global disfrazado de
    // "Mi paralelo" (que sería sencillamente mentir sobre lo que se está viendo).
    const paraleloDisponible = !!yo?.paralelo?.trim();

    // Universo elegible.
    const estudiantes = await this.prisma.usuario.findMany({
      where: {
        rol: 'estudiante',
        activo: true,
        ...(ambito === 'paralelo' && paraleloDisponible ? { paralelo: yo!.paralelo! } : {}),
      },
      select: { id: true, nombre: true },
    });
    const ids = estudiantes.map((e) => e.id);
    const nombres = new Map(estudiantes.map((e) => [e.id, e.nombre]));

    const inicio = this.inicioTemporada();

    // XP del periodo mostrado.
    let xpActual: Map<number, number>;
    if (periodo === 'temporada') {
      xpActual = await this.xpPorIntentos(inicio);
    } else {
      const filas = await this.prisma.ranking.findMany({
        where: { usuarioId: { in: ids } },
        select: { usuarioId: true, xpTotal: true },
      });
      xpActual = new Map(filas.map((f) => [f.usuarioId, f.xpTotal]));
    }

    // Posición ANTERIOR para el indicador ▲/▼:
    //  · temporada → cómo iba ayer dentro de esta misma semana,
    //  · histórico → cómo iba hace 7 días.
    const corte = periodo === 'temporada'
      ? new Date(Date.now() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const xpAntes = periodo === 'temporada'
      ? await this.xpPorIntentos(inicio, corte)
      : await this.xpPorIntentos(undefined, corte);

    const posAhora = this.posiciones(xpActual, ids);
    const posAntes = this.posiciones(xpAntes, ids);

    // Rango de cada estudiante: se LEE de DesempenoUnidad (promedio de puntajes),
    // el mismo insumo que usa RangosService. No se recalcula nada aquí.
    const desempenos = await this.prisma.desempenoUnidad.groupBy({
      by: ['usuarioId'],
      where: { usuarioId: { in: ids } },
      _avg: { puntaje: true },
    });
    const puntajeMedio = new Map(desempenos.map((d) => [d.usuarioId, Math.round(d._avg.puntaje ?? 0)]));

    const rachas = new Map((await this.prisma.ranking.findMany({
      where: { usuarioId: { in: ids } }, select: { usuarioId: true, rachaDias: true },
    })).map((r) => [r.usuarioId, r.rachaDias]));

    const construir = (id: number): FilaRanking => {
      const r = rangoParaPuntaje(puntajeMedio.get(id) ?? 0);
      const antes = posAntes.get(id);
      const ahora = posAhora.get(id) ?? 0;
      return {
        posicion: ahora,
        usuario_id: id,
        nombre: nombres.get(id) ?? '—',
        xp: xpActual.get(id) ?? 0,
        racha_dias: rachas.get(id) ?? 0,
        rango: { clave: r.clave, nombre: r.nombre, svgKey: r.svgKey, color: r.color },
        // Sin actividad previa no hay referencia: mejor null que un falso "+0".
        movimiento: antes == null ? null : antes - ahora,
        es_yo: id === usuarioId,
      };
    };

    const tabla = [...posAhora.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, take)
      .map(([id]) => construir(id));

    // La fila propia siempre viaja, aunque esté fuera del top mostrado.
    const yoFila = ids.includes(usuarioId) ? construir(usuarioId) : null;

    // RIVAL: quien está justo encima. Lo resuelve el backend porque conoce el
    // orden COMPLETO; si lo buscara el cliente dentro del top-20, a quien va en
    // el puesto 43 no lo encontraría y se le diría "estás en lo más alto".
    let rival: FilaRanking | null = null;
    let xpParaSubir: number | null = null;
    if (yoFila && yoFila.posicion > 1) {
      const idArriba = [...posAhora.entries()].find(([, p]) => p === yoFila.posicion - 1)?.[0];
      if (idArriba != null) {
        rival = construir(idArriba);
        xpParaSubir = Math.max(0, rival.xp - yoFila.xp + 1);
      }
    }

    return {
      // Si se pidió paralelo y no lo hay, se responde global Y se dice.
      ambito: ambito === 'paralelo' && !paraleloDisponible ? 'global' : ambito,
      paralelo_disponible: paraleloDisponible,
      periodo,
      // Fechas para que la interfaz explique "qué se está midiendo".
      temporada: periodo === 'temporada' ? { inicio, fin: new Date(inicio.getTime() + 7 * 86_400_000) } : null,
      total_participantes: ids.length,
      ranking: tabla,
      yo: yoFila,
      /** Quién está justo arriba y cuánto XP falta para pasarlo. null si va 1.º. */
      rival,
      xp_para_subir: xpParaSubir,
    };
  }
}
