'use client';

import { MutableRefObject, useEffect } from 'react';

/** ¿El estudiante está escribiendo? Entonces las teclas son texto, no atajos. */
export function escribiendo(target: EventTarget | null): boolean {
  const t = target as HTMLElement | null;
  return !!t?.closest?.('input, textarea, select, [contenteditable="true"], .cm-editor, .monaco-editor');
}

/**
 * Atajos GLOBALES para elegir una opción: A–D (la letra de la opción) o 1–9 (su
 * posición), sin tener que enfocar antes el grupo. Ritmo de juego en escritorio;
 * en el celular simplemente no se usan. Se ignoran mientras se escribe y dentro
 * del propio grupo (que ya maneja letras y flechas).
 */
export function useAtajosOpciones(
  ids: string[],
  activo: boolean,
  elegir: (id: string) => void,
  refs: MutableRefObject<(HTMLButtonElement | null)[]>,
) {
  useEffect(() => {
    if (!activo) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || escribiendo(e.target)) return;
      if ((e.target as HTMLElement | null)?.closest?.('[role="radiogroup"]')) return;
      const porNumero = /^[1-9]$/.test(e.key) ? Number(e.key) - 1 : -1;
      const idx = porNumero >= 0 ? porNumero : ids.findIndex((x) => x.toUpperCase() === e.key.toUpperCase());
      if (idx < 0 || idx >= ids.length) return;
      e.preventDefault();
      elegir(ids[idx]);
      refs.current[idx]?.focus();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  });
}
