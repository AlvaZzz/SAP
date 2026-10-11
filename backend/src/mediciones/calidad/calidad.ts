import { CARACTERISTICAS_ISO25010, Caracteristica } from './items-iso25010';

/**
 * PUNTUACIÓN DEL CUESTIONARIO ISO/IEC 25010 — funciones puras.
 *
 * Indicadores de la tesis (variable "calidad del producto de software"):
 *
 *   · Valoración media por característica:
 *       media, entre evaluadores, de la media de los ítems de la característica.
 *   · Cumplimiento de subcaracterísticas:
 *       % de subcaracterísticas cuya media ≥ nivel aceptable (por defecto 4,0).
 *
 * Todos los ítems están redactados en sentido positivo: no hay recodificación.
 */

/** Respuestas de UN evaluador: { itemId → valor Likert 1..5 }. */
export type RespuestasEvaluador = Record<string, number>;

const media = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const redondear = (v: number | null, dec = 2): number | null =>
  v === null ? null : Math.round(v * 10 ** dec) / 10 ** dec;

/** Media de un evaluador sobre un conjunto de ítems (null si no respondió ninguno). */
function mediaEvaluador(r: RespuestasEvaluador, ids: string[]): number | null {
  return media(ids.map((id) => r[id]).filter((v): v is number => typeof v === 'number'));
}

export interface ResultadoSubcaracteristica {
  clave: string;
  nombre: string;
  media: number | null;
  aceptable: boolean | null;
}

export interface ResultadoCaracteristica {
  clave: string;
  nombre: string;
  n_items: number;
  media: number | null;
  aceptable: boolean | null;
  /** Media de la característica de cada evaluador (insumo del IC por bootstrap). */
  por_evaluador: number[];
  subcaracteristicas: ResultadoSubcaracteristica[];
}

export interface ResultadoCalidad {
  n_evaluadores: number;
  nivel_aceptable: number;
  caracteristicas: ResultadoCaracteristica[];
  subcaracteristicas_total: number;
  subcaracteristicas_aceptables: number;
  /** % de subcaracterísticas que alcanzan el nivel aceptable (null sin datos). */
  pct_subcaracteristicas_aceptables: number | null;
  /** ¿TODAS las características alcanzan el nivel aceptable? (null sin datos). */
  todas_aceptables: boolean | null;
}

export function puntuarCalidad(
  evaluadores: RespuestasEvaluador[],
  nivelAceptable: number,
  caracteristicas: Caracteristica[] = CARACTERISTICAS_ISO25010,
): ResultadoCalidad {
  const resultado = caracteristicas.map((c): ResultadoCaracteristica => {
    const idsCaracteristica = c.subcaracteristicas.flatMap((s) => s.items.map((i) => i.id));
    const porEvaluador = evaluadores
      .map((r) => mediaEvaluador(r, idsCaracteristica))
      .filter((v): v is number => v !== null);
    const mediaC = media(porEvaluador);

    const subs = c.subcaracteristicas.map((s): ResultadoSubcaracteristica => {
      const ids = s.items.map((i) => i.id);
      const m = media(evaluadores.map((r) => mediaEvaluador(r, ids)).filter((v): v is number => v !== null));
      return { clave: s.clave, nombre: s.nombre, media: redondear(m), aceptable: m === null ? null : m >= nivelAceptable };
    });

    return {
      clave: c.clave,
      nombre: c.nombre,
      n_items: idsCaracteristica.length,
      media: redondear(mediaC),
      aceptable: mediaC === null ? null : mediaC >= nivelAceptable,
      por_evaluador: porEvaluador,
      subcaracteristicas: subs,
    };
  });

  const subs = resultado.flatMap((c) => c.subcaracteristicas);
  const conDato = subs.filter((s) => s.aceptable !== null);
  const aceptables = conDato.filter((s) => s.aceptable).length;
  const hayDatos = evaluadores.length > 0 && conDato.length > 0;

  return {
    n_evaluadores: evaluadores.length,
    nivel_aceptable: nivelAceptable,
    caracteristicas: resultado,
    subcaracteristicas_total: subs.length,
    subcaracteristicas_aceptables: aceptables,
    pct_subcaracteristicas_aceptables: hayDatos ? Math.round((aceptables / subs.length) * 1000) / 10 : null,
    todas_aceptables: hayDatos ? resultado.every((c) => c.aceptable === true) : null,
  };
}
