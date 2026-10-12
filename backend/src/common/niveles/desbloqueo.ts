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

/** Ejercicios resueltos que hacen falta para dar un tema por completo. */
export function requeridosTema(umbral: number, umbralPct: number): number {
  return Math.ceil((umbral * umbralPct) / 100);
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
