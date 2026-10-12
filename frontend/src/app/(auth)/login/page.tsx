'use client';

import { LoginHero } from '@/components/login/login-hero';
import { LoginForm } from '@/components/login/login-form';

/**
 * PÁGINA DE LOGIN (módulo auth) — 2 columnas a pantalla completa, SIN aire muerto.
 * Desktop: `h-screen` sin scroll, izquierda 58% (hero con la mascota llenando el
 * alto), derecha 42% (form centrado), footer a sangre completa abajo. Móvil: una
 * columna en flujo normal (logo + mascota + form) con scroll. Auth REAL de PREXI.
 */

/**
 * Fondo de circuitos muy sutil (marca). El recurso vive en
 * `public/prexi-circuits.svg` y su existencia la verifica `npm run validar`
 * (comprobación de recursos estáticos), así que ya NO se envuelve en un probe
 * de carga: hacerlo solo retrasaba el fondo hasta después de la hidratación.
 */
function Circuits() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/prexi-circuits.svg" alt="" aria-hidden
    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.06] dark:opacity-[0.12]" />;
}

export default function LoginPage() {
  return (
    // `lg:overflow-y-auto`: en pantallas normales el contenido cabe y NO hay scroll;
    // en monitores muy bajos permite desplazar en vez de recortar el footer.
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-app text-fg lg:h-screen lg:overflow-y-auto">
      {/* Fondo: circuitos apenas perceptibles + halo azul + blob morado. Al ser esta
          pantalla SIEMPRE oscura, ambos halos se muestran sin condicionar por tema. */}
      <Circuits />
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(74,144,226,0.16),transparent_70%)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.16),transparent_70%)] blur-3xl" />

      {/* Zona principal (crece para llenar el alto) */}
      <div className="relative z-10 flex w-full flex-1 flex-col px-4 sm:px-6 lg:flex-row lg:px-0">
        {/* En móvil el hero va por ENCIMA (z-20) para que el pingüino "se siente"
            sobre la card; en desktop vuelve al flujo normal (lg:z-auto). */}
        <div className="relative z-20 lg:z-auto lg:w-[57%] lg:pl-10 xl:pl-14 2xl:pl-16">
          <LoginHero />
        </div>
        <div className="relative z-10 flex items-center justify-center pb-8 pt-2 sm:pb-10 lg:w-[43%] lg:justify-center lg:px-8 lg:py-8 xl:px-12 2xl:px-16">
          <LoginForm />
        </div>
      </div>

      {/* Footer a sangre completa, anclado abajo — solo desktop */}
      <footer className="relative z-10 hidden shrink-0 border-t border-line/60 px-8 py-4 lg:block lg:px-8 xl:px-10">
        <div className="flex w-full items-center justify-between text-xs text-muted">
          <span>© {new Date().getFullYear()} PREXI. Todos los derechos reservados.</span>
          <span className="flex items-center gap-5">
            <span className="cursor-default transition hover:text-fg">Términos de uso</span>
            <span className="cursor-default transition hover:text-fg">Privacidad</span>
            <span className="cursor-default transition hover:text-fg">Soporte</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
