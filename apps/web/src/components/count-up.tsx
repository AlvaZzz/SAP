'use client';

import { useEffect, useRef, useState } from 'react';

/** Anima un número de 0 hasta `value` con easing. */
export function CountUp({ value, duration = 900, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const [n, setN] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    const inicio = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - inicio) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(value * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, duration]);

  return <>{format ? format(n) : n.toLocaleString()}</>;
}
