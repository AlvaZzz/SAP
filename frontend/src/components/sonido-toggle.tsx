'use client';

import { useAuth } from '@/providers/auth-provider';
import { reproducir } from '@/lib/sonidos';
import { Volume2, VolumeX } from '@/components/icons';

/**
 * Interruptor de SONIDOS de gamificación (topbar). Por defecto están activados,
 * pero silenciarlos es un clic (contexto de aula). La preferencia se persiste
 * por usuario en el backend. Al activarlos suena una nota corta de confirmación.
 */
export function SonidoToggle() {
  const { usuario, guardarAudio } = useAuth();
  if (!usuario) return null;
  const activos = usuario.sonidosActivados ?? true;

  return (
    <button
      onClick={() => {
        const nuevo = !activos;
        // Confirmación audible SOLO al encender (al apagar, silencio).
        if (nuevo) reproducir('acierto', true);
        void guardarAudio({ sonidosActivados: nuevo });
      }}
      title={activos ? 'Sonidos activados — clic para silenciar' : 'Sonidos silenciados — clic para activar'}
      aria-label={activos ? 'Silenciar sonidos' : 'Activar sonidos'}
      aria-pressed={activos}
      className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-subtle hover:text-fg"
    >
      {activos ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
    </button>
  );
}
