'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Zap } from '@/components/icons';

/**
 * XP EN JUEGO — cuánto vale ESTE ejercicio para el estudiante ahora mismo.
 *
 * Cada pista de PREXI resta XP (regla del servidor, Tabla 46 de la tesis). Para
 * que eso se SIENTA y no sea una letra chica: cuando el valor baja, el número
 * cuenta hacia abajo, la insignia se sacude y cae un «−8 XP» en ámbar; el valor
 * sin pistas queda tachado al lado, para que se vea lo que costó la ayuda.
 */
export function XpEnJuego({ actual, sinPistas }: { actual: number; sinPistas: number }) {
  const reduce = useReducedMotion();
  const controles = useAnimationControls();
  const [mostrado, setMostrado] = useState(actual);
  const [caidas, setCaidas] = useState<{ id: number; menos: number }[]>([]);
  const previo = useRef(actual);

  useEffect(() => {
    const antes = previo.current;
    previo.current = actual;
    if (actual >= antes) { setMostrado(actual); return; }

    // Bajó: «−N XP» que cae, sacudida y cuenta regresiva del número.
    const id = Date.now();
    setCaidas((c) => [...c, { id, menos: antes - actual }]);
    setTimeout(() => setCaidas((c) => c.filter((x) => x.id !== id)), 1600);
    if (reduce) { setMostrado(actual); return; }
    controles.start({ x: [0, -5, 5, -3, 3, 0], transition: { duration: 0.45 } });
    let n = antes;
    const paso = setInterval(() => {
      n -= 1;
      setMostrado(n);
      if (n <= actual) clearInterval(paso);
    }, Math.max(25, 500 / (antes - actual)));
    return () => clearInterval(paso);
  }, [actual, reduce, controles]);

  const conDescuento = actual < sinPistas;
  return (
    <span className="relative inline-flex items-center">
      <motion.span animate={controles}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-bold transition-colors ${
          conDescuento ? 'bg-prexi-amber/15 text-amber-700 dark:text-amber-300' : 'bg-prexi-green/10 text-prexi-green'}`}
        title={conDescuento ? `Valía ${sinPistas} XP; las pistas le restaron ${sinPistas - actual}` : 'XP que ganas si aciertas (sin contar tu racha)'}>
        <Zap className="h-3.5 w-3.5" />
        Vale {mostrado} XP
        {conDescuento && <span className="ml-0.5 font-semibold line-through opacity-60">{sinPistas}</span>}
      </motion.span>
      <AnimatePresence>
        {caidas.map((c) => (
          <motion.span key={c.id}
            initial={{ opacity: 0, y: -4, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], y: [-4, 6, 18, 30], scale: [0.8, 1.15, 1, 1] }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap font-display text-sm font-extrabold text-prexi-amber"
            aria-live="polite">
            −{c.menos} XP
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}
