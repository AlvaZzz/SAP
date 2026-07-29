'use client';

import { useEffect } from 'react';
import { useSound } from './use-sound';

/**
 * SONIDO GLOBAL DE BOTONES: un "click" suave y consistente al pulsar CUALQUIER
 * botón/enlace de la app (navegación, Comprobar, Siguiente, Volver…), sin tener
 * que cablear cada componente. Escucha en fase de captura para sonar aunque el
 * handler navegue de inmediato.
 *
 * - Respeta el mute global (`usuario.sonidosActivados`, altavoz de la barra).
 * - Solo suena tras interacción del usuario (es un listener de click → cumple la
 *   política de autoplay; nada suena al cargar la página).
 * - Los componentes con sonido PROPIO (opciones de ejercicio, fichas, flashcards)
 *   se marcan con `data-sonido-off` para no duplicar el click.
 * - Complemento, nunca única señal: todos los estados tienen indicación visual.
 */
export function SonidoGlobal() {
  const { playClick } = useSound();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      const el = t.closest<HTMLElement>('button, a, [role="button"]');
      if (!el) return;
      if (el.closest('[data-sonido-off]')) return;                    // sonido propio
      if ((el as HTMLButtonElement).disabled) return;                 // botón inerte
      if (el.getAttribute('aria-disabled') === 'true') return;
      playClick();
    };
    document.addEventListener('click', h, true);
    return () => document.removeEventListener('click', h, true);
  }, [playClick]);

  return null;
}
