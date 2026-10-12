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
