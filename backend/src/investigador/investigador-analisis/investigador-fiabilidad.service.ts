import { Injectable } from '@nestjs/common';
import { InvestigadorExportacionService } from '../investigador-exportacion/investigador-exportacion.service';
import { ajusteRasch, analisisItems, kr20 } from '../../common/estadistica/fiabilidad';
import { probabilidadAcierto } from '../../mediciones/irt/irt';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * FIABILIDAD Y VALIDEZ DEL INSTRUMENTO (rol investigador, SOLO LECTURA).
 *
 * Responde a la primera pregunta de cualquier tribunal: ¿el pretest/postest
 * mide de forma consistente? Si el instrumento no es fiable, ningún resultado
 * obtenido con él sostiene nada.
 *
 * Todo sale de `matrizRespuestas()` del servicio de exportación — el dataset
 * canónico —, nunca de consultas propias.
 */
@Injectable()
export class InvestigadorFiabilidadService {
  constructor(
    private readonly exportacion: InvestigadorExportacionService,
    private readonly prisma: PrismaService,
  ) {}

  private async analizarTest(tipo: 'pre' | 'post') {
    const { matriz, items, personas } = await this.exportacion.matrizRespuestas(tipo);

    if (matriz.length === 0 || items.length === 0) {
      return {
        hay_datos: false,
        n_personas: 0,
        n_items: 0,
        kr20: null,
        items: [],
        items_problematicos: [],
      };
    }

    const fiab = kr20(matriz);
    const analisis = analisisItems(matriz);

    return {
      hay_datos: true,
      n_personas: personas.length,
      n_items: items.length,
      kr20: {
        coeficiente: fiab.coeficiente,
        interpretacion: fiab.interpretacion,
        confiable: fiab.confiable,
        // Se explica qué significa el número, no solo el número.
        que_significa:
          'KR-20 es el coeficiente de consistencia interna para ítems de acierto/error. ' +
          'Indica qué parte de la variabilidad de los puntajes es señal del rasgo medido y no ruido. ' +
          'Se considera aceptable a partir de 0.70.',
        advertencia: fiab.confiable
          ? null
          : `Calculado con ${fiab.n} estudiantes: por debajo de 10 el coeficiente es demasiado inestable para reportarlo como evidencia.`,
      },
      items: analisis.map((a, i) => ({
        ejercicio_id: items[i].ejercicioId,
        titulo: items[i].titulo,
        categoria: items[i].categoria,
        dificultad: a.dificultad,
        discriminacion: a.discriminacion,
        d27: a.d27,
        veredicto: a.veredicto,
        motivo: a.motivo,
      })),
      items_problematicos: analisis
        .filter((a) => a.veredicto === 'problemático')
        .map((a) => ({ ejercicio_id: items[a.indice].ejercicioId, titulo: items[a.indice].titulo, motivo: a.motivo })),
    };
  }

  /**
   * AJUSTE AL MODELO DE RASCH (infit/outfit por ítem).
   *
   * Usa la θ persistida de cada estudiante y la dificultad `b` calibrada del
   * ítem para calcular la probabilidad que el modelo predice, y la contrasta
   * con lo que realmente ocurrió. Permite afirmar que el modelo DESCRIBE los
   * datos, no solo que se aplicó.
   */
  private async ajusteModelo(tipo: 'pre' | 'post') {
    const { matriz, items, personas } = await this.exportacion.matrizRespuestas(tipo);
    if (matriz.length === 0 || items.length === 0) return { hay_datos: false, items: [] };

    // θ de cada persona incluida, en el mismo orden que las filas de la matriz.
    const usuarios = await this.prisma.usuario.findMany({
      where: { rol: 'estudiante' },
      orderBy: { id: 'asc' },
      select: { thetaInicial: true, thetaFinal: true },
    });
    const anonAIndice = new Map(personas.map((p, i) => [p, i]));
    const thetas: (number | null)[] = new Array(personas.length).fill(null);
    usuarios.forEach((u, i) => {
      const idAnon = `E-${String(i + 1).padStart(3, '0')}`;
      const fila = anonAIndice.get(idAnon);
      if (fila !== undefined) thetas[fila] = (tipo === 'pre' ? u.thetaInicial : u.thetaFinal) ?? null;
    });

    const filasUsables = thetas
      .map((t, i) => ({ t, i }))
      .filter((x): x is { t: number; i: number } => x.t !== null);

    if (filasUsables.length === 0) {
      return {
        hay_datos: false,
        items: [],
        motivo: 'Ningún estudiante tiene θ estimada para este examen.',
      };
    }

    const resultados = items.map((item, col) => {
      const b = item.dificultadB;
      if (b === null) {
        return {
          ejercicio_id: item.ejercicioId, titulo: item.titulo,
          dificultad_b: null, infit: null, outfit: null, veredicto: null,
          motivo: 'El ítem no tiene dificultad b calibrada.',
        };
      }
      const observado = filasUsables.map(({ i }) => (matriz[i][col] ? 1 : 0));
      const probs = filasUsables.map(({ t }) => probabilidadAcierto(t, b));
      const a = ajusteRasch(observado, probs);
      return {
        ejercicio_id: item.ejercicioId, titulo: item.titulo,
        dificultad_b: b,
        infit: Number.isFinite(a.infit) ? a.infit : null,
        outfit: Number.isFinite(a.outfit) ? a.outfit : null,
        veredicto: a.veredicto,
        motivo: null,
      };
    });

    return {
      hay_datos: true,
      n_personas: filasUsables.length,
      items: resultados,
      fuera_de_rango: resultados.filter((r) => r.veredicto && r.veredicto !== 'ajuste aceptable').length,
      que_significa:
        'Infit y outfit tienen valor esperado 1 y rango productivo 0.5–1.5. Por encima de 1.5 el ítem ' +
        'genera más ruido del que el modelo explica; por debajo de 0.5 encaja demasiado bien, lo que ' +
        'suele indicar redundancia con otros ítems.',
    };
  }

  async resumen() {
    const [pre, post, ajustePre, ajustePost] = await Promise.all([
      this.analizarTest('pre'),
      this.analizarTest('post'),
      this.ajusteModelo('pre'),
      this.ajusteModelo('post'),
    ]);

    return {
      pretest: pre,
      postest: post,
      ajuste_rasch: { pretest: ajustePre, postest: ajustePost },
    };
  }
}
