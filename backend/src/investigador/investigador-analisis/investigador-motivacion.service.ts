import { Injectable } from '@nestjs/common';
import {
  InvestigadorExportacionService, SOLO_ESTUDIANTES_DEL_ESTUDIO,
} from '../investigador-exportacion/investigador-exportacion.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncuestaService } from '../../mediciones/encuesta/encuesta.service';
import { SUBESCALAS, Subescala, instrumentoCargado, MENSAJE_SIN_INSTRUMENTO, REFERENCIA, ESCALA_MIN, ESCALA_MAX } from '../../mediciones/encuesta/instrumento';
import { alfaCronbach } from '../../common/estadistica/fiabilidad';
import { compararGrupos, compararPrePost } from '../../common/estadistica/contraste';

const GRUPOS = ['control', 'experimental'] as const;

/**
 * MOTIVACIÓN ACADÉMICA (rol investigador, SOLO LECTURA).
 *
 * Analiza la escala MSLQ con el mismo rigor que el resto del estudio: primero
 * la FIABILIDAD del instrumento en esta muestra, y solo después los contrastes.
 *
 * Por qué el alfa va antes que los resultados: si la escala no se comportó de
 * forma consistente aquí, comparar sus puntajes entre grupos no significa nada.
 * Y como el MSLQ tiene alfas publicados, se puede hacer algo más fuerte que
 * reportar el propio: CONTRASTARLO con el de la literatura. Que una escala
 * validada se comporte en tu muestra como se esperaba es evidencia citable.
 */
