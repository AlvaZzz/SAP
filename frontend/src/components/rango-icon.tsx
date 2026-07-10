/**
 * Escudos de RANGO — SVG ORIGINALES con estética de videojuego (sin copiar
 * insignias de ningún juego real). El nivel (escudo_1..6) añade laureles y
 * estrellas; el color viene del catálogo de rangos (paleta sobria).
 */
type Props = { svgKey: string; color?: string; className?: string };

const NIVEL: Record<string, number> = {
  escudo_1: 1, escudo_2: 2, escudo_3: 3, escudo_4: 4, escudo_5: 5, escudo_6: 6,
};

export function RangoIcon({ svgKey, color = '#3B6291', className = 'h-10 w-10' }: Props) {
  const nivel = NIVEL[svgKey] ?? 1;
  // Estrellas que se muestran dentro del escudo según el rango.
  const estrellas = Math.min(3, Math.ceil(nivel / 2));
  const posX = estrellas === 1 ? [16] : estrellas === 2 ? [11, 21] : [9, 16, 23];

  return (
    <svg viewBox="0 0 32 36" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`g-${svgKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Laureles laterales a partir del rango 4 */}
      {nivel >= 4 && (
        <g stroke={color} strokeWidth="1.4" fill="none" opacity="0.9">
          <path d="M6 12c-3 3-3 8 0 12" />
          <path d="M26 12c3 3 3 8 0 12" />
        </g>
      )}
      {/* Cuerpo del escudo */}
      <path d="M16 2l11 4v8c0 8-5 13.5-11 16C10 27.5 5 22 5 14V6z"
        fill={`url(#g-${svgKey})`} stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      {/* Banda superior */}
      <path d="M5 10h22" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" />
      {/* Estrellas del rango */}
      <g fill="#fff" fillOpacity="0.92">
        {posX.map((x, i) => (
          <path key={i} transform={`translate(${x - 3} 13) scale(0.5)`}
            d="M6 0l1.6 3.5L11 4l-2.6 2.4L9 10 6 8 3 10l.6-3.6L1 4l3.4-.5z" />
        ))}
      </g>
      {/* Corona pequeña en el rango máximo */}
      {nivel >= 6 && <path d="M11 5l2 2 3-3 3 3 2-2v3h-10z" fill="#fff" fillOpacity="0.9" transform="translate(0 -3)" />}
    </svg>
  );
}
