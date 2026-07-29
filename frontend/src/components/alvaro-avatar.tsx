'use client';

/**
 * Avatar ORIGINAL de ALVARO (SVG propio, sin copyright): una carita-asistente
 * amable coherente con la paleta azul profunda. Micro-animaciones sutiles:
 *  · parpadeo periódico (siempre),
 *  · saludo/entrada al montarse,
 *  · expresión según el contexto:
 *      - "atento"    → mirada neutra, sonrisa leve (por defecto),
 *      - "pensando"  → mira arriba + burbujas de pensamiento (cuando "escribe"),
 *      - "alentando" → ojos felices ^_^ y gran sonrisa (acierto/ánimo).
 * Respeta prefers-reduced-motion (ver globals.css).
 */
export type EstadoAlvaro = 'atento' | 'pensando' | 'alentando';

export function AlvaroAvatar({ estado = 'atento', size = 44, className = '' }: {
  estado?: EstadoAlvaro; size?: number; className?: string;
}) {
  const feliz = estado === 'alentando';
  const pensando = estado === 'pensando';
  return (
    <span
      className={`alvaro-avatar relative inline-grid shrink-0 place-items-center rounded-2xl ${className}`}
      style={{ width: size, height: size, background: 'linear-gradient(150deg,#0A3570,#052659)', boxShadow: 'inset 0 0 0 1px rgba(125,160,202,.35), 0 6px 18px -8px rgba(125,160,202,.6)' }}
      aria-hidden="true"
      data-estado={estado}
    >
      <svg viewBox="0 0 40 40" width={size * 0.82} height={size * 0.82} fill="none">
        {/* antena con glow */}
        <line x1="20" y1="4.5" x2="20" y2="9" stroke="#7DA0CA" strokeWidth="1.6" strokeLinecap="round" />
        <circle className="alvaro-antena" cx="20" cy="3.6" r="2" fill="#C1E8FF" />
        {/* cabeza */}
        <rect x="7" y="9" width="26" height="22" rx="8" fill="#0E3F7E" stroke="#7DA0CA" strokeWidth="1.4" />
        {/* mejillas cuando está alentando */}
        {feliz && <>
          <circle cx="12.5" cy="23" r="2.1" fill="#7DA0CA" opacity="0.5" />
          <circle cx="27.5" cy="23" r="2.1" fill="#7DA0CA" opacity="0.5" />
        </>}
        {/* ojos: felices (^ ^) si alienta; si no, círculos que parpadean */}
        {feliz ? (
          <g stroke="#C1E8FF" strokeWidth="2" strokeLinecap="round" fill="none">
            <path d="M12 19.5q2.5 -3 5 0" />
            <path d="M23 19.5q2.5 -3 5 0" />
          </g>
        ) : (
          <g className="alvaro-ojos" fill="#C1E8FF">
            <circle cx="14.5" cy={pensando ? 17.5 : 19} r="2.2" />
            <circle cx="25.5" cy={pensando ? 17.5 : 19} r="2.2" />
          </g>
        )}
        {/* boca */}
        {feliz
          ? <path d="M15 24.5q5 4.5 10 0" stroke="#C1E8FF" strokeWidth="2" strokeLinecap="round" fill="none" />
          : pensando
            ? <circle cx="20" cy="25" r="1.7" stroke="#7DA0CA" strokeWidth="1.6" fill="none" />
            : <path d="M16.5 24.5q3.5 2.6 7 0" stroke="#7DA0CA" strokeWidth="1.8" strokeLinecap="round" fill="none" />}
      </svg>
      {/* burbujas de pensamiento */}
      {pensando && (
        <span className="absolute -right-0.5 -top-0.5 flex gap-0.5">
          <i className="alvaro-think block h-1 w-1 rounded-full bg-[#C1E8FF]" style={{ animationDelay: '0s' }} />
          <i className="alvaro-think block h-1 w-1 rounded-full bg-[#C1E8FF]" style={{ animationDelay: '.2s' }} />
          <i className="alvaro-think block h-1 w-1 rounded-full bg-[#C1E8FF]" style={{ animationDelay: '.4s' }} />
        </span>
      )}
    </span>
  );
}
