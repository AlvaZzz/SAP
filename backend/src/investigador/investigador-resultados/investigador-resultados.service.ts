import { Injectable } from '@nestjs/common';
import { InvestigadorExportacionService, PorCategoria } from '../investigador-exportacion/investigador-exportacion.service';

interface Descriptivos { n: number; media: number | null; sd: number | null; min: number | null; max: number | null }

const CATEGORIAS: { key: keyof PorCategoria; label: string }[] = [
  { key: 'variables', label: 'Variables' },
  { key: 'condicionales', label: 'Condicionales' },
  { key: 'bucles', label: 'Bucles' },
  { key: 'funciones', label: 'Funciones' },
  { key: 'estructuras', label: 'Estructuras de datos' },
];
const GRUPOS = ['control', 'experimental'] as const;

/**
 * Resultados pretest/postest (rol investigador). SOLO estadística DESCRIPTIVA
 * (media, desviación estándar muestral, mínimo, máximo, ganancia media) por
 * grupo. La inferencial (prueba t, valores p) NO se calcula aquí: se hace fuera
 * del sistema con el CSV exportado. Reutiliza el dataset canónico (una fuente).
 */
@Injectable()
export class InvestigadorResultadosService {
  constructor(private readonly exportacion: InvestigadorExportacionService) {}

  private round1(v: number): number { return Math.round(v * 10) / 10; }

  /** Media, desviación estándar muestral (n-1), mínimo y máximo. */
  private descriptivos(valores: number[]): Descriptivos {
    const vals = valores.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
    const n = vals.length;
    if (n === 0) return { n: 0, media: null, sd: null, min: null, max: null };
    const media = vals.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : 0;
    return { n, media: this.round1(media), sd: this.round1(sd), min: Math.min(...vals), max: Math.max(...vals) };
  }

  private promedio(valores: (number | null)[]): number | null {
    const vals = valores.filter((v): v is number => v !== null);
    return vals.length ? this.round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }

  async resumen() {
    const dataset = await this.exportacion.construirDataset();

    // Descriptivos por grupo (pretest, postest, ganancia media).
    const resumen_grupos = GRUPOS.map((grupo) => {
      const filas = dataset.filter((f) => f.grupo === grupo);
      const pre = filas.map((f) => f.pretest_total).filter((v): v is number => v !== null);
      const post = filas.map((f) => f.postest_total).filter((v): v is number => v !== null);
      const gan = filas.map((f) => f.ganancia).filter((v): v is number => v !== null);
      return {
        grupo,
        n: filas.length,
        con_pretest: pre.length,
        con_postest: post.length,
        pretest: this.descriptivos(pre),
        postest: this.descriptivos(post),
        ganancia_media: gan.length ? this.round1(gan.reduce((a, b) => a + b, 0) / gan.length) : null,
      };
    });

    // Comparativa por categoría: media de % por grupo (pretest y postest).
    const por_categoria = CATEGORIAS.map(({ key, label }) => {
      const fila: Record<string, number | null | string> = { categoria: label };
      for (const grupo of GRUPOS) {
        const filas = dataset.filter((f) => f.grupo === grupo);
        fila[`${grupo}_pre`] = this.promedio(filas.map((f) => f.pre[key]));
        fila[`${grupo}_post`] = this.promedio(filas.map((f) => f.post[key]));
      }
      return fila;
    });

    const hayDatos = dataset.some((f) => f.pretest_total !== null || f.postest_total !== null);

    return { hay_datos: hayDatos, resumen_grupos, por_categoria };
  }
}
