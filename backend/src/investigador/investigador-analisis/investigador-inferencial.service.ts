import { Injectable } from '@nestjs/common';
import { FilaDataset, InvestigadorExportacionService } from '../investigador-exportacion/investigador-exportacion.service';
import { ALFA, compararGrupos, compararPrePost, formatearP } from '../../common/estadistica/contraste';
import { clasificarHake, hake, media, pearson, shapiroWilk, spearman } from '../../common/estadistica/inferencia';

const GRUPOS = ['control', 'experimental'] as const;

/**
 * ESTADÍSTICA INFERENCIAL DEL ESTUDIO (rol investigador, SOLO LECTURA).
 *
 * Es el corazón de la tesis: aquí se contrasta la hipótesis. Todo se apoya en
 * el motor de `common/estadistica/contraste`, que verifica los supuestos ANTES
 * de elegir la prueba y se niega a emitir un valor p cuando el n no da.
 *
 * Deriva íntegramente del dataset canónico (`construirDataset`).
 */
@Injectable()
export class InvestigadorInferencialService {
  constructor(private readonly exportacion: InvestigadorExportacionService) {}

  private porGrupo(dataset: FilaDataset[], grupo: (typeof GRUPOS)[number]) {
    return dataset.filter((f) => f.grupo === grupo);
  }

  private valores(filas: FilaDataset[], campo: 'pretest_total' | 'postest_total' | 'ganancia' | 'delta_theta'): number[] {
    return filas.map((f) => f[campo]).filter((v): v is number => v !== null);
  }

  /** Casos COMPLETOS: los únicos que entran en un análisis pre-post. */
  private completos(filas: FilaDataset[]): FilaDataset[] {
    return filas.filter((f) => f.pretest_total !== null && f.postest_total !== null);
  }

  // ══════════════════ EQUIVALENCIA INICIAL DE LOS GRUPOS ══════════════════

  /**
   * ¿Partían iguales control y experimental?
   *
   * Sin esto, cualquier diferencia final es atacable: podría deberse a que un
   * grupo ya era mejor de entrada y no a la intervención. Se contrasta el
   * PRETEST y se describe además la composición de ambos grupos.
   */
  async equivalencia() {
    const dataset = await this.exportacion.construirDataset();
    const control = this.porGrupo(dataset, 'control');
    const experimental = this.porGrupo(dataset, 'experimental');

    const preC = this.valores(control, 'pretest_total');
    const preE = this.valores(experimental, 'pretest_total');

    const contraste = compararGrupos(preC, preE, {
      variable: 'el puntaje del pretest',
      etiquetaA: 'Control',
      etiquetaB: 'Experimental',
    });

    // Veredicto legible: es lo que se cita literalmente en la tesis.
    let veredicto: string;
    let comparables: boolean | null;
    if (!contraste.calculado) {
      comparables = null;
      veredicto =
        'No se puede afirmar ni descartar que los grupos sean comparables: no hay casos suficientes ' +
        'para contrastar el pretest. Mientras esto no se resuelva, cualquier diferencia posterior entre ' +
        'grupos queda sin control de la línea base.';
    } else if (contraste.significativo === false) {
      comparables = true;
      veredicto =
        `Los grupos NO difieren significativamente en el pretest (${formatearP(contraste.resultado!.p)}), ` +
        'por lo que son comparables y las diferencias posteriores pueden atribuirse a la intervención.';
    } else {
      comparables = false;
      veredicto =
        `ADVERTENCIA: los grupos SÍ difieren significativamente en el pretest (${formatearP(contraste.resultado!.p)}). ` +
        'No parten de una línea base equivalente, así que comparar directamente los puntajes finales no es ' +
        'válido: habría que analizar la ganancia o recurrir a un ANCOVA con el pretest como covariable.';
    }

    // Composición de los grupos (nivel inicial, θ inicial, paralelo, institución).
    const composicion = GRUPOS.map((g) => {
      const filas = this.porGrupo(dataset, g);
      const thetas = filas.map((f) => f.theta_inicial).filter((v): v is number => v !== null);
      const niveles = new Map<string, number>();
      for (const f of filas) {
        const k = f.nivel_inicial ?? 'sin diagnóstico';
        niveles.set(k, (niveles.get(k) ?? 0) + 1);
      }
      const paralelos = new Map<string, number>();
      for (const f of filas) paralelos.set(f.paralelo, (paralelos.get(f.paralelo) ?? 0) + 1);
      const instituciones = new Map<string, number>();
      for (const f of filas) instituciones.set(f.institucion, (instituciones.get(f.institucion) ?? 0) + 1);

      return {
        grupo: g,
        n: filas.length,
        theta_inicial_media: thetas.length ? media(thetas) : null,
        theta_inicial_n: thetas.length,
        nivel_inicial: [...niveles.entries()].map(([nivel, n]) => ({ nivel, n })),
        paralelos: [...paralelos.entries()].map(([paralelo, n]) => ({ paralelo, n })),
        instituciones: [...instituciones.entries()].map(([institucion, n]) => ({ institucion, n })),
      };
    });

    // θ inicial también se contrasta: es la medida IRT de la línea base.
    const thetaC = this.valores(control, 'pretest_total').length
      ? control.map((f) => f.theta_inicial).filter((v): v is number => v !== null)
      : [];
    const thetaE = experimental.map((f) => f.theta_inicial).filter((v): v is number => v !== null);
    const contrasteTheta = compararGrupos(thetaC, thetaE, {
      variable: 'la habilidad inicial θ (IRT)',
      etiquetaA: 'Control',
      etiquetaB: 'Experimental',
    });

    return {
      contraste_pretest: contraste,
      contraste_theta_inicial: contrasteTheta,
      comparables,
      veredicto,
      composicion,
      alfa: ALFA,
    };
  }

