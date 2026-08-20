'use client';

/**
 * Animación de "¡Logro desbloqueado!" tipo videojuego. Un provider mantiene una
 * cola de emblemas/rangos recién obtenidos; cualquier vista los encola con
 * `useLogros().celebrar(...)` (p. ej. al resolver un ejercicio) y aquí se
 * muestran de a uno con entrada animada + confeti.
 */

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import confetti from 'canvas-confetti';
import { X } from 'lucide-react';
import { EmblemaIcon } from './emblema-icon';
import { RangoIcon } from './rango-icon';
import { useAuth } from '@/providers/auth-provider';
import { reproducir } from '@/lib/sonidos';

export interface LogroCelebracion {
  tipo: 'emblema' | 'rango';
  nombre: string;
  descripcion: string;
  svgKey: string;
  color?: string;
}

interface Ctx {
  celebrar: (items: LogroCelebracion[]) => void;
  /** Hay un logro ocupando el slot superior ahora mismo. Lo usa la tarjeta de
   *  ánimo de PREXI para colocarse DEBAJO en vez de encima (al acertar suelen
   *  dispararse los dos a la vez: emblema + felicitación del tutor). */
  visible: boolean;
}
const LogrosContext = createContext<Ctx>({ celebrar: () => undefined, visible: false });
export const useLogros = () => useContext(LogrosContext);

// Tiempos (ms) del ciclo de vida del toast.
const VISIBLE_MS = 4500; // cuánto permanece antes de auto-cerrarse
const SALIDA_MS = 400;   // debe coincidir con la animación logro-pop-out

export function LogrosProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [cola, setCola] = useState<LogroCelebracion[]>([]);
  const [actual, setActual] = useState<LogroCelebracion | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  const celebrar = useCallback((items: LogroCelebracion[]) => {
    if (items.length) setCola((c) => [...c, ...items]);
  }, []);

  const cerrar = useCallback(() => setSaliendo(true), []);

  // Saca el siguiente de la cola cuando no hay uno visible.
  useEffect(() => {
    if (actual || cola.length === 0) return;
    const [siguiente, ...resto] = cola;
    setActual(siguiente);
    setCola(resto);
  }, [actual, cola]);

  // Al mostrar un logro: confeti + SONIDO (si el usuario los tiene activados) +
  // temporizador de auto-cierre. El sonido se sintetiza (libre de derechos) y
  // nunca rompe: si el audio falla, la celebración visual sigue igual.
  useEffect(() => {
    if (!actual) return;
    setSaliendo(false);
    confetti({ particleCount: 110, spread: 75, origin: { y: 0.35 }, colors: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'] });
    reproducir(actual.tipo === 'rango' ? 'rango' : 'emblema', usuario?.sonidosActivados ?? true);
    const t = setTimeout(() => setSaliendo(true), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [actual, usuario?.sonidosActivados]);

  // Tras disparar la animación de salida, desmonta y libera la cola.
  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(() => {
      setActual(null);
      setSaliendo(false);
    }, SALIDA_MS);
    return () => clearTimeout(t);
  }, [saliendo]);

  return (
    <LogrosContext.Provider value={{ celebrar, visible: actual != null }}>
      {children}
      {actual && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-[120] flex justify-center px-4">
          <div key={actual.nombre} className={`${saliendo ? 'logro-out' : 'logro-pop'} pointer-events-auto relative flex w-full max-w-sm items-center gap-4 rounded-2xl border border-prexi-amber/40 bg-card p-4 pr-10 shadow-lift`}>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar notificación"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted transition hover:bg-subtle hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative grid h-16 w-16 shrink-0 place-items-center">
              <span className="logro-halo absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(181,130,46,0.35), transparent 70%)' }} />
              {actual.tipo === 'rango'
                ? <RangoIcon svgKey={actual.svgKey} color={actual.color} className="h-14 w-14 logro-bounce" />
                : <span className="logro-bounce text-prexi-amber"><EmblemaIcon svgKey={actual.svgKey} className="h-11 w-11" /></span>}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-prexi-amber">{actual.tipo === 'rango' ? '¡Subiste de rango!' : '¡Logro desbloqueado!'}</p>
              <p className="truncate font-display text-lg font-extrabold text-fg">{actual.nombre}</p>
              <p className="truncate text-xs text-muted">{actual.descripcion}</p>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes logro-pop-in {
          0% { opacity: 0; transform: translateY(-24px) scale(0.9); }
          60% { transform: translateY(4px) scale(1.02); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .logro-pop { animation: logro-pop-in 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes logro-pop-out {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-24px) scale(0.9); }
        }
        .logro-out { animation: logro-pop-out 0.4s cubic-bezier(0.4,0,1,1) both; }
        @keyframes logro-bounce {
          0%, 100% { transform: scale(1); }
          30% { transform: scale(1.18) rotate(-6deg); }
          60% { transform: scale(0.96) rotate(4deg); }
        }
        .logro-bounce { animation: logro-bounce 0.9s ease-in-out both; }
        @keyframes logro-halo { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.25); } }
        .logro-halo { animation: logro-halo 1.6s ease-in-out infinite; }
      `}</style>
    </LogrosContext.Provider>
  );
}
