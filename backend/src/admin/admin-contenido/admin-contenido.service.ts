import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PREGUNTAS_POR_EVALUACION } from '../../common/niveles/reglas-evaluacion';

/** Meta por tema y nivel, y preguntas del examen de cada unidad: 10 (reglas de avance). */
export const META_CONTENIDO = PREGUNTAS_POR_EVALUACION;

export interface TemaContenido {
  id: number; numero: string; titulo: string; es_subtema: boolean; publicado: boolean;
  basico: number; intermedio: number; avanzado: number;
  retos_bug: number; retos_codigo: number;
  /** Ejercicios que faltan para llegar a la meta en los tres niveles. */
  faltan: number;
}
export interface UnidadContenido {
  id: number; numero: number; titulo: string;
  examen: number; examen_faltan: number;
  temas: TemaContenido[];
  temas_completos: number;
}

/**
 * CONTENIDO DEL CURSO, visto por el administrador: cuántos ejercicios de
 * práctica tiene cada tema y subtema en cada nivel, cuántas preguntas tiene el
 * examen de cada unidad y cuántos retos hay. Marca lo que falta para la meta de
 * 10 (la misma que exige el docente al armar la unidad).
 */
@Injectable()
export class AdminContenidoService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const [unidades, practica, examen, retos] = await Promise.all([
      this.prisma.unidad.findMany({
        orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
        select: {
          id: true, numero: true, titulo: true,
          temas: { orderBy: [{ orden: 'asc' }, { numero: 'asc' }], select: { id: true, numero: true, titulo: true, padreId: true, publicado: true, orden: true } },
        },
      }),
      this.prisma.ejercicio.groupBy({ by: ['temaId', 'nivelDificultad'], where: { banco: 'practica', activo: true }, _count: { _all: true } }),
      this.prisma.ejercicio.groupBy({ by: ['temaId'], where: { banco: 'examen', activo: true }, _count: { _all: true } }),
      this.prisma.reto.groupBy({ by: ['temaId', 'esBugHunt'], where: { activo: true }, _count: { _all: true } }),
    ]);

    const nPractica = (temaId: number, nivel: string) => practica.find((p) => p.temaId === temaId && p.nivelDificultad === nivel)?._count._all ?? 0;
    const nRetos = (temaId: number, bug: boolean) => retos.find((r) => r.temaId === temaId && r.esBugHunt === bug)?._count._all ?? 0;
    const nExamen = new Map(examen.map((e) => [e.temaId, e._count._all]));

    const resultado: UnidadContenido[] = unidades.map((u) => {
      // Tema seguido de sus subtemas, en orden de estudio.
      const padres = u.temas.filter((t) => t.padreId === null);
      const ordenados = padres.flatMap((p) => [p, ...u.temas.filter((s) => s.padreId === p.id)]);
      const temas: TemaContenido[] = ordenados.map((t) => {
        const basico = nPractica(t.id, 'basico');
        const intermedio = nPractica(t.id, 'intermedio');
        const avanzado = nPractica(t.id, 'avanzado');
        return {
          id: t.id, numero: t.numero, titulo: t.titulo, es_subtema: t.padreId !== null, publicado: t.publicado,
          basico, intermedio, avanzado,
          retos_bug: nRetos(t.id, true), retos_codigo: nRetos(t.id, false),
          faltan: [basico, intermedio, avanzado].reduce((s, n) => s + Math.max(0, META_CONTENIDO - n), 0),
        };
      });
      const examenTotal = u.temas.reduce((s, t) => s + (nExamen.get(t.id) ?? 0), 0);
      return {
        id: u.id, numero: u.numero, titulo: u.titulo,
        examen: examenTotal, examen_faltan: Math.max(0, META_CONTENIDO - examenTotal),
        temas,
        temas_completos: temas.filter((t) => t.publicado && t.faltan === 0).length,
      };
    });

    const publicados = resultado.flatMap((u) => u.temas.filter((t) => t.publicado));
    return {
      meta: META_CONTENIDO,
      unidades: resultado,
      totales: {
        temas: publicados.length,
        temas_completos: publicados.filter((t) => t.faltan === 0).length,
        ejercicios: publicados.reduce((s, t) => s + t.basico + t.intermedio + t.avanzado, 0),
        faltan: publicados.reduce((s, t) => s + t.faltan, 0),
        retos: publicados.reduce((s, t) => s + t.retos_bug + t.retos_codigo, 0),
        unidades_sin_examen_completo: resultado.filter((u) => u.temas.some((t) => t.publicado) && u.examen_faltan > 0).length,
      },
    };
  }
}
