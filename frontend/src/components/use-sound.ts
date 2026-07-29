'use client';

import { useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { reproducir } from '@/lib/sonidos';

/**
 * useSound — "SoundManager" del módulo de ejercicios. Expone funciones cortas de
 * feedback auditivo que ya respetan la preferencia global de sonido del usuario
 * (`usuario.sonidosActivados`, conmutada desde el altavoz de la barra superior) y
 * la política de autoplay del navegador (los sonidos sólo se sintetizan como
 * respuesta a una interacción, nunca al cargar la página).
 *
 * Los sonidos se GENERAN con la Web Audio API (ver `lib/sonidos.ts`): no hay
 * archivos de terceros → libres de derechos por construcción. Son un COMPLEMENTO:
 * acertar/fallar se sigue indicando visualmente (verde/rojo), y si el usuario
 * silenció, no suena nada.
 */
export function useSound() {
  const { usuario } = useAuth();
  const on = usuario?.sonidosActivados ?? true;

  return {
    /** Tap suave al pulsar un botón / elegir una opción. */
    playClick: useCallback(() => reproducir('click', on), [on]),
    /** Tono positivo corto al acertar (o "Ya la sé" en flashcards). */
    playCorrect: useCallback(() => reproducir('acierto', on), [on]),
    /** Tono neutro y amable al fallar (no estridente). */
    playWrong: useCallback(() => reproducir('incorrecto', on), [on]),
    /** Chime suave cuando aparece un mensaje de ALVARO. */
    playNotify: useCallback(() => reproducir('notificacion', on), [on]),
    /** Celebración corta al conseguir un emblema/medalla. */
    playBadge: useCallback(() => reproducir('emblema', on), [on]),
    /** "Flip" suave al voltear una flashcard. */
    playFlip: useCallback(() => reproducir('flip', on), [on]),
    /** Descarte neutro ("Repasar" en flashcards). */
    playNeutral: useCallback(() => reproducir('neutro', on), [on]),
    /** Logro corto al completar un mazo. */
    playFinish: useCallback(() => reproducir('nivel', on), [on]),
  };
}
