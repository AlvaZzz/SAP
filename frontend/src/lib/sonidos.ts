/**
 * SONIDOS de gamificación — SINTETIZADOS con la Web Audio API.
 *
 * No se descarga ni se incluye ningún archivo de audio: cada sonido se genera en
 * el navegador con osciladores, por lo que está LIBRE DE DERECHOS por
 * construcción (no hay obra de terceros). Son cortos (<1.5 s), suaves y a
 * volumen moderado (pensados para un aula).
 *
 * Todo es defensivo: si el navegador no soporta AudioContext, si está bloqueado
 * hasta la primera interacción del usuario, o si algo falla, las funciones no
 * hacen nada y la app sigue igual.
 */

export type Sonido =
  | 'emblema' | 'rango' | 'nivel' | 'acierto' | 'unidad'
  | 'click' | 'incorrecto' | 'notificacion'
  | 'flip' | 'neutro';

/** Volumen maestro bajo (~0.3): audible pero agradable, nada estridente en clase.
 *  Los sonidos FRECUENTES (click/flip/acierto) van aún más bajos (ver VOL_POR_SONIDO). */
const VOLUMEN = 0.3;

let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    // Los navegadores suspenden el audio hasta la primera interacción del usuario.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** Una nota suave (seno) con envolvente para que no "chasquee". */
function nota(ac: AudioContext, freq: number, inicio: number, dur: number, vol = VOLUMEN) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, ac.currentTime + inicio);
  // Ataque/decay suaves (evita clics) y caída exponencial natural.
  gain.gain.setValueAtTime(0.0001, ac.currentTime + inicio);
  gain.gain.exponentialRampToValueAtTime(vol, ac.currentTime + inicio + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + inicio + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + inicio);
  osc.stop(ac.currentTime + inicio + dur + 0.02);
}

/**
 * Melodías cortas por evento (frecuencias en Hz, notas de una escala mayor →
 * suenan alegres y consonantes). Duración total siempre < 1.5 s.
 */
const MELODIAS: Record<Sonido, { freq: number; t: number; d: number }[]> = {
  // Arpegio ascendente breve y brillante.
  emblema: [
    { freq: 659.25, t: 0, d: 0.12 },    // Mi5
    { freq: 783.99, t: 0.1, d: 0.12 },  // Sol5
    { freq: 1046.5, t: 0.2, d: 0.3 },   // Do6
  ],
  // Fanfarria corta (subida de rango): más "logro".
  rango: [
    { freq: 523.25, t: 0, d: 0.12 },    // Do5
    { freq: 659.25, t: 0.1, d: 0.12 },  // Mi5
    { freq: 783.99, t: 0.2, d: 0.12 },  // Sol5
    { freq: 1046.5, t: 0.32, d: 0.42 }, // Do6
  ],
  // Subida de nivel (Básico→Intermedio→Avanzado): dos notas ascendentes.
  nivel: [
    { freq: 587.33, t: 0, d: 0.12 },    // Re5
    { freq: 880.0, t: 0.11, d: 0.26 },  // La5
  ],
  // Acierto: MUY sutil (dos notas suaves y bajas de volumen).
  acierto: [
    { freq: 880.0, t: 0, d: 0.07 },
    { freq: 1174.7, t: 0.07, d: 0.12 },
  ],
  // Unidad completada: acorde arpegiado un poco más amplio.
  unidad: [
    { freq: 523.25, t: 0, d: 0.14 },
    { freq: 659.25, t: 0.12, d: 0.14 },
    { freq: 783.99, t: 0.24, d: 0.14 },
    { freq: 1046.5, t: 0.36, d: 0.2 },
    { freq: 1318.5, t: 0.5, d: 0.4 },   // Mi6
  ],
  // Click/selección de respuesta: un "tap" muy corto y suave (una sola nota).
  click: [
    { freq: 660.0, t: 0, d: 0.045 },
  ],
  // Respuesta incorrecta: DOS notas descendentes CONSONANTES (tercera mayor),
  // suaves — acompañan el "equivocarse es parte de aprender", nada estridente.
  incorrecto: [
    { freq: 392.0, t: 0, d: 0.1 },      // Sol4
    { freq: 311.13, t: 0.1, d: 0.16 },  // Mi♭4 (baja amable, no de "error")
  ],
  // Notificación de ALVARO: chime breve ascendente (dos notas, tipo campanita).
  notificacion: [
    { freq: 659.25, t: 0, d: 0.09 },    // Mi5
    { freq: 987.77, t: 0.09, d: 0.2 },  // Si5
  ],
  // Voltear una flashcard: "flip" suave (subidita rápida, casi un soplo).
  flip: [
    { freq: 523.25, t: 0, d: 0.05 },    // Do5
    { freq: 698.46, t: 0.045, d: 0.07 },// Fa5
  ],
  // Descarte NEUTRO ("Repasar"): una sola nota media, sin juicio.
  neutro: [
    { freq: 440.0, t: 0, d: 0.1 },      // La4
  ],
};

/** Volúmenes por sonido: los FRECUENTES (click/flip/acierto) van casi
 *  imperceptibles para no fatigar; el resto usa el volumen maestro (~0.3). */
const VOL_POR_SONIDO: Partial<Record<Sonido, number>> = {
  acierto: 0.1,
  click: 0.07,
  flip: 0.08,
  neutro: 0.1,
  incorrecto: 0.12,
  notificacion: 0.16,
};

/**
 * Reproduce un sonido corto. `activados` viene de la preferencia del usuario:
 * si es false, no suena nada. Nunca lanza: si el audio falla, se ignora.
 */
export function reproducir(sonido: Sonido, activados: boolean): void {
  if (!activados) return;
  const ac = contexto();
  if (!ac) return;
  try {
    const vol = VOL_POR_SONIDO[sonido] ?? VOLUMEN;
    for (const n of MELODIAS[sonido]) nota(ac, n.freq, n.t, n.d, vol);
  } catch {
    /* el audio nunca debe romper la app */
  }
}
