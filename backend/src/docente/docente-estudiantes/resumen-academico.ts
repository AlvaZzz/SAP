import { NivelDificultad } from '@prisma/client';
import { nivelDominioAgregado } from '../../common/niveles/nivel-dificultad';

/**
 * RESUMEN ACADÉMICO de un estudiante — funciones puras que comparten el
 * dashboard, la lista de seguimiento, la ficha y la evaluación final, para que
 * el docente vea SIEMPRE el mismo nivel y el mismo promedio en todas partes.
 */

/** Nota mínima (sobre 100) para aprobar una evaluación y subir de nivel. */
export const UMBRAL_APROBACION = 80;
/** Desde aquí un estudiante está "cerca del umbral": el docente puede evaluarlo caso por caso. */
export const UMBRAL_CERCA = 70;

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

export interface NotaExamen { unidadId: number; puntaje: number }
export interface NotaSubida { temaId: number; hacia: NivelDificultad; puntaje: number }

/**
 * PROMEDIO GENERAL sobre 100.
 *
 * Media de las notas de sus evaluaciones, contando el MEJOR intento de cada una:
 *   · examen de fin de unidad → mejor nota por unidad;
 *   · evaluación de subida de nivel → mejor nota por tema y nivel.
 * Devuelve null si aún no rindió ninguna: "sin evaluaciones" no es un cero.
 */
export function promedioGeneral(examenes: NotaExamen[], subidas: NotaSubida[]): number | null {
  const mejores = new Map<string, number>();
  const anotar = (clave: string, puntaje: number) => mejores.set(clave, Math.max(mejores.get(clave) ?? 0, puntaje));
  for (const e of examenes) anotar(`u${e.unidadId}`, e.puntaje);
  for (const s of subidas) anotar(`t${s.temaId}:${s.hacia}`, s.puntaje);
  if (mejores.size === 0) return null;
  const notas = [...mejores.values()];
  return Math.round(notas.reduce((a, b) => a + b, 0) / notas.length);
}

export type SituacionPromedio = 'aprobado' | 'cerca' | 'bajo' | 'sin_evaluaciones';

/** Dónde está el promedio respecto del umbral de 80. */
export function situacionPromedio(promedio: number | null): SituacionPromedio {
  if (promedio === null) return 'sin_evaluaciones';
  if (promedio >= UMBRAL_APROBACION) return 'aprobado';
  if (promedio >= UMBRAL_CERCA) return 'cerca';
  return 'bajo';
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
    motivos.push({ clave: 'nunca_entro', detalle: 'Todavía no ingresó al sistema con su RU y su CI.', gravedad: 'alta' });
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
