import Link from 'next/link';

/** Color propio de las flashcards: el mismo en el menú, en los botones y en el mazo. */
export const COLOR_FLASHCARD = '#8B5CF6';

/**
 * Dibujo de una flashcard: dos tarjetas apiladas, la de delante con un signo
 * de pregunta. Es lo que hace reconocible el botón sin leer el texto.
 */
export function IconoFlashcard({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {/* tarjeta de atrás, ladeada */}
      <rect x="6.5" y="3" width="13" height="16" rx="2.5" transform="rotate(9 13 11)" opacity={0.55} />
      {/* tarjeta de delante */}
      <rect x="3.5" y="5" width="13" height="16" rx="2.5" fill="currentColor" fillOpacity={0.18} />
      {/* signo de pregunta */}
      <path d="M8 11.2a2.1 2.1 0 1 1 3.2 1.8c-.7.45-1.2.9-1.2 1.7" />
      <path d="M10 17.4h.01" />
    </svg>
  );
}

/**
 * Botón de flashcards. Siempre igual: la tarjetita, la palabra «Flashcards» y,
 * debajo, para qué sirve. `compacto` es la versión de una sola línea.
 */
export function BotonFlashcards({ href, detalle = 'Repasa con tarjetas antes de practicar', compacto = false, className = '' }: {
  href: string; detalle?: string; compacto?: boolean; className?: string;
}) {
  if (compacto) {
    return (
      <Link href={href} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition hover:-translate-y-0.5 hover:shadow-md ${className}`}
        style={{ color: COLOR_FLASHCARD, borderColor: `${COLOR_FLASHCARD}73`, backgroundColor: `${COLOR_FLASHCARD}1A` }}>
        <IconoFlashcard className="h-4 w-4" /> Flashcards
      </Link>
    );
  }
  return (
    <Link href={href} aria-label={`Flashcards: ${detalle}`}
      className={`group inline-flex items-center gap-3 rounded-2xl border-2 py-2 pl-2 pr-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${className}`}
      style={{ borderColor: `${COLOR_FLASHCARD}80`, backgroundColor: `${COLOR_FLASHCARD}14` }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white transition group-hover:rotate-[-6deg]" style={{ backgroundColor: COLOR_FLASHCARD }}>
        <IconoFlashcard className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold leading-tight" style={{ color: COLOR_FLASHCARD }}>Flashcards</span>
        <span className="block text-xs leading-tight text-muted">{detalle}</span>
      </span>
    </Link>
  );
}