@Injectable()
export class InvestigadorMotivacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encuesta: EncuestaService,
    private readonly exportacion: InvestigadorExportacionService,
  ) {}

  async resumen() {
    if (!instrumentoCargado()) {
      return {
        instrumento_cargado: false,
        mensaje: MENSAJE_SIN_INSTRUMENTO,
        referencia: REFERENCIA,
        subescalas: [],
        fiabilidad: [],
        contrastes: null,
        cobertura: null,
      };
    }

    // Solo estudiantes del estudio: las cuentas de demostración quedan fuera
    // por el mismo candado que el resto del rol.
    const estudiantes = await this.prisma.usuario.findMany({
      where: SOLO_ESTUDIANTES_DEL_ESTUDIO,
      orderBy: { id: 'asc' },
      select: { id: true, grupo: true },
    });
    const ids = estudiantes.map((e) => e.id);
    const grupoDe = new Map(estudiantes.map((e) => [e.id, e.grupo]));

    const [puntajesPre, puntajesPost] = await Promise.all([
      this.encuesta.puntajesPorEstudiante('pre'),
      this.encuesta.puntajesPorEstudiante('post'),
    ]);

    // ── Cobertura: quién respondió y quién no ──
    // Un estudiante sin encuesta es un DATO FALTANTE, jamás un cero.
    const conPre = ids.filter((id) => puntajesPre.has(id));
    const conPost = ids.filter((id) => puntajesPost.has(id));
    const completos = ids.filter((id) => puntajesPre.has(id) && puntajesPost.has(id));

    const cobertura = {
      total_estudiantes: ids.length,
      con_pre: conPre.length,
      con_post: conPost.length,
      con_ambos: completos.length,
      criterio:
        'Solo se puntúa a quien respondió el instrumento COMPLETO. Quien no lo respondió es un dato ' +
        'faltante y no entra en el análisis: no se le asigna ningún valor.',
    };

    // ── Fiabilidad por subescala, contra la literatura ──
    const fiabilidad = await Promise.all(
      SUBESCALAS.map(async (s) => {
        const { matriz } = await this.encuesta.matrizSubescala(s.clave, 'pre', ids);
        const a = alfaCronbach(matriz);
        const obtenido = Number.isFinite(a.coeficiente) ? a.coeficiente : null;

        // Comparación con el alfa publicado, solo si existe uno citable.
        let comparacion: string | null = null;
        if (obtenido !== null && s.alfaReferencia !== null) {
          const dif = obtenido - s.alfaReferencia;
          comparacion = Math.abs(dif) <= 0.1
            ? `Consistente con la literatura (α = ${s.alfaReferencia.toFixed(2)} en ${s.fuenteAlfa}). ` +
              'La subescala se comportó en esta muestra como se esperaba.'
            : dif < 0
              ? `POR DEBAJO del α = ${s.alfaReferencia.toFixed(2)} reportado en ${s.fuenteAlfa}. ` +
                'Conviene revisar los ítems con correlación ítem-total baja antes de interpretar sus puntajes.'
              : `Por encima del α = ${s.alfaReferencia.toFixed(2)} reportado en ${s.fuenteAlfa}.`;
        }

        return {
          subescala: s.clave,
          nombre: s.nombre,
          descripcion: s.descripcion,
          justificacion: s.justificacion,
          n: a.n,
          items: a.k,
          alfa: obtenido,
          interpretacion: a.interpretacion,
          confiable: a.confiable,
          alfa_referencia: s.alfaReferencia,
          fuente_referencia: s.fuenteAlfa,
          comparacion_literatura: comparacion,
          detalle_items: a.items,
          advertencia: a.confiable
            ? null
            : `Calculado con ${a.n} estudiantes: por debajo de 10 el alfa es demasiado inestable para reportarlo como evidencia.`,
        };
      }),
    );

    // ── Contrastes ──
    const mediaSub = (
      puntajes: Map<number, { por_subescala: { subescala: string; media: number | null }[] }>,
      id: number, clave: Subescala,
    ): number | null =>
      puntajes.get(id)?.por_subescala.find((x) => x.subescala === clave)?.media ?? null;

    const valores = (
      puntajes: Map<number, { puntaje_total: number | null }>,
      grupo?: (typeof GRUPOS)[number],
    ): number[] =>
      ids
        .filter((id) => (grupo ? grupoDe.get(id) === grupo : true))
        .map((id) => puntajes.get(id)?.puntaje_total ?? null)
        .filter((v): v is number => v !== null);

    // 1. ¿Difieren los grupos en motivación al FINAL?
    const entreGruposPost = compararGrupos(
      valores(puntajesPost, 'control'),
      valores(puntajesPost, 'experimental'),
      { variable: 'la motivación académica (postest)', etiquetaA: 'Control', etiquetaB: 'Experimental' },
    );

    // 2. ¿Partían iguales? (equivalencia inicial también en motivación)
    const entreGruposPre = compararGrupos(
      valores(puntajesPre, 'control'),
      valores(puntajesPre, 'experimental'),
      { variable: 'la motivación académica (pretest)', etiquetaA: 'Control', etiquetaB: 'Experimental' },
    );

    // 3. ¿Cambió la motivación dentro de cada grupo?
    const prePostPorGrupo = GRUPOS.map((g) => {
      const suyos = completos.filter((id) => grupoDe.get(id) === g);
      const pre = suyos.map((id) => puntajesPre.get(id)!.puntaje_total!).filter((v) => v !== null);
      const post = suyos.map((id) => puntajesPost.get(id)!.puntaje_total!).filter((v) => v !== null);
      return {
        grupo: g,
        n_completos: suyos.length,
        contraste: compararPrePost(pre, post, {
          variable: 'la motivación académica',
          etiqueta: g === 'control' ? 'Control' : 'Experimental',
        }),
      };
    });

    // 4. Por subescala, entre grupos, en el postest: dónde se nota el efecto.
    const porSubescala = SUBESCALAS.map((s) => ({
      subescala: s.clave,
      nombre: s.nombre,
      contraste: compararGrupos(
        ids.filter((id) => grupoDe.get(id) === 'control')
          .map((id) => mediaSub(puntajesPost, id, s.clave))
          .filter((v): v is number => v !== null),
        ids.filter((id) => grupoDe.get(id) === 'experimental')
          .map((id) => mediaSub(puntajesPost, id, s.clave))
          .filter((v): v is number => v !== null),
        { variable: s.nombre.toLowerCase(), etiquetaA: 'Control', etiquetaB: 'Experimental' },
      ),
    }));

    return {
      instrumento_cargado: true,
      mensaje: null,
      referencia: REFERENCIA,
      escala: { min: ESCALA_MIN, max: ESCALA_MAX },
      cobertura,
      fiabilidad,
      subescalas: SUBESCALAS.map((s) => ({ clave: s.clave, nombre: s.nombre, descripcion: s.descripcion })),
      contrastes: {
        pre_entre_grupos: entreGruposPre,
        post_entre_grupos: entreGruposPost,
        pre_post_por_grupo: prePostPorGrupo,
        por_subescala_post: porSubescala,
      },
      que_significa:
        'Los puntajes son la MEDIA de los ítems de cada subescala, en la escala original de ' +
        `${ESCALA_MIN} a ${ESCALA_MAX}: así son comparables con los valores publicados y las ` +
        'subescalas de distinta longitud pesan igual. Los ítems inversos se recodifican al puntuar ' +
        '(8 − valor); el dato crudo se conserva sin modificar.',
    };
  }
}
