import { ReactNode } from 'react';

/**
 * LAYOUT DEL GRUPO AUTH (/login y /registro) — FUERZA MODO OSCURO.
 *
 * Estas pantallas se ven SIEMPRE oscuras, sin importar el tema del sistema; el
 * toggle claro/oscuro solo aplica dentro del sistema autenticado. En vez de anidar
 * un segundo `ThemeProvider` de next-themes (que competiría por la clase del <html>
 * y podía parpadear), envolvemos el contenido en un contenedor con la clase `dark`
 * fija: como Tailwind usa `darkMode: 'class'` y los tokens del tema viven bajo
 * `.dark` en globals.css, todo lo que cuelga de aquí resuelve sus variables y sus
 * variantes `dark:` en oscuro de forma determinista. `bg-app`/`min-h` evitan
 * cualquier destello del fondo claro del <body> alrededor de la card.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="dark min-h-[100dvh] bg-app text-fg">{children}</div>;
}
