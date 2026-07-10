/**
 * Íconos SVG ORIGINALES de los emblemas de PREXI (dibujados a mano, sin usar
 * assets de juegos con copyright). Se colorean con `currentColor`, así el
 * contenedor decide oro (desbloqueado) o gris (bloqueado).
 */
type Props = { svgKey: string; className?: string };

const PATHS: Record<string, React.ReactNode> = {
  // Diana (primer acierto)
  diana: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.5" /><circle cx="12" cy="12" r="2" fill="currentColor" /></>,
  // Libro (tema dominado)
  libro: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z" /></>,
  // Escudo con check (sin errores)
  escudo_check: <><path d="M12 3l7 2.5v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9v-5z" /><path d="M9 12l2 2 4-4.5" fill="none" /></>,
  // Bombilla (mente brillante)
  bombilla: <><path d="M9 17h6M10 20h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2h5c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" /></>,
  // Rayo (estudiante veloz)
  rayo: <path d="M13 2L4.5 13H11l-1 9 8.5-11H12z" fill="currentColor" />,
  // Llama (racha)
  llama: <path d="M12 2c1 3-2 4-2 7a2 2 0 0 0 4 0c0-1 .8 1.5.8 3A5 5 0 0 1 7 15c0-4 5-5 5-13z" fill="none" />,
  // Doble llama (racha titán)
  llama_doble: <><path d="M9 4c.6 2-1.3 2.6-1.3 4.6a1.3 1.3 0 0 0 2.6 0c0-.6.5 1 .5 2A3.3 3.3 0 0 1 6 12c0-2.6 3-3.3 3-8z" fill="none" /><path d="M15.5 8c.6 2-1.3 2.6-1.3 4.6a1.3 1.3 0 0 0 2.6 0c0-.6.5 1 .5 2a3.3 3.3 0 0 1-4.8 1.4c0-2.6 3-3.3 3-8z" fill="none" /></>,
  // Bucle / ciclo (maestro de bucles)
  bucle: <><path d="M7 8a5 5 0 1 1-2 4" fill="none" /><path d="M5 8l2-2 2 2" fill="none" /></>,
  // Engranaje (maestro de funciones)
  engranaje: <><circle cx="12" cy="12" r="3" fill="none" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
  // Amanecer (madrugador)
  amanecer: <><path d="M3 18h18M6 18a6 6 0 0 1 12 0" fill="none" /><path d="M12 3v3M4 9l2 1M20 9l-2 1" /></>,
  // Luna (nocturno)
  luna: <path d="M20 14a8 8 0 1 1-9-11 6.5 6.5 0 0 0 9 11z" fill="none" />,
  // Diamante (perfeccionista)
  diamante: <path d="M6 3h12l3 5-9 13L3 8z" fill="none" />,
  // Corona (unidad conquistada)
  corona: <path d="M4 8l3 3 5-6 5 6 3-3v9H4z" fill="none" />,
  // Estrella (top 5)
  estrella: <path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z" fill="none" />,
  // Escudo con espadas (centurión)
  escudo_espadas: <><path d="M12 3l7 2.5v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9v-5z" fill="none" /><path d="M9 9l6 6M15 9l-6 6" /></>,
};

export function EmblemaIcon({ svgKey, className = 'h-7 w-7' }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[svgKey] ?? PATHS.estrella}
    </svg>
  );
}
