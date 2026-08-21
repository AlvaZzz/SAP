import { Injectable } from '@nestjs/common';
import { InvestigadorExportacionService } from '../investigador-exportacion/investigador-exportacion.service';

const GRUPOS = ['control', 'experimental'] as const;

/**
 * Datos complementarios (rol investigador): relación DESCRIPTIVA entre el uso del
 * sistema (XP, ejercicios, consultas a PREXI, pistas) y la mejora (ganancia =
 * postest − pretest). Evidencia de apoyo para argumentar que la adaptatividad y
 * la gamificación se asocian con más aprendizaje. Reutiliza el dataset canónico.
 */
@Injectable()
export class InvestigadorDatosService {
  constructor(private readonly exportacion: InvestigadorExportacionService) {}

  private round1(v: number): number { return Math.round(v * 10) / 10; }
  private prom(xs: number[]): number | null { return xs.length ? this.round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null; }

  async relacion() {
    const dataset = await this.exportacion.construirDataset();
    // Solo estudiantes con ganancia (rindieron pretest Y postest).
    const conGanancia = dataset.filter((f) => f.ganancia !== null);

    const puntos = conGanancia.map((f) => ({
      id_anonimo: f.id_anonimo,
      grupo: f.grupo,
      ganancia: f.ganancia as number,
      xp_total: f.xp_total,
      ejercicios_resueltos: f.ejercicios_resueltos,
      consultas_ia: f.consultas_ia,
      pistas_usadas: f.pistas_usadas,
    }));

    // Promedios descriptivos por grupo (para la comparación de barras).
    const promedios_por_grupo = GRUPOS.map((grupo) => {
      const filas = conGanancia.filter((f) => f.grupo === grupo);
      return {
        grupo,
        n: filas.length,
        ganancia: this.prom(filas.map((f) => f.ganancia as number)),
        xp_total: this.prom(filas.map((f) => f.xp_total)),
        ejercicios_resueltos: this.prom(filas.map((f) => f.ejercicios_resueltos)),
        consultas_ia: this.prom(filas.map((f) => f.consultas_ia)),
        pistas_usadas: this.prom(filas.map((f) => f.pistas_usadas)),
      };
    });

    // Ganancia media según nivel de uso (terciles de ejercicios resueltos):
    // ilustra "más práctica ↔ más ganancia" de forma descriptiva.
    const ordenado = [...conGanancia].sort((a, b) => a.ejercicios_resueltos - b.ejercicios_resueltos);
    const ganancia_por_uso = this.terciles(ordenado);

    return { hay_datos: puntos.length > 0, puntos, promedios_por_grupo, ganancia_por_uso };
  }

  /** Divide en tercios (bajo/medio/alto uso) y promedia la ganancia de cada uno. */
  private terciles(ordenado: { ejercicios_resueltos: number; ganancia: number | null }[]) {
    const n = ordenado.length;
    if (n === 0) return [] as { nivel: string; rango: string; ganancia_media: number | null; n: number }[];
    const corte = Math.ceil(n / 3);
    const grupos = [
      { nivel: 'Uso bajo', filas: ordenado.slice(0, corte) },
      { nivel: 'Uso medio', filas: ordenado.slice(corte, corte * 2) },
      { nivel: 'Uso alto', filas: ordenado.slice(corte * 2) },
    ];
    return grupos.map((g) => {
      const ejs = g.filas.map((f) => f.ejercicios_resueltos);
      return {
        nivel: g.nivel,
        rango: ejs.length ? `${Math.min(...ejs)}–${Math.max(...ejs)} ejercicios` : '—',
        ganancia_media: this.prom(g.filas.map((f) => f.ganancia as number)),
        n: g.filas.length,
      };
    });
  }
}
