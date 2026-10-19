/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  DESBLOQUEO SECUENCIAL DE TEMAS — ÚNICO LUGAR DE LA VERDAD
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Regla: dentro de una unidad, los temas se abren EN ORDEN. El primero está
 *  abierto; cada uno de los siguientes se abre cuando el anterior está completo.
 *  Lo mismo vale para los subtemas dentro de su tema.
 *
 *  El desbloqueo se CALCULA desde el avance real del estudiante. No se confía
 *  en la marca guardada `ProgresoTema.desbloqueado`: el diagnóstico inicial la
 *  ponía en verdadero para todos los temas que evaluaba, de cualquier unidad, y
 *  con eso un estudiante podía adelantar temas sin haber hecho los anteriores.
 *
 *  El diagnóstico solo decide con qué NIVEL arranca el estudiante en cada tema
 *  cuando le toque; nunca le abre temas ni unidades.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Ejercicios resueltos que hacen falta para dar un tema por completo: su umbral
 * ENTERO (10 por defecto). El porcentaje de la configuración se conserva en la
 * firma porque los llamadores ya lo traen, pero no rebaja la exigencia del tema:
 * ese porcentaje gobierna solo los niveles de gamificación.
 */
export function requeridosTema(umbral: number, umbralPct?: number): number {
  void umbralPct;
  return umbral;
}

/**
 * Cuánto avance de un tema se GUARDA en `ProgresoTema.ejerciciosCompletados`.
 *
 * Regla (acordada para la recolección): un tema se completa al resolver los 10
 * ejercicios DEL NIVEL EN QUE ESTÁ el estudiante en ese tema —o todos los de
 * ese nivel, si el docente aún no cargó 10, para que nadie quede atrapado—.
 * Subir de nivel exige menos (ver `minPractica*`, 8 por defecto), así que quien
 * sube con 8 sigue practicando y cierra el tema con los 10 del nivel nuevo.
 *
 * Se cuentan ejercicios DISTINTOS (repetir uno no suma). Al completarse se
 * guarda el umbral y ya NO baja: subir de nivel después no vuelve a cerrar el
 * tema siguiente. Así todos los que comparan `ejerciciosCompletados >= umbral`
 * siguen funcionando sin cambios.
 */
export function avanceTemaGuardado(previo: number, resueltosNivel: number, totalNivel: number, umbral: number): number {
  if (previo >= umbral) return previo; // completo para siempre
  const requeridos = totalNivel > 0 ? Math.min(umbral, totalNivel) : umbral;
  return resueltosNivel >= requeridos ? umbral : resueltosNivel;
}

export function temaCompleto(completados: number, umbral: number, umbralPct: number): boolean {
  return completados >= requeridosTema(umbral, umbralPct);
}

/**
 * Para una lista ORDENADA de temas hermanos, dice cuáles están desbloqueados.
 * `contenedorAbierto` = la unidad (o el tema padre) está desbloqueada.
 */
export function desbloqueoSecuencial(
  hermanos: { completados: number; umbral: number }[],
  umbralPct: number,
  contenedorAbierto = true,
): boolean[] {
  let abierto = contenedorAbierto;
  return hermanos.map((t) => {
    const actual = abierto;
    // El siguiente solo se abre si este está abierto Y completo.
    abierto = actual && temaCompleto(t.completados, t.umbral, umbralPct);
    return actual;
  });
}
