'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Brain, BookOpen, Trophy, Code2 } from '@/components/icons';
import { PrexiLogo } from './prexi-logo';
import { FloatingIcons } from './floating-icons';
import { FeatureItem } from './feature-item';
import { PenguinMascot } from './penguin-mascot';

/** Texto en gradiente (decorativo, no es el acento de acción). */
function Grad({ from, to, children }: { from: string; to: string; children: string }) {
  return (
    <span style={{ backgroundImage: `linear-gradient(90deg, ${from}, ${to})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
      {children}
    </span>
  );
}

const FEATURES = [
  { icon: Brain, title: 'IA Adaptativa', desc: 'Ejercicios según tu nivel y desempeño.', glow: '#4A90E2' },
  { icon: BookOpen, title: 'Aprendizaje Personalizado', desc: 'Ruta adaptada especialmente para ti.', glow: '#8B5CF6' },
  { icon: Trophy, title: 'Gamificación y Ranking', desc: 'Compite, gana puntos y sube de nivel.', glow: '#F59E0B' },
  { icon: Code2, title: 'Aprende Python', desc: 'Desde lo básico hasta lo avanzado.', glow: '#22C55E' },
];

export function LoginHero({ showDescription = false }: { showDescription?: boolean }) {
  // Parallax: posición del cursor normalizada (-0.5..0.5), suavizada con spring.
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 60, damping: 18 });
  const my = useSpring(rawY, { stiffness: 60, damping: 18 });

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    rawX.set((e.clientX - r.left) / r.width - 0.5);
    rawY.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { rawX.set(0); rawY.set(0); };

  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className="relative flex flex-col justify-center gap-6 pt-6 pb-0 lg:h-full lg:justify-between lg:gap-5 lg:overflow-hidden lg:py-6">

      {/* Mascota DESKTOP: absoluta, anclada al fondo y DESPLAZADA A LA DERECHA para
          que su silueta quede en la mitad derecha del panel y NO se cruce con el
          texto (el PNG tiene ~25% de aire transparente a la derecha, así que este
          desplazamiento no recorta al pingüino). Va por debajo del texto (z-0). */}
      {/* aspect-[3/4]: al ser más angosto que la imagen (3/2), `object-cover` RECORTA
          el aire transparente de los lados sin cambiar el tamaño del pingüino, y lo
          deja en la mitad derecha → el texto ya no se cruza con él. */}
      <div className="pointer-events-none absolute bottom-0 right-[2%] z-0 hidden aspect-[3/4] translate-y-[7%] xl:block"
        style={{ height: 'clamp(520px, 78vh, 860px)' }}>
        <FloatingIcons mx={mx} my={my} />
        <PenguinMascot mx={mx} my={my} />
      </div>

      {/* ── Bloque superior: logo + título + descripción ──
          El título va arriba (la mascota está anclada abajo, no llega), así que
          conserva su ancho; la descripción sí se estrecha porque queda más baja. */}
      <div className="relative z-10 flex flex-col items-center gap-6 lg:items-start lg:gap-5">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <PrexiLogo subtitle />
        </motion.div>

        {/* Título (3 líneas) — solo desktop */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="hidden max-w-xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-fg lg:block lg:max-w-[40%] lg:text-5xl xl:max-w-[40%] xl:text-[clamp(3rem,2.5vw,4rem)]">
          Aprende <Grad from="#4A90E2" to="#8FBEF0">Python</Grad><br />
          de forma inteligente,<br />
          <Grad from="#F97316" to="#FB923C">divertida</Grad> y a tu ritmo.
        </motion.h1>

        {showDescription && (
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hidden max-w-[30%] text-[15px] leading-relaxed text-muted lg:block lg:text-[17px] xl:text-lg"
          >
            Ejercicios adaptativos, retroalimentación inteligente y gamificación para llevar tus habilidades al siguiente nivel.
          </motion.p>
        )}

        {/* Mascota MÓVIL: en flujo, tamaño cómodo (no llena el alto). Solo móvil.
            `-mb-16` + `z-20` la hacen "sentarse" sobre el borde superior de la card
            (que llega justo debajo con su propio z menor). `overflow-visible` evita
            que las patas se recorten en el punto de solape. */}
        <div className="relative z-20 mx-auto -mb-24 aspect-square w-full max-w-[300px] overflow-visible lg:mb-0 lg:hidden">
          <FloatingIcons mx={mx} my={my} />
          <PenguinMascot mx={mx} my={my} />
        </div>
      </div>

      {/* ── Bloque inferior: beneficios en LISTA VERTICAL angosta — solo desktop ──
          Vertical (no 2×2) a propósito: la rejilla de 2 columnas se extendía por
          debajo de la mascota y el texto se cruzaba con ella. */}
      <div className="relative z-10 hidden flex-col gap-3 min-[2200px]:absolute min-[2200px]:bottom-[4%] min-[2200px]:left-0 min-[2200px]:flex min-[2200px]:max-w-[30%] min-[2200px]:gap-4">
        {FEATURES.map((f) => <FeatureItem key={f.title} {...f} />)}
      </div>
    </div>
  );
}
