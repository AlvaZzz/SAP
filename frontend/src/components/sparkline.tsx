'use client';

import { useId } from 'react';

/**
 * Mini-gráficos SVG del dashboard (paleta premium). Curvas suaves generadas
 * con Catmull-Rom → Bézier; sin dependencias. `suavizar` se reutiliza en el
 * gráfico grande "Tu evolución".
 */

/** Convierte puntos [x,y] en un path de curva suave (Catmull-Rom → Bézier). */
export function suavizar(p: [number, number][]): string {
  if (p.length === 0) return '';
  if (p.length === 1) return `M ${p[0][0]} ${p[0][1]}`;
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6},`
      + ` ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/**
 * Sparkline: línea suave con degradado debajo y punto final. `values` son
 * datos REALES (p. ej. XP por día); si todos son iguales dibuja una línea plana.
 */
export function Sparkline({ values, color, className = '' }: { values: number[]; color: string; className?: string }) {
  const uid = useId();
  const W = 88, H = 40;
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const rango = max - min || 1;
  const pts: [number, number][] = values.map((v, i) => [
    4 + (i * (W - 8)) / (values.length - 1),
    H - 6 - ((v - min) / rango) * (H - 14),
  ]);
  const linea = suavizar(pts);
  const gid = `sp${uid.replace(/[^a-zA-Z0-9]/g, '')}`;
  const fin = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-10 w-[88px] shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${linea} L ${fin[0]} ${H} L ${pts[0][0]} ${H} Z`} fill={`url(#${gid})`} />
      <path d={linea} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={fin[0]} cy={fin[1]} r={3} fill={color} />
    </svg>
  );
}

/** Anillo de porcentaje (dominio por unidad). */
export function Anillo({ pct, color, size = 22 }: { pct: number; color: string; size?: number }) {
  const r = 8, C = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" className="shrink-0" aria-hidden="true">
      <circle cx={11} cy={11} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={3} />
      {pct > 0 && (
        <circle cx={11} cy={11} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={`${(C * Math.min(100, pct)) / 100} ${C}`} transform="rotate(-90 11 11)" />
      )}
    </svg>
  );
}
