'use client';

import Image from 'next/image';
import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';

/**
 * Mascota (pingüino) del hero del login. LLENA a su contenedor (`h-full w-full`)
 * con `object-contain object-bottom`, de modo que el padre controla tamaño y
 * posición (p. ej. anclada al fondo del panel en desktop).
 *
 * ⚠️ AJUSTAR ruta si cambia el archivo de /public. `pinguino.png` es TRANSPARENTE
 * (sirve en claro y oscuro) y NO trae iconos horneados → las tarjetas flotantes
 * (Python/IA/Trofeo/Gráfica) van aparte (`FloatingIcons`). Una sola imagen para
 * ambos temas → sin parpadeo ni hydration mismatch al alternar tema.
 * El pingüino ocupa ~y[8%..82%] de la imagen (18% de aire transparente abajo):
 * el padre lo compensa con un desplazamiento para "tocar" el fondo.
 */
const PENGUIN = '/pinguino.png';

export function PenguinMascot({ mx, my }: { mx: MotionValue<number>; my: MotionValue<number> }) {
  const reduce = useReducedMotion();

  // Parallax: la mascota se mueve MUY poco (±10px), en contra del cursor.
  const px = useTransform(mx, (v) => (reduce ? 0 : -v * 10));
  const py = useTransform(my, (v) => (reduce ? 0 : -v * 10));

  return (
    <motion.div
      style={{ x: px, y: py }}
      initial={{ opacity: 0, y: reduce ? 0 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.28, ease: 'easeOut' }}
      className="absolute inset-0"
    >
      {/* Base/anillo de luz azul bajo la mascota (capa detrás, no sombra sobre el PNG) */}
      <div aria-hidden className="absolute inset-x-[18%] bottom-[16%] -z-10 h-[14%] rounded-[50%] opacity-80 blur-2xl"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(74,144,226,0.55), transparent 70%)' }} />
      <div aria-hidden className="absolute inset-x-[10%] bottom-[10%] -z-10 h-[55%] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle at 50% 60%, rgba(74,144,226,0.22), transparent 70%)' }} />

      {/* Float infinito sutil (respeta prefers-reduced-motion) */}
      <motion.div
        className="h-full w-full"
        animate={reduce ? undefined : { y: [0, -7, 0] }}
        transition={reduce ? undefined : { duration: 5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      >
        {/* Sin probe de carga: `pinguino.png` existe y `npm run validar` lo
            comprueba. El probe anterior anulaba `priority` —la imagen no se
            montaba hasta después de hidratar— y provocaba un salto visible del
            ícono de reserva a la mascota en cada visita al login. */}
        <Image
          src={PENGUIN} alt="Mascota de PREXI programando en Python"
          width={1536} height={1024} priority
          sizes="(max-width: 1024px) 340px, 55vw"
          className="h-full w-full select-none object-cover object-bottom"
          style={{ pointerEvents: 'none' }}
        />
      </motion.div>
    </motion.div>
  );
}
