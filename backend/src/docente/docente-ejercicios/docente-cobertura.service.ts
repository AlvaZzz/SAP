import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NivelDificultad } from '@prisma/client';

const NIVELES: NivelDificultad[] = ['basico', 'intermedio', 'avanzado'];

/**
 * COBERTURA DEL BANCO DE EJERCICIOS (rol docente).
 *
 * POR QUÉ ES UNA CONDICIÓN DE LA ADAPTATIVIDAD, NO UN INVENTARIO
 * El sistema sirve a cada estudiante ejercicios del nivel que le corresponde en
 * cada tema. Si un tema no tiene ejercicios de nivel Avanzado, el estudiante que
 * llega a Avanzado en ese tema simplemente no recibe material a su altura: la
 * adaptatividad deja de funcionar para él sin que nadie se entere, porque la
 * pantalla no da error, solo muestra menos.
 *
 * Un hueco aquí es, además, una amenaza directa a la tesis: si el mecanismo
 * adaptativo no pudo operar en parte del temario, la intervención no se aplicó
 * completa y eso hay que poder detectarlo ANTES de la recolección, no después.
 */
@Injectable()
export class DocenteCoberturaService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const [unidades, ejercicios] = await Promise.all([
      this.prisma.unidad.findMany({
        orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
        select: {
          id: true, numero: true, titulo: true,
          temas: {
            where: { padreId: null },
            orderBy: { orden: 'asc' },
            select: { id: true, numero: true, titulo: true, publicado: true },
          },
        },
      }),
      this.prisma.ejercicio.findMany({
        where: { activo: true },
        select: { temaId: true, nivelDificultad: true, banco: true },
      }),
    ]);

    // Conteo por tema × nivel, separando práctica de examen: son bancos con
    // funciones distintas y un hueco en cada uno significa otra cosa.
    const clave = (temaId: number, nivel: string) => `${temaId}:${nivel}`;
    const practica = new Map<string, number>();
    const examen = new Map<number, number>();
    for (const e of ejercicios) {
      if (!e.temaId) continue;
      if (e.banco === 'practica') {
        const k = clave(e.temaId, e.nivelDificultad);
        practica.set(k, (practica.get(k) ?? 0) + 1);
      } else if (e.banco === 'examen') {
        examen.set(e.temaId, (examen.get(e.temaId) ?? 0) + 1);
      }
    }

    const huecos: { unidad: number; tema: string; tipo: string; detalle: string; gravedad: 'alta' | 'media' }[] = [];

    const porUnidad = unidades.map((u) => {
      const temas = u.temas.map((t) => {
        const porNivel = NIVELES.map((n) => ({ nivel: n, ejercicios: practica.get(clave(t.id, n)) ?? 0 }));
        const totalPractica = porNivel.reduce((a, b) => a + b.ejercicios, 0);
        const enExamen = examen.get(t.id) ?? 0;

        // Solo se auditan los temas PUBLICADOS: un tema aún sin publicar no le
        // falta nada al estudiante, porque todavía no lo ve.
        if (t.publicado) {
          if (totalPractica === 0) {
            huecos.push({
              unidad: u.numero, tema: `${t.numero} ${t.titulo}`, tipo: 'sin_practica',
              detalle: 'Tema publicado SIN ningún ejercicio de práctica: el estudiante no tiene con qué trabajarlo.',
              gravedad: 'alta',
            });
          } else {
            for (const p of porNivel) {
              if (p.ejercicios === 0) {
                huecos.push({
                  unidad: u.numero, tema: `${t.numero} ${t.titulo}`, tipo: `sin_${p.nivel}`,
                  detalle: `No hay ejercicios de nivel ${p.nivel}: quien alcance ese nivel en este tema se queda sin material a su altura y la adaptatividad no puede operar.`,
                  gravedad: p.nivel === 'basico' ? 'alta' : 'media',
                });
              }
            }
          }
          if (enExamen === 0) {
            huecos.push({
              unidad: u.numero, tema: `${t.numero} ${t.titulo}`, tipo: 'sin_examen',
              detalle: 'Sin preguntas de examen: este tema no puede evaluarse en el examen de fin de unidad.',
              gravedad: 'media',
            });
          }
        }

        return {
          id: t.id, numero: t.numero, titulo: t.titulo, publicado: t.publicado,
          por_nivel: porNivel, total_practica: totalPractica, examen: enExamen,
          completo: totalPractica > 0 && porNivel.every((p) => p.ejercicios > 0) && enExamen > 0,
        };
      });

      return {
        id: u.id, numero: u.numero, titulo: u.titulo,
        temas,
        temas_publicados: temas.filter((t) => t.publicado).length,
        temas_completos: temas.filter((t) => t.publicado && t.completo).length,
        total_practica: temas.reduce((a, t) => a + t.total_practica, 0),
      };
    });

    return {
      unidades: porUnidad,
      huecos,
      resumen: {
        temas_publicados: porUnidad.reduce((a, u) => a + u.temas_publicados, 0),
        temas_completos: porUnidad.reduce((a, u) => a + u.temas_completos, 0),
        huecos_altos: huecos.filter((h) => h.gravedad === 'alta').length,
        huecos_medios: huecos.filter((h) => h.gravedad === 'media').length,
      },
      que_significa:
        'Un tema está COMPLETO cuando tiene ejercicios de práctica en los tres niveles (básico, ' +
        'intermedio y avanzado) y al menos una pregunta de examen. Solo se auditan los temas ' +
        'PUBLICADOS: lo que aún no ve el estudiante no le falta.',
      por_que_importa:
        'Si un tema publicado no tiene ejercicios del nivel de un estudiante, ese estudiante se queda ' +
        'sin material a su altura y la adaptatividad deja de operar para él, sin que la pantalla dé ' +
        'ningún error. Conviene cerrar estos huecos ANTES de la recolección de datos, no después.',
    };
  }
}
