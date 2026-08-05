/**
 * Escudos de RANGO — SVG ORIGINALES con estética de videojuego (sin copiar
 * insignias de ningún juego real). El nivel (escudo_1..6) añade laureles y
 * estrellas; el color viene del catálogo de rangos (paleta sobria).
 */
type Props = { svgKey: string; color?: string; className?: string };

const NIVEL: Record<string, number> = {
  escudo_1: 1, escudo_2: 2, escudo_3: 3, escudo_4: 4, escudo_5: 5, escudo_6: 6,
};

export function RangoIcon({ svgKey, color = '#3B82F6', className = 'h-10 w-10' }: Props) {
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

/**
 * ESCUDO DE RANGO "de vitrina" — variante ampliada de <RangoIcon> pensada para la
 * ESCALERA de rangos, donde los 6 se ven juntos y la diferencia entre ellos tiene
 * que leerse de un vistazo (como el árbol de ligas de un juego).
 *
 * Cómo escala el peso visual, sin salirse del lenguaje de PREXI (insignias de
 * desarrollador, nada de espadas ni dragones):
 *   · glifo de código propio de cada tramo: `<>` → `{}` → `>_` (terminal),
 *   · gradiente más rico y borde más marcado a mayor rango,
 *   · laureles desde el 4, nodos de circuito desde el 5, corona en el 6,
 *   · halo/glow solo en los rangos altos, para que "pesen" más.
 *
 * `bloqueado` apaga el color (gris + opacidad) y saca el candado: la escalera
 * debe leerse como una META, no como una lista plana.
 *
 * Se deja <RangoIcon> intacto: lo usan dashboard, progreso y el toast de logro.
 */
export function RangoEscudo({
  svgKey, color = '#3B82F6', bloqueado = false, className = 'h-16 w-16',
}: Props & { bloqueado?: boolean }) {
  const nivel = NIVEL[svgKey] ?? 1;
  const uid = `${svgKey}${bloqueado ? '-off' : ''}`;
  // En bloqueado todo el escudo va en gris: el color es la recompensa.
  const c = bloqueado ? '#94A3B8' : color;
  const estrellas = Math.min(3, Math.ceil(nivel / 2));
  const posX = estrellas === 1 ? [16] : estrellas === 2 ? [11, 21] : [9, 16, 23];

  return (
    <svg viewBox="0 0 32 40" className={className} aria-hidden="true"
      style={bloqueado ? { opacity: 0.55 } : undefined}>
      <defs>
        <linearGradient id={`ge-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity={bloqueado ? 0.5 : 1} />
          <stop offset="0.55" stopColor={c} stopOpacity={bloqueado ? 0.35 : 0.82} />
          <stop offset="1" stopColor={c} stopOpacity={bloqueado ? 0.25 : 0.45} />
        </linearGradient>
        {/* El halo solo existe en los rangos altos y nunca si está bloqueado. */}
        {nivel >= 5 && !bloqueado && (
          <filter id={`gl-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        )}
      </defs>

      <g filter={nivel >= 5 && !bloqueado ? `url(#gl-${uid})` : undefined}>
        {/* Laureles laterales desde el rango 4 */}
        {nivel >= 4 && (
          <g stroke={c} strokeWidth="1.4" fill="none" opacity="0.9">
            <path d="M6 14c-3 3-3 8 0 12" />
            <path d="M26 14c3 3 3 8 0 12" />
          </g>
        )}
        {/* Nodos de circuito desde el 5 (guiño a hardware/código, no a fantasía) */}
        {nivel >= 5 && (
          <g stroke={c} strokeWidth="1" opacity="0.75" fill={c}>
            <path d="M3 20h3M26 20h3" />
            <circle cx="3" cy="20" r="1.2" /><circle cx="29" cy="20" r="1.2" />
          </g>
        )}

        {/* Cuerpo del escudo */}
        <path d="M16 4l11 4v8c0 8-5 13.5-11 16C10 29.5 5 24 5 16V8z"
          fill={`url(#ge-${uid})`} stroke={c} strokeWidth={nivel >= 5 ? 2 : 1.6} strokeLinejoin="round" />
        <path d="M5 12h22" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" />

        {/* GLIFO DE CÓDIGO del tramo, centrado en el escudo */}
        <g fill="none" stroke="#fff" strokeOpacity="0.95" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round">
          {nivel <= 2 && <><path d="M13 17l-3 3 3 3" /><path d="M19 17l3 3-3 3" /></>}
          {(nivel === 3 || nivel === 4) && (
            <><path d="M14 16c-2 0-2 3-3 4 1 1 1 4 3 4" /><path d="M18 16c2 0 2 3 3 4-1 1-1 4-3 4" /></>
          )}
          {nivel >= 5 && <><path d="M11 17l3 3-3 3" /><path d="M17 23h5" /></>}
        </g>

        {/* Estrellas del rango */}
        <g fill="#fff" fillOpacity="0.92">
          {posX.map((x, i) => (
            <path key={i} transform={`translate(${x - 3} 7) scale(0.5)`}
              d="M6 0l1.6 3.5L11 4l-2.6 2.4L9 10 6 8 3 10l.6-3.6L1 4l3.4-.5z" />
          ))}
        </g>

        {/* Corona en el rango máximo */}
        {nivel >= 6 && <path d="M11 4l2 2 3-3 3 3 2-2v3h-10z" fill="#fff" fillOpacity="0.9" transform="translate(0 -2)" />}
      </g>

      {/* Candado: la meta aún no alcanzada */}
      {bloqueado && (
        <g transform="translate(21 26)">
          <rect x="0" y="4" width="9" height="7" rx="1.6" fill="#0F172A" fillOpacity="0.75" />
          <path d="M2 4V2.6a2.5 2.5 0 015 0V4" fill="none" stroke="#0F172A" strokeOpacity="0.75" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
}
