'use client';

import { forwardRef } from 'react';
import { Check } from '@/components/icons';
import { useSound } from '@/components/use-sound';

/**
 * Opción de respuesta (A/B/C/D) con estados claros:
 *  · reposo: borde sutil + badge de letra con borde,
 *  · hover: borde de acento + anillo suave + leve elevación,
 *  · seleccionada: borde/relleno de acento + badge relleno + check,
 *  · foco de teclado: anillo visible (global :focus-visible).
 * Semántica accesible: role="radio" (dentro de un radiogroup). La aparición
 * animada la aporta el contenedor de la pregunta (fade + slide), por lo que aquí
 * NO usamos animación propia (evita estados invisibles al anidar en AnimatePresence).
 */
export const OptionCard = forwardRef<HTMLButtonElement, {
  letra: string;
  texto: string;
  selected: boolean;
  onSelect: () => void;
  tabbable: boolean;
}>(function OptionCard({ letra, texto, selected, onSelect, tabbable }, ref) {
  const { playClick } = useSound();
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabbable ? 0 : -1}
      data-sonido-off
      onClick={() => { playClick(); onSelect(); }}
      className={`group flex min-h-[64px] items-center gap-3 rounded-xl border p-4 text-left transition-colors duration-200 active:scale-[0.99] ${
        selected
          ? 'border-prexi-blue bg-prexi-blue/10 ring-2 ring-prexi-blue/25'
          : 'border-line bg-app/60 hover:border-prexi-blue/60 hover:ring-2 hover:ring-prexi-blue/15'
      }`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-bold transition-colors ${
          selected ? 'border-prexi-blue bg-prexi-blue text-accent-on' : 'border-line text-muted group-hover:border-prexi-blue/60 group-hover:text-prexi-blue-deep'
        }`}
      >
        {letra}
      </span>
      <span className="flex-1 whitespace-pre-line font-medium text-fg">{texto}</span>
      {selected && <Check className="h-5 w-5 shrink-0 text-prexi-blue-deep" />}
    </button>
  );
});
