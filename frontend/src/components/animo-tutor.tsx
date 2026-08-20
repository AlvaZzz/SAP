'use client';

/**
 * Mensajes de ÁNIMO de PREXI como TARJETA DE TUTOR (no como burbuja de chat).
 *
 * El refuerzo positivo ("¡Sigue así!", "equivocarse es parte de aprender") solía
 * inyectarse en la conversación del panel del tutor, que así se llenaba de ruido
 * y enterraba las dudas reales del estudiante. Ahora sale ARRIBA, con el mismo
 * lenguaje visual que los logros/emblemas (tarjeta destacada, entrada animada,
 * auto-cierre) pero con la identidad de PREXI: su avatar y su acento azul.
 *
 * Cualquier vista lo dispara con `useAnimo().alentar('…')`. El CHAT queda solo
 * para la conversación real.
 */

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { X } from 'lucide-react';
import { TutorAvatar } from './tutor-avatar';
import { Markdown } from './markdown';
import { useLogros } from './logro-toast';
import { useSound } from './use-sound';

export type TonoAnimo = 'aliento' | 'felicitacion';

interface Animo { id: number; texto: string; tono: TonoAnimo }
interface Ctx { alentar: (texto: string, tono?: TonoAnimo) => void }

const AnimoContext = createContext<Ctx>({ alentar: () => undefined });
export const useAnimo = () => useContext(AnimoContext);

// Tiempos (ms) del ciclo de vida de la tarjeta.
const VISIBLE_MS = 6000; // algo más que un logro: aquí hay texto que leer
const SALIDA_MS = 400;   // debe coincidir con la animación animo-pop-out

export function AnimoProvider({ children }: { children: ReactNode }) {
  const { visible: logroVisible } = useLogros();
  const { playNotify } = useSound();
  const [actual, setActual] = useState<Animo | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  // Un ánimo REEMPLAZA al anterior (no se encolan): siempre interesa el más
  // reciente, no la historia — para eso ya está el chat.
  const alentar = useCallback((texto: string, tono: TonoAnimo = 'aliento') => {
    if (!texto.trim()) return;
    setSaliendo(false);
    setActual({ id: Date.now(), texto, tono });
  }, []);

  const cerrar = useCallback(() => setSaliendo(true), []);

  // Auto-cierre + chime suave de notificación al aparecer un mensaje de PREXI
  // (siempre es consecuencia de una interacción del estudiante, así que respeta
  // la política de autoplay; si silenció los sonidos, no suena nada).
  useEffect(() => {
    if (!actual) return;
    playNotify();
    const t = setTimeout(() => setSaliendo(true), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [actual, playNotify]);

  // Tras la animación de salida, desmonta.
  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(() => { setActual(null); setSaliendo(false); }, SALIDA_MS);
    return () => clearTimeout(t);
  }, [saliendo]);

  return (
    <AnimoContext.Provider value={{ alentar }}>
      {children}
      {actual && (
        // Si un logro ocupa el slot de arriba, esta tarjeta baja para no taparlo.
        <div className={`pointer-events-none fixed inset-x-0 z-[115] flex justify-center px-4 transition-[top] duration-300 ${logroVisible ? 'top-48' : 'top-20'}`}>
          <div
            key={actual.id}
            role="status"
            aria-live="polite"
            className={`${saliendo ? 'animo-out' : 'animo-pop'} pointer-events-auto relative flex w-full max-w-md items-start gap-3.5 rounded-2xl border border-prexi-blue/40 bg-card p-4 pr-10 shadow-lift`}
          >
            {/* Acento del tutor: degradado azul MUY sutil, como el de los logros en ámbar */}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: 'radial-gradient(120% 140% at 0% 0%, rgba(84,131,179,0.16), transparent 60%)' }} />
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar mensaje de PREXI"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted transition hover:bg-subtle hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative shrink-0">
              <span className="animo-halo absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(84,131,179,0.4), transparent 70%)' }} />
              <TutorAvatar estado="alentando" size={44} className="animo-bounce relative" />
            </div>
            <div className="relative min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-prexi-blue-deep">PREXI dice:</p>
              <div className="mt-0.5 text-sm leading-relaxed text-fg [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
                <Markdown content={actual.texto} />
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes animo-pop-in {
          0% { opacity: 0; transform: translateY(-24px) scale(0.94); }
          60% { transform: translateY(3px) scale(1.015); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animo-pop { animation: animo-pop-in 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes animo-pop-out {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(0.94); }
        }
        .animo-out { animation: animo-pop-out 0.4s cubic-bezier(0.4,0,1,1) both; }
        @keyframes animo-bounce {
          0%, 100% { transform: scale(1); }
          35% { transform: scale(1.1) rotate(-4deg); }
          65% { transform: scale(0.98) rotate(3deg); }
        }
        .animo-bounce { animation: animo-bounce 0.85s ease-in-out both; }
        @keyframes animo-halo { 0%,100% { opacity: 0.45; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.2); } }
        .animo-halo { animation: animo-halo 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .animo-pop, .animo-out, .animo-bounce, .animo-halo { animation: none; }
        }
      `}</style>
    </AnimoContext.Provider>
  );
}