  // ══════════════════ RESULTADOS INFERENCIALES ══════════════════

  /**
   * El contraste central de la tesis. Cuatro preguntas, en el orden en que se
   * defienden:
   *
   *  1. ¿Mejoró cada grupo entre pretest y postest? (t pareada dentro de grupo)
   *  2. ¿Terminó mejor el experimental? (t independiente sobre el postest)
   *  3. ¿Ganó más el experimental? (t independiente sobre la ganancia)
   *  4. ¿Ganó más HABILIDAD (Δθ)? — el diferencial de esta tesis frente a una
   *     simple comparación de notas.
   */
  async resultados() {
    const dataset = await this.exportacion.construirDataset();
    const control = this.porGrupo(dataset, 'control');
    const experimental = this.porGrupo(dataset, 'experimental');

    // ── 1. Pre-post dentro de cada grupo (solo casos completos) ──
    const prePost = GRUPOS.map((g) => {
      const completos = this.completos(this.porGrupo(dataset, g));
      const pre = completos.map((f) => f.pretest_total as number);
      const post = completos.map((f) => f.postest_total as number);
      return {
        grupo: g,
        n_completos: completos.length,
        contraste: compararPrePost(pre, post, {
          variable: 'el puntaje',
          etiqueta: g === 'control' ? 'Control' : 'Experimental',
        }),
      };
    });

    // ── 2, 3 y 4. Entre grupos ──
    const postest = compararGrupos(
      this.valores(control, 'postest_total'),
      this.valores(experimental, 'postest_total'),
      { variable: 'el puntaje del postest', etiquetaA: 'Control', etiquetaB: 'Experimental' },
    );

    const ganancia = compararGrupos(
      this.valores(control, 'ganancia'),
      this.valores(experimental, 'ganancia'),
      { variable: 'la ganancia (postest − pretest)', etiquetaA: 'Control', etiquetaB: 'Experimental' },
    );

    const deltaTheta = compararGrupos(
      this.valores(control, 'delta_theta'),
      this.valores(experimental, 'delta_theta'),
      { variable: 'la ganancia de habilidad Δθ (IRT)', etiquetaA: 'Control', etiquetaB: 'Experimental' },
    );

    // ── Ganancia normalizada de Hake ──
    const hakePorGrupo = GRUPOS.map((g) => {
      const completos = this.completos(this.porGrupo(dataset, g));
      const gs = completos
        .map((f) => hake(f.pretest_total as number, f.postest_total as number))
        .filter((v): v is number => v !== null);
      const promedio = gs.length ? media(gs) : null;
      return {
        grupo: g,
        n: gs.length,
        g_promedio: promedio,
        clasificacion: promedio !== null ? clasificarHake(promedio) : null,
      };
    });

    const hakeControl = this.completos(control)
      .map((f) => hake(f.pretest_total as number, f.postest_total as number))
      .filter((v): v is number => v !== null);
    const hakeExp = this.completos(experimental)
      .map((f) => hake(f.pretest_total as number, f.postest_total as number))
      .filter((v): v is number => v !== null);

    const contrasteHake = compararGrupos(hakeControl, hakeExp, {
      variable: 'la ganancia normalizada de Hake ⟨g⟩',
      etiquetaA: 'Control',
      etiquetaB: 'Experimental',
    });

    return {
      alfa: ALFA,
      pre_post_por_grupo: prePost,
      postest,
      ganancia,
      delta_theta: deltaTheta,
      hake: {
        por_grupo: hakePorGrupo,
        contraste: contrasteHake,
        que_significa:
          '⟨g⟩ = (post − pre) / (100 − pre). Expresa lo aprendido como fracción de lo que quedaba por ' +
          'aprender, así que no penaliza a quien partía de un puntaje alto. Hake (1998): ≥0.7 alta, ' +
          '0.3–0.7 media, <0.3 baja.',
      },
    };
  }

