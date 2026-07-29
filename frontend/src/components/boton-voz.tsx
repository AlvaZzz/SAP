'use client';

import { useVoz } from '@/lib/voz';
import { Volume2, Pause, Play, Square } from '@/components/icons';

/**
 * Botón para ESCUCHAR un texto con la voz del navegador (Web Speech API,
 * gratuita). Muestra controles de pausa/reanudar y detener mientras habla.
 * Si el navegador NO soporta síntesis de voz, no renderiza nada (sin romper).
 *
 * `variante`:
 *  · "icono"  → un solo botón compacto (junto a cada respuesta de ALVARO).
 *  · "boton"  → botón con etiqueta "Escuchar" (introducciones/repasos).
 */
export function BotonVoz({ texto, variante = 'icono', className = '' }: {
  texto: string; variante?: 'icono' | 'boton'; className?: string;
}) {
  const { soportada, hablando, pausada, hablar, pausar, reanudar, detener } = useVoz();
  if (!soportada || !texto.trim()) return null;

  // Mientras habla: controles pausa/reanudar + detener.
  if (hablando) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <button onClick={pausada ? reanudar : pausar}
          aria-label={pausada ? 'Reanudar lectura' : 'Pausar lectura'}
          title={pausada ? 'Reanudar' : 'Pausar'}
          className="grid h-7 w-7 place-items-center rounded-lg text-prexi-blue-deep transition hover:bg-prexi-blue/15">
          {pausada ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
        <button onClick={detener} aria-label="Detener lectura" title="Detener"
          className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-prexi-red">
          <Square className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  if (variante === 'boton') {
    return (
      <button onClick={() => hablar(texto)} className={`btn-ghost !py-2 text-sm ${className}`}>
        <Volume2 className="h-4 w-4" /> Escuchar
      </button>
    );
  }

  return (
    <button onClick={() => hablar(texto)} aria-label="Escuchar esta respuesta" title="Escuchar"
      className={`grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-prexi-blue/15 hover:text-prexi-blue-deep ${className}`}>
      <Volume2 className="h-3.5 w-3.5" />
    </button>
  );
}
