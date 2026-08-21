'use client';

import { motion, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';
import { Brain, Trophy, BarChart3, Code2 } from '@/components/icons';

/**
 * Tarjetas flotantes con glow alrededor del pingüino. Cada una flota de forma
 * independiente (duraciones distintas) y hace parallax ligero con el mouse.
 * `mx`/`my` son la posición normalizada del cursor (-0.5..0.5) del hero.
 */
type Tarjeta = {
  icon: 'python' | 'brain' | 'trophy' | 'chart';
  glow: string;
  pos: string;      // clases de posición absoluta
  depth: number;    // intensidad del parallax
  dur: number;      // duración del float
  delay: number;
};

// Orbitan la SILUETA del pingüino (que ocupa ~x[29%..75%], y[8%..82%] del recuadro),
// apenas rebasando su contorno; no las esquinas del panel.
const TARJETAS: Tarjeta[] = [
  { icon: 'python', glow: '#F5C542', pos: 'left-[1%] top-[5%]', depth: 26, dur: 4.2, delay: 0 },     // arriba-izq.
  { icon: 'brain', glow: '#4A90E2', pos: 'right-[2%] top-[9%]', depth: 18, dur: 5.1, delay: 0.4 },   // arriba-der.
  { icon: 'trophy', glow: '#F59E0B', pos: 'right-0 top-[44%]', depth: 22, dur: 4.7, delay: 0.8 },    // der.-centro
  { icon: 'chart', glow: '#22C55E', pos: 'left-0 bottom-[30%]', depth: 14, dur: 5.6, delay: 0.2 },   // abajo-izq.
];

const ICON_CLS = 'h-6 w-6 lg:h-7 lg:w-7';

/**
 * Marca de Python. Se usa el ícono `Code2` en el amarillo de Python y NO el
 * logo oficial de la PSF: ese logo es una marca registrada y no podemos
 * incluirlo en el repositorio sin la licencia correspondiente. Antes había una
 * referencia a `/python-logo.svg`, un archivo que nunca existió: el probe de
 * carga ocultaba el fallo en pantalla pero el navegador pedía el archivo igual
 * y devolvía 404 en cada visita al login.
 */
function Icono({ tipo, glow }: { tipo: Tarjeta['icon']; glow: string }) {
  if (tipo === 'python') return <Code2 className={ICON_CLS} style={{ color: '#F5C542' }} />;
  if (tipo === 'brain') return <Brain className={ICON_CLS} style={{ color: glow }} />;
  if (tipo === 'trophy') return <Trophy className={ICON_CLS} style={{ color: glow }} />;
  return <BarChart3 className={ICON_CLS} style={{ color: glow }} />;
}

export function FloatingIcons({ mx, my }: { mx: MotionValue<number>; my: MotionValue<number> }) {
  const reduce = useReducedMotion();
  return (
    <>
      {TARJETAS.map((t, i) => (
        <Card key={i} t={t} mx={mx} my={my} reduce={!!reduce} />
      ))}
    </>
  );
}

function Card({ t, mx, my, reduce }: { t: Tarjeta; mx: MotionValue<number>; my: MotionValue<number>; reduce: boolean }) {
  // Parallax: desplaza la tarjeta según el cursor (desactivado si reduce-motion).
  const px = useTransform(mx, (v) => (reduce ? 0 : v * t.depth));
  const py = useTransform(my, (v) => (reduce ? 0 : v * t.depth));
  return (
    <motion.div style={{ x: px, y: py }} className={`absolute ${t.pos} z-10`}>
      <motion.div
        animate={reduce ? undefined : { y: [0, -12, 0] }}
        transition={reduce ? undefined : { duration: t.dur, delay: t.delay, repeat: Infinity, ease: 'easeInOut' }}
        className="grid h-16 w-16 place-items-center rounded-2xl backdrop-blur-md sm:h-[68px] sm:w-[68px] lg:h-[78px] lg:w-[78px]"
        style={{
          // Estilo NEÓN: borde y fondo tintados del color + doble glow (externo e interno).
          border: `1.5px solid ${t.glow}`,
          backgroundColor: `${t.glow}1A`,
          boxShadow: `0 0 22px -2px ${t.glow}80, 0 0 8px -1px ${t.glow}66, inset 0 0 12px -4px ${t.glow}`,
        }}
      >
        <Icono tipo={t.icon} glow={t.glow} />
      </motion.div>
    </motion.div>
  );
}
