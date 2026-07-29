import type { Config } from 'tailwindcss';

/**
 * Tema PREXI — PALETA CENTRALIZADA (único lugar de la verdad).
 *
 * Paleta AZUL PROFUNDA premium (modo oscuro con contraste real):
 *  FONDOS OSCUROS → #021024 (app, casi negro) · #04162E (panel) · #052659 (tarjetas)
 *                   · #0A3570 (superficie elevada: hover/activo) · #0E3F7E (bordes)
 *  ACENTO         → #5483B3 (claro) / #7DA0CA (oscuro) · brillante #C1E8FF (énfasis)
 *  ESTADOS        → Verde #10B981 · Ámbar #F59E0B · Rojo #EF4444 (SOLO en detalles)
 *  MODO CLARO     → fondo #F2F7FC, cards #FFFFFF, texto #021024, acento #5483B3
 *
 * - Tokens semánticos (app/card/fg/muted/line…) y el ACENTO (accent/accent-ink…)
 *   se resuelven vía CSS vars en globals.css y cambian entre claro/oscuro, para
 *   que el acento sea brillante sobre oscuro y legible sobre claro (contraste AA).
 * - Las escalas `blue/green/emerald/amber/red` de Tailwind SE REMAPEAN a rampas
 *   ancladas en estos hex: cualquier `blue-600`, `red-500`, `emerald-500`… hereda
 *   automáticamente la paleta azul profunda.
 */

// Rampas (50 → 900). El azul se ancla en el acento #3B82F6 (500).
const sobrio = {
  blue: {
    50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD', 400: '#60A5FA',
    500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF', 900: '#1E3A8A',
  },
  green: {
    50: '#E6F9F1', 100: '#C3F0DE', 200: '#8FE3C2', 300: '#52D0A2', 400: '#21BC8A',
    500: '#10B981', 600: '#0E9E6E', 700: '#0B7D57', 800: '#095F43', 900: '#064631',
  },
  amber: {
    50: '#FEF6E7', 100: '#FCEAC4', 200: '#F9D78D', 300: '#F7C255', 400: '#F7B02E',
    500: '#F59E0B', 600: '#D9850A', 700: '#A96608', 800: '#7C4B08', 900: '#593606',
  },
  red: {
    50: '#FDECEC', 100: '#FBD6D6', 200: '#F6AEAE', 300: '#F17E7E', 400: '#F26A6A',
    500: '#EF4444', 600: '#DC2626', 700: '#B01C1C', 800: '#841818', 900: '#601414',
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
        faint: 'rgb(var(--faint) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        'accent-on': 'rgb(var(--accent-on) / <alpha-value>)',
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
        // Identidad de marca + estados. El ACENTO se resuelve por CSS var
        // (accent/accent-hover/accent-ink) → brillante sobre oscuro, legible sobre claro.
        prexi: {
          navy: '#052659',        // superficie profunda: banners/gradientes premium
          'navy-deep': '#021024', // base casi negra: sidebar/paneles y texto sobre acento
          'navy-soft': '#0A3570', // superficie elevada (gradientes, tintes)
          blue: 'rgb(var(--accent) / <alpha-value>)',       // acento único (#4A90E2): botones, activo, links, barras
          'blue-hover': 'rgb(var(--accent-hover) / <alpha-value>)', // hover (#3B7FD4)
          'blue-pressed': 'rgb(var(--accent-pressed) / <alpha-value>)', // pressed (#2E6FC0)
          'blue-soft': '#D3E6FA', // fondo de badge informativo (modo claro)
          'blue-deep': 'rgb(var(--accent-ink) / <alpha-value>)',    // acento de énfasis (texto/íconos)
          amber: '#F59E0B',       // en progreso, racha, atención
          green: '#10B981',       // completado/correcto
          'green-soft': '#C3F0DE',
          red: '#EF4444',         // incorrecto/error
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      borderRadius: { card: '16px' },
      boxShadow: {
        // Sombras casi negras: profundas y suaves para que las tarjetas "floten"
        // sobre el fondo casi negro (#060910) sin ensuciar el modo claro.
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.28), 0 4px 12px -2px rgb(0 0 0 / 0.30)',
        lift: '0 20px 50px -20px rgb(0 0 0 / 0.65)',
        // Glow del acento (botón primario, foco, sidebar activo).
        glow: '0 8px 26px -8px rgb(var(--glow) / 0.55)',
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
