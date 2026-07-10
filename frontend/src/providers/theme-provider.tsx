'use client';

import { ThemeProvider as NextThemes } from 'next-themes';
import { ReactNode } from 'react';

/**
 * Tema claro/oscuro con persistencia (localStorage vía next-themes).
 * Estrategia "class" para activar las variantes dark: de Tailwind.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
