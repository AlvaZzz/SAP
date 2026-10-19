import { NivelDificultad } from '@prisma/client';
import { nivelDominioAgregado } from '../../common/niveles/nivel-dificultad';

/**
 * RESUMEN ACADÉMICO de un estudiante — funciones puras que comparten el
 * dashboard, la lista de seguimiento, la ficha y la evaluación final, para que
 * el docente vea SIEMPRE el mismo nivel y el mismo promedio en todas partes.
 */

// Las reglas (umbral 80, promedio, situación) viven en common/niveles/reglas-evaluacion.
export {
  UMBRAL_APROBACION, UMBRAL_CERCA, promedioGeneral, situacionPromedio,
} from '../../common/niveles/reglas-evaluacion';
export type { NotaExamen, NotaSubida, SituacionPromedio } from '../../common/niveles/reglas-evaluacion';

/**
 * NIVEL ACTUAL del estudiante (uno solo, para listas y conteos).
 *
 * Un estudiante tiene un nivel POR TEMA; para resumirlo se usa el mismo dominio
 * agregado que él ve en su unidad. Si todavía no practicó ningún tema, vale el
 * nivel con el que lo clasificó el diagnóstico inicial; sin diagnóstico, Básico.
 */
export function nivelGlobal(
  nivelesPorTema: NivelDificultad[],
  nivelInicial: NivelDificultad | null | undefined,
): NivelDificultad {
  if (nivelesPorTema.length === 0) return nivelInicial ?? 'basico';
  return nivelDominioAgregado(nivelesPorTema).nivelDominio;
}

export interface Umbrales { diasInactivo: number; tasaAciertoMin: number; minIntentos: number; diasEstancado: number }
export interface MotivoRiesgo { clave: string; detalle: string; gravedad: 'alta' | 'media' }

const MS_DIA = 86_400_000;

/**
 * Motivos por los que un estudiante necesita atención. Se listan TODOS los que
 * concurren, porque cada uno pide una acción distinta: a quien no entra hay que
 * buscarlo; a quien entra y falla todo hay que explicarle.
 */
export function motivosDeRiesgo(
  e: {
    tieneDiagnostico: boolean; ultimaActividad: Date | null; intentos: number; tasaAcierto: number | null;
    ultimoCambioNivel: Date | null; creadoEn: Date; yaIngreso: boolean;
  },
  umb: Umbrales,
  ahora = Date.now(),
): MotivoRiesgo[] {
  const motivos: MotivoRiesgo[] = [];
  const dias = (d: Date) => Math.floor((ahora - d.getTime()) / MS_DIA);

  if (!e.yaIngreso) {
    motivos.push({ clave: 'nunca_entro', detalle: 'Todavía no ingresó al sistema con su usuario y su CI.', gravedad: 'alta' });
    return motivos;
  }
  if (!e.tieneDiagnostico) {
    motivos.push({ clave: 'sin_diagnostico', detalle: 'No rindió el diagnóstico inicial: aún no puede practicar.', gravedad: 'alta' });
  }
  if (e.ultimaActividad === null) {
    if (e.tieneDiagnostico) motivos.push({ clave: 'sin_practica', detalle: 'Rindió el diagnóstico pero no resolvió ningún ejercicio.', gravedad: 'media' });
  } else {
    const d = dias(e.ultimaActividad);
    if (d > umb.diasInactivo) {
      motivos.push({ clave: 'inactivo', detalle: `${d} días sin actividad (se avisa desde ${umb.diasInactivo}).`, gravedad: d > umb.diasInactivo * 2 ? 'alta' : 'media' });
    }
  }
  if (e.intentos >= umb.minIntentos && e.tasaAcierto !== null && e.tasaAcierto < umb.tasaAciertoMin) {
    motivos.push({ clave: 'acierto_bajo', detalle: `${e.tasaAcierto} % de acierto en ${e.intentos} intentos: practica, pero no está entendiendo.`, gravedad: 'media' });
  }
  if (e.ultimoCambioNivel && e.ultimaActividad && dias(e.ultimoCambioNivel) > umb.diasEstancado) {
    motivos.push({ clave: 'estancado', detalle: `${dias(e.ultimoCambioNivel)} días sin subir de nivel en ningún tema.`, gravedad: 'media' });
  }
  return motivos;
}

// ── Dónde va cada estudiante y qué temas le cuestan al curso ──

export interface TemaRuta { id: number; etiqueta: string; umbral: number }
export interface Posicion { completos: number; total: number; tema_actual: { id: number; etiqueta: string } | null }

/**
 * Posición del estudiante en la ruta del curso: cuántos temas completó y cuál
 * es el PRIMERO que aún no termina (ese es "donde va"). `ruta` llega en el
 * orden en que se estudia; un tema está completo con la misma regla que ve el
 * estudiante (`requeridos` ejercicios resueltos).
 */
export function posicionEnRuta(
  ruta: TemaRuta[],
  completados: Map<number, number>,
  requeridos: (umbral: number) => number,
): Posicion {
  let completos = 0;
  let actual: Posicion['tema_actual'] = null;
  for (const t of ruta) {
    if ((completados.get(t.id) ?? 0) >= requeridos(t.umbral)) completos += 1;
    else if (!actual) actual = { id: t.id, etiqueta: t.etiqueta };
  }
  return { completos, total: ruta.length, tema_actual: actual };
}

export interface TemaDificil { tema_id: number; tema: string; intentos: number; tasa_acierto: number }

/**
 * Temas con MENOR porcentaje de acierto del curso, de peor a mejor. Solo entran
 * los que tienen suficientes intentos: con dos o tres respuestas el porcentaje
 * no dice nada.
 */
export function temasQueCuestan(
  filas: { temaId: number; intentos: number; aciertos: number }[],
  etiquetas: Map<number, string>,
  minIntentos = 10,
  tope = 5,
): TemaDificil[] {
  return filas
    .filter((f) => f.intentos >= minIntentos && etiquetas.has(f.temaId))
    .map((f) => ({ tema_id: f.temaId, tema: etiquetas.get(f.temaId)!, intentos: f.intentos, tasa_acierto: Math.round((f.aciertos / f.intentos) * 100) }))
    .sort((a, b) => a.tasa_acierto - b.tasa_acierto || b.intentos - a.intentos)
    .slice(0, tope);
}
