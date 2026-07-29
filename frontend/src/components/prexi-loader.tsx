'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PrexiLogo } from './login/prexi-logo';

/**
 * Pantalla de carga (splash) de PREXI. Pensada para `app/loading.tsx` (fallback
 * de Suspense) — NO añade retraso artificial: se muestra solo mientras la app
 * carga y React la retira al estar lista.
 *
 * ⚠️ AJUSTAR: usa la mascota "limpia" (sin iconos) `/pinguino.png`, exclusiva del
 * loader. Fondo por tokens (claro/oscuro). Respeta `prefers-reduced-motion`.
 */
const MASCOTA = '/pinguino.png';
const FRASES = [
  'Preparando tu ruta de aprendizaje…',
  'Cargando tus ejercicios…',
  'Ajustando la dificultad a tu nivel…',
];

export function PrexiLoader() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduce) return; // sin rotación si el usuario prefiere menos movimiento
    const t = setInterval(() => setI((v) => (v + 1) % FRASES.length), 2200);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-app px-6 text-center">
      <div className="flex flex-col items-center">
        {/* Mascota + halo azul que pulsa (capa detrás, no sombra sobre el PNG) */}
        <div className="relative grid place-items-center">
          <motion.div
            aria-hidden
            className="absolute h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(74,144,226,0.35),transparent_70%)] blur-3xl"
            animate={reduce ? undefined : { scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
            transition={reduce ? undefined : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <motion.div
              animate={reduce ? undefined : { y: [0, -8, 0] }}
              transition={reduce ? undefined : { duration: 3, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            >
              <Image src={MASCOTA} alt="Mascota de PREXI" width={240} height={160} priority
                sizes="240px" className="relative z-10 h-auto w-[220px] select-none sm:w-[240px]" style={{ pointerEvents: 'none' }} />
            </motion.div>
          </motion.div>
        </div>

        {/* Wordmark */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6">
          <PrexiLogo subtitle className="justify-center" />
        </motion.div>

        {/* Barra de progreso delgada (indeterminada) con gradiente azul */}
        <div className="mt-6 h-1 w-56 overflow-hidden rounded-full bg-subtle">
          {reduce ? (
            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-prexi-blue to-blue-400" />
          ) : (
            <motion.div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-prexi-blue to-blue-400"
              animate={{ x: ['-120%', '360%'] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* Texto rotativo (sobrio, sentence case) */}
        <p className="mt-4 h-5 text-sm text-muted" aria-live="polite">{FRASES[i]}</p>
      </div>
    </div>
  );
}
