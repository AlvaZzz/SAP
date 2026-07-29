'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * VOZ (lectura en voz alta) con la Web Speech API del navegador —
 * SpeechSynthesis. Es GRATUITA y local: no usa ninguna API de pago ni envía el
 * texto a un tercero. Si el navegador no la soporta, `soportada` es false y la
 * UI simplemente no muestra el botón (nada se rompe).
 */

/** ¿El navegador soporta síntesis de voz? (false en SSR). */
export function vozSoportada(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Limpia el Markdown para que la voz suene natural: nada de asteriscos, acentos
 * graves ni bloques de código leídos símbolo por símbolo.
 */
export function textoParaVoz(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, '. (fragmento de código) .') // bloques de código
    .replace(/`([^`]+)`/g, '$1')                              // código en línea
    .replace(/\*\*([^*]+)\*\*/g, '$1')                        // negrita
    .replace(/^#{1,6}\s+/gm, '')                              // encabezados
    .replace(/^\s*[-•]\s+/gm, '. ')                           // viñetas
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Elige una voz en español: prefiere es-ES / es-419 / es-MX; si no, cualquier es-*. */
function elegirVoz(voces: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const es = voces.filter((v) => v.lang?.toLowerCase().startsWith('es'));
  if (!es.length) return null;
  const preferidas = ['es-es', 'es-419', 'es-mx', 'es-us'];
  for (const p of preferidas) {
    const v = es.find((x) => x.lang.toLowerCase() === p);
    if (v) return v;
  }
  return es[0];
}

/**
 * Hook de lectura en voz alta. Devuelve el estado y los controles
 * (hablar / pausar / reanudar / detener). Cancela al desmontar.
 */
export function useVoz() {
  const [soportada, setSoportada] = useState(false);
  const [hablando, setHablando] = useState(false);
  const [pausada, setPausada] = useState(false);
  const vozRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!vozSoportada()) return;
    setSoportada(true);
    // Las voces cargan de forma asíncrona en varios navegadores.
    const cargar = () => { vozRef.current = elegirVoz(window.speechSynthesis.getVoices()); };
    cargar();
    window.speechSynthesis.addEventListener('voiceschanged', cargar);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', cargar);
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    };
  }, []);

  const detener = useCallback(() => {
    if (!vozSoportada()) return;
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    setHablando(false); setPausada(false);
  }, []);

  const hablar = useCallback((texto: string) => {
    if (!vozSoportada()) return;
    const limpio = textoParaVoz(texto);
    if (!limpio) return;
    try {
      window.speechSynthesis.cancel(); // corta lo anterior antes de leer lo nuevo
      const u = new SpeechSynthesisUtterance(limpio);
      if (vozRef.current) u.voice = vozRef.current;
      u.lang = vozRef.current?.lang ?? 'es-ES';
      u.rate = 0.95; // ligeramente pausada
      u.pitch = 1;
      u.onend = () => { setHablando(false); setPausada(false); };
      u.onerror = () => { setHablando(false); setPausada(false); }; // nunca rompe
      window.speechSynthesis.speak(u);
      setHablando(true); setPausada(false);
    } catch {
      setHablando(false); setPausada(false);
    }
  }, []);

  const pausar = useCallback(() => {
    if (!vozSoportada()) return;
    try { window.speechSynthesis.pause(); setPausada(true); } catch { /* noop */ }
  }, []);

  const reanudar = useCallback(() => {
    if (!vozSoportada()) return;
    try { window.speechSynthesis.resume(); setPausada(false); } catch { /* noop */ }
  }, []);

  return { soportada, hablando, pausada, hablar, pausar, reanudar, detener };
}
