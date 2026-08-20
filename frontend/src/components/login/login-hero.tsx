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

/**
 * HERO del módulo auth (login y registro).
 *
 * REPARTO DEL ESPACIO, NO POSICIONES ABSOLUTAS. La versión anterior mezclaba
 * flujo normal con `absolute` en PORCENTAJE (mascota anclada abajo, beneficios
 * en `min-[2200px]:absolute`) y anchos de texto en `max-w-[40%]` / `max-w-[30%]`
 * afinados para esquivarla. Esos porcentajes solo cuadraban a una altura de
 * panel concreta: a 1080px el título caía sobre la lista de beneficios, y el
 * registro necesitaba replicar el contenedor del login (`h-[100svh]` + sticky)
 * para que "cayeran donde debían".
 *
 * Ahora el desktop es una REJILLA de dos pistas —texto | mascota— y todo va en
 * flujo dentro de su pista. La mascota no puede invadir el texto porque ocupa
 * otra columna, y el texto no puede solaparse consigo mismo porque es un
 * `flex-col` con `gap`. El resultado no depende del alto del panel: a 768, 900
 * o 1080px de alto la única diferencia es cuánto respira la columna.
 *
 * La mascota entra en `xl` (igual que antes): por debajo de 1280px su pista
 * quedaría demasiado angosta y el texto se queda con todo el ancho.
 */
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
      className="relative pb-0 pt-6 lg:grid lg:h-full lg:grid-cols-1 lg:py-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,36%)] xl:gap-x-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,38%)]">

      {/* ── PISTA 1: texto (logo → título → descripción → beneficios) ──
          Todo en flujo con `gap`: ningún elemento puede invadir al siguiente.
          `min-h-0` permite que la columna se comprima en pantallas bajas en vez
          de desbordar la pista. */}
      <div className="flex min-h-0 min-w-0 flex-col items-center gap-6 lg:items-start lg:justify-center lg:gap-5 lg:[@media(min-height:900px)]:gap-7">

        <motion.div data-hero="logo" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <PrexiLogo subtitle />
        </motion.div>

        {/* Título (3 líneas) — solo desktop. El ancho lo limita la propia pista,
            no un porcentaje del panel: `max-w-*` es solo tipográfico. */}
        <motion.h1 data-hero="titulo"
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="hidden max-w-[18ch] font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-fg lg:block lg:text-[clamp(2.25rem,3vw,3.25rem)] xl:text-[clamp(2.5rem,2.6vw,3.75rem)]">
          Aprende <Grad from="#4A90E2" to="#8FBEF0">Python</Grad><br />
          de forma inteligente,<br />
          <Grad from="#F97316" to="#FB923C">divertida</Grad> y a tu ritmo.
        </motion.h1>

        {showDescription && (
          <motion.p data-hero="descripcion"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hidden max-w-[46ch] text-[15px] leading-relaxed text-muted lg:block lg:text-base xl:text-[17px]"
          >
            Ejercicios adaptativos, retroalimentación inteligente y gamificación para llevar tus habilidades al siguiente nivel.
          </motion.p>
        )}

        {/* Beneficios — en FLUJO dentro de la pista de texto (antes: `absolute`
            a partir de 2200px, que a alturas normales caía sobre el título).
            Se ocultan por debajo de 780px de alto: ahí no caben sin apretar el
            resto, y es preferible perder el adorno que comprimir el título. */}
        <div data-hero="beneficios" className="hidden w-full max-w-[42ch] flex-col gap-3 [@media(min-width:1024px)_and_(min-height:780px)]:flex lg:[@media(min-height:900px)]:gap-4">
          {FEATURES.map((f) => <FeatureItem key={f.title} {...f} />)}
        </div>

        {/* Mascota MÓVIL: en flujo, tamaño cómodo (no llena el alto). Solo móvil.
            `-mb-24` + `z-20` la hacen "sentarse" sobre el borde superior de la
            card (que llega justo debajo con su propio z menor).
            `overflow-visible` evita que las patas se recorten en el solape. */}
        <div className="relative z-20 mx-auto -mb-24 aspect-square w-full max-w-[300px] overflow-visible lg:mb-0 lg:hidden">
          <FloatingIcons mx={mx} my={my} />
          <PenguinMascot mx={mx} my={my} />
        </div>
      </div>

      {/* ── PISTA 2: mascota (solo xl+) ──
          Su propia columna de la rejilla: por construcción no puede cruzarse con
          el texto, sin importar el alto del panel. `object-bottom` (en
          PenguinMascot) la mantiene apoyada abajo cuando la pista es más alta
          que ancha, y `overflow-hidden` recorta el aire sobrante del PNG. */}
      <div data-hero="mascota" className="pointer-events-none relative z-0 hidden min-h-0 self-end overflow-hidden xl:block"
        style={{ height: 'min(100%, 860px)', aspectRatio: '3 / 4', marginInlineStart: 'auto' }}>
        <FloatingIcons mx={mx} my={my} />
        <PenguinMascot mx={mx} my={my} />
      </div>
    </div>
  );
}
