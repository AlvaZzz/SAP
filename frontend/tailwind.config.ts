import type { Config } from 'tailwindcss';

/**
 * Tema PREXI — PALETA CENTRALIZADA (único lugar de la verdad).
 *
 * Paleta SOBRIA de producción (dashboard corporativo/académico, sin tonos vibrantes):
 *  BASE OSCURA  → #0F1B2D (sidebar/paneles) · #1B2B44 (superficies oscuras elevadas)
 *  ACENTO       → #2C4A6E (elementos activos) · #3B6291 (hover, detalles)
 *  ESTADOS      → Verde sobrio #2E7D5B (correcto) · Ámbar apagado #B5822E (alerta)
 *                 · Rojo terracota #B04A44 (error)
 *  MODO CLARO   → fondo #F4F6F8, cards #FFFFFF, bordes #E3E8EF, texto #1B2B44/#64748B
 *
 * - Los tokens semánticos (app/card/fg/muted/line…) se resuelven vía CSS vars
 *   en globals.css y cambian entre modo claro/oscuro.
 * - Las escalas `blue/green/emerald/amber/red` de Tailwind SE REMAPEAN a rampas
 *   desaturadas ancladas en estos hex: cualquier utilidad `blue-600`, `red-500`,
 *   `emerald-500`… del código hereda automáticamente el tono sobrio.
 */

// Rampas desaturadas (50 → 900). El tono "ancla" pedido queda en 500/600.
const sobrio = {
  blue: {
    50: '#F0F4F8', 100: '#DCE5EF', 200: '#C0D0E2', 300: '#93AECB', 400: '#5F84AC',
    500: '#3B6291', 600: '#2C4A6E', 700: '#243C5A', 800: '#1B2B44', 900: '#0F1B2D',
  },
  green: {
    50: '#EDF5F0', 100: '#D7E9DF', 200: '#B2D4C2', 300: '#85B9A0', 400: '#559B7D',
    500: '#3B8A68', 600: '#2E7D5B', 700: '#26654A', 800: '#1F4F3B', 900: '#173C2D',
  },
  amber: {
    50: '#F9F4EA', 100: '#F1E5CC', 200: '#E3CD9C', 300: '#D3B26B', 400: '#C49A47',
    500: '#B5822E', 600: '#9C6F26', 700: '#7E5920', 800: '#64461B', 900: '#4C3514',
  },
  red: {
    50: '#F8EEED', 100: '#F0DAD8', 200: '#E0B6B2', 300: '#CE8D87', 400: '#BF6A62',
    500: '#B04A44', 600: '#963E39', 700: '#7A322E', 800: '#5F2724', 900: '#481E1B',
  },
};

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tokens semánticos (light/dark) — resueltos vía CSS vars (tripletas RGB).
        app: 'rgb(var(--app) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        // Escalas remapeadas: sobrescriben las vibrantes de Tailwind en todo el código.
        blue: sobrio.blue,
        green: sobrio.green,
        emerald: sobrio.green, // emerald-* usado en el código → mismo verde sobrio
        amber: sobrio.amber,
        yellow: sobrio.amber,
        orange: sobrio.amber,
        red: sobrio.red,
        rose: sobrio.red,
        sky: sobrio.blue,
        indigo: sobrio.blue,
        violet: sobrio.blue,
        // Identidad de marca + estados.
        prexi: {
          navy: '#1B2B44',        // primario: headers, botón primario, banners
          'navy-deep': '#0F1B2D', // base oscura: sidebar/paneles
          'navy-soft': '#2C4A6E', // tinte navy (gradientes, badges informativos)
          blue: '#2C4A6E',        // acento sobrio: activo, links, barras, XP
          'blue-hover': '#3B6291',// hover, detalles
          'blue-soft': '#DCE5EF', // fondos de badges informativos
          'blue-deep': '#24466B', // acento legible como texto pequeño sobre claro
          amber: '#B5822E',       // alertas suaves, racha, logros (apagado)
          green: '#2E7D5B',       // completado/correcto (sobrio)
          'green-soft': '#D7E9DF',
          red: '#B04A44',         // errores (terracota)
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: { card: '16px' },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        lift: '0 12px 32px -14px rgb(15 23 42 / 0.22)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-5px)' }, '75%': { transform: 'translateX(5px)' } },
        'pulse-soft': { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        'grow-x': { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        'fade-in': 'fade-in 0.5s ease-out both',
        shake: 'shake 0.4s ease-in-out',
        'pulse-soft': 'pulse-soft 1.5s ease-in-out infinite',
        'grow-x': 'grow-x 0.8s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
