'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from './icons';

/** Botón sol/luna para alternar tema. Evita parpadeo de hidratación. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const oscuro = resolvedTheme === 'dark';

  // Hasta montar, el tema es desconocido en SSR: usamos una etiqueta estable para
  // evitar un hydration mismatch en el aria-label/title.
  const etiqueta = !montado ? 'Cambiar tema' : oscuro ? 'Activar modo claro' : 'Activar modo oscuro';

  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={() => setTheme(oscuro ? 'light' : 'dark')}
      className={`grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-subtle hover:text-fg ${className}`}
    >
      {montado ? (
        oscuro ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />
      ) : (
        <span className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}
