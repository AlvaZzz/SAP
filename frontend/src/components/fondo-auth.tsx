'use client';

/**
 * Estilo compartido de los CAMPOS de las pantallas de autenticación.
 *
 * Aquí vivía además `FondoAuth`, el fondo a pantalla completa con imagen y velo
 * translúcido. Se eliminó al rediseñar el login a dos columnas
 * (components/login/*), que trae su propio fondo: ya no lo usaba nadie.
 */

/**
 * Clase común de los campos de autenticación (input y select).
 *
 * `min-h-[3rem]` iguala la altura de `<select>` e `<input>`: con solo `py-2.5` el
 * select queda ~4px más bajo (su alto intrínseco no es el del input) y la rejilla
 * se veía desalineada. Al ir en rem acompaña la escala responsiva del root.
 */
export function inputAuthCls(error: boolean) {
  return `w-full min-h-[3rem] rounded-xl border bg-app/70 px-4 py-2.5 text-fg outline-none transition placeholder:text-muted focus:ring-2 ${
    error
      ? 'border-red-400 focus:border-red-400 focus:ring-red-500/25'
      : 'border-line focus:border-prexi-blue focus:ring-prexi-blue/25'
  }`;
}