  // ══════════════════ EVIDENCIA COMPLEMENTARIA ══════════════════

  /**
   * Relación entre el USO real del sistema y la ganancia.
   *
   * Sustituye la comparación de terciles por una CORRELACIÓN con su valor p:
   * usa toda la información en vez de trocear la muestra en tres, y produce un
   * resultado defendible en vez de meramente sugerente. Se elige Pearson o
   * Spearman según la normalidad de las variables, como corresponde.
   */
  async relacionUso() {
    const dataset = await this.exportacion.construirDataset();
    const conGanancia = dataset.filter((f) => f.ganancia !== null);

    const variables: { campo: keyof FilaDataset; etiqueta: string }[] = [
      { campo: 'ejercicios_resueltos', etiqueta: 'Ejercicios resueltos' },
      { campo: 'intentos_totales', etiqueta: 'Intentos totales' },
      { campo: 'xp_total', etiqueta: 'XP acumulado' },
      { campo: 'consultas_ia', etiqueta: 'Consultas a ALVARO' },
      { campo: 'retos_entregados', etiqueta: 'Retos entregados' },
      { campo: 'tasa_acierto', etiqueta: 'Tasa de acierto (%)' },
    ];

    const ganancias = conGanancia.map((f) => f.ganancia as number);
    const suficiente = conGanancia.length >= 10;

    const correlaciones = variables.map(({ campo, etiqueta }) => {
      const xs = conGanancia.map((f) => Number(f[campo] ?? 0));
      if (conGanancia.length < 3) {
        return {
          variable: etiqueta, metodo: null, r: null, p: null, n: conGanancia.length,
          magnitud: null, significativa: null,
          interpretacion: 'No hay casos suficientes para estimar una correlación.',
        };
      }

      // Pearson exige normalidad; si alguna de las dos series no la cumple, la
      // correcta es Spearman (asociación monótona sobre rangos).
      const swX = shapiroWilk(xs);
      const swY = shapiroWilk(ganancias);
      const normales =
        Number.isFinite(swX.p) && Number.isFinite(swY.p) && swX.p >= ALFA && swY.p >= ALFA;
      const metodo = normales ? 'Pearson' : 'Spearman';
      const c = normales ? pearson(xs, ganancias) : spearman(xs, ganancias);
      const significativa = Number.isFinite(c.p) ? c.p < ALFA : null;

      return {
        variable: etiqueta,
        metodo,
        r: Number.isFinite(c.r) ? c.r : null,
        p: Number.isFinite(c.p) ? c.p : null,
        n: c.n,
        magnitud: c.magnitud,
        significativa,
        interpretacion: !Number.isFinite(c.r)
          ? 'No estimable con estos datos.'
          : significativa
            ? `Asociación ${c.magnitud} y estadísticamente significativa (${formatearP(c.p)}) entre ${etiqueta.toLowerCase()} y la ganancia.`
            : `No se detecta asociación significativa (${formatearP(c.p)}); la correlación observada es ${c.magnitud}.`,
      };
    });

    return {
      hay_datos: conGanancia.length > 0,
      n: conGanancia.length,
      suficiente,
      advertencia: suficiente
        ? null
        : `Con ${conGanancia.length} casos completos ninguna correlación es interpretable. Se muestran como exploratorias.`,
      correlaciones,
      nota_metodologica:
        'La correlación reemplaza a la antigua comparación por terciles de uso: dividir la muestra en ' +
        'tercios descarta información y, con n pequeño, sugiere patrones que no resisten un contraste. ' +
        'La correlación usa todos los casos y viene con su valor p.',
    };
  }
}
