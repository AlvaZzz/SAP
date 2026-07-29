'use client';

import { useReducedMotion } from 'framer-motion';
import { Clock } from '@/components/icons';

/**
 * Temporizador del examen con tramos de urgencia:
 *  · neutro/acento cuando queda tiempo holgado,
 *  · ámbar cuando restan < 5 min,
 *  · rojo con latido sutil cuando resta < 1 min (respeta prefers-reduced-motion).
 * Formato mm:ss con cifras tabulares.
 */
export function ExamTimer({ seconds }: { seconds: number }) {
  const reduce = useReducedMotion();
  const mm = String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0');
  const ss = String(Math.max(0, seconds) % 60).padStart(2, '0');

  const urgencia = seconds < 60 ? 'rojo' : seconds < 300 ? 'ambar' : 'ok';
  const estilo = {
    ok: 'border-prexi-blue/25 bg-prexi-blue/10 text-prexi-blue-deep',
    ambar: 'border-amber-500/30 bg-amber-500/10 text-prexi-amber',
    rojo: 'border-red-500/35 bg-red-500/10 text-red-500',
  }[urgencia];

  return (
    <span
      role="timer"
      aria-live={urgencia === 'rojo' ? 'assertive' : 'off'}
      aria-label={`Tiempo restante ${mm} minutos ${ss} segundos`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold ${estilo} ${urgencia === 'rojo' && !reduce ? 'animate-pulse-soft' : ''}`}
    >
      <Clock className="h-4 w-4" />
      <span className="tabular-nums">{mm}:{ss}</span>
    </span>
  );
}
