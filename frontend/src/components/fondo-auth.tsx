'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ThemeToggle } from './theme-toggle';

/**
 * Fondo compartido de las pantallas de AUTENTICACIÓN (login / registro).
 * Imagen de fondo a pantalla completa (DOS imágenes según el dispositivo) +
 * velo translúcido por tokens para legibilidad, y la tarjeta (children) centrada
 * encima con estilo glassmorphism. Toggle de tema en la esquina.
 *
 * Imágenes esperadas en /public (las provee el usuario, libres de derechos):
 *   · PC/tablet: login-bg-desktop.(jpg|png|webp)
 *   · Móvil:     login-bg-mobile.(jpg|png|webp)
 * Retrocompatibilidad: si solo hay una genérica login-bg.(jpg|png|webp) se usa
 * esa. Si no hay ninguna, se muestra el degradado + arte SVG propio (fallback).
 */
const EXTS = ['.jpg', '.png', '.webp'];

/** Elige y "asciende" a la mejor imagen disponible según el viewport. */
function useFondoImagen() {
  const [bg, setBg] = useState('/login-bg.svg');
  useEffect(() => {
    let cancelado = false;
    const cargar = () => {
      const movil = window.matchMedia('(max-width: 640px)').matches;
      const bases = movil
        ? ['/login-bg-mobile', '/login-bg-desktop', '/login-bg']
        : ['/login-bg-desktop', '/login-bg-mobile', '/login-bg'];
      const cands = bases.flatMap((b) => EXTS.map((e) => b + e));
      // Prueba en ORDEN (respeta prioridad): la primera que cargue gana.
      const intentar = (i: number) => {
        if (cancelado || i >= cands.length) return;
        const img = new Image();
        img.onload = () => {
          if (cancelado) return;
          if (img.naturalWidth > 0) setBg(cands[i]);
          else intentar(i + 1);
        };
        img.onerror = () => intentar(i + 1);
        img.src = cands[i];
      };
      intentar(0);
    };
    cargar();
    // Reevalúa al rotar/cambiar de tamaño (móvil ↔ escritorio).
    const mq = window.matchMedia('(max-width: 640px)');
    mq.addEventListener('change', cargar);
    return () => { cancelado = true; mq.removeEventListener('change', cargar); };
  }, []);
  return bg;
}

/** Clases de la TARJETA glassmorphism compartida (login/registro). */
export const tarjetaAuthCls =
  'w-full animate-fade-up rounded-[18px] border border-line bg-card/80 p-6 shadow-lift ' +
  'backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 sm:p-8 ' +
  'dark:bg-card/80 dark:supports-[backdrop-filter]:bg-card/70';

/** Clases de INPUT translúcido coherente con los tokens (foco de acento; error rojo). */
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

export function FondoAuth({ children }: { children: ReactNode }) {
  const bg = useFondoImagen();
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
      {/* Degradado base (siempre, por si aún no carga la imagen) */}
      <div aria-hidden className="fixed inset-0 -z-30 bg-gradient-to-br from-app via-app to-subtle" />
      {/* Imagen de fondo, atenuada para que la tarjeta resalte (se sigue viendo) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bg} alt="" aria-hidden
        className="fixed inset-0 -z-20 h-full w-full object-cover opacity-70 dark:opacity-60" />
      {/* Velo translúcido + blur suave (legibilidad, sin ocultar el fondo) */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-app/50 backdrop-blur-[2px] dark:bg-app/60" />
      <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-t from-app/75 via-app/25 to-app/45 dark:from-app dark:via-app/45 dark:to-app/60" />

      {/* Toggle de tema (glass) accesible en la esquina */}
      <div className="absolute right-4 top-4 z-10 rounded-xl border border-line bg-card/70 backdrop-blur">
        <ThemeToggle />
      </div>

      {/* Contenido (tarjeta) centrado; permite scroll si el formulario es alto */}
      <div className="relative grid min-h-[100dvh] place-items-center p-4 py-10 sm:p-6">
        {children}
      </div>
    </div>
  );
}
