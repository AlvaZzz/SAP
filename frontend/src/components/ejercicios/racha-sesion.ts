'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * RACHA DE SESIÓN dentro de un tema (aciertos y fallos CONSECUTIVOS).
 *
 * Qué arregla: la racha estaba invertida. El sistema ofrecía terminar tras
 * TRES ACIERTOS —justo cuando el estudiante va lanzado y conviene que siga— y
 * no reaccionaba a los fallos, que es cuando de verdad ayuda ofrecer una pausa
 * o un repaso. Aquí la señal es la correcta:
 *   · 3 aciertos seguidos → ANIMAR a continuar (nunca proponer terminar).
 *   · 3 fallos seguidos   → ofrecer pausa o repaso, sin obligar.
 *
 * Vive en `sessionStorage` y no en el estado de React porque cada ejercicio es
 * una NAVEGACIÓN a otra página: en memoria la racha se perdería en cada paso.
 * Por tema, para que practicar otro tema empiece de cero. Se limpia al cerrar
 * la pestaña (es una racha de sesión, no una métrica del estudio: eso ya lo
 * registran `Intento` y `PasoRuta` en el backend).
 */

/** Cuántos aciertos/fallos seguidos disparan cada mensaje. */
export const RACHA_ACIERTOS = 3;
export const RACHA_FALLOS = 3;

export interface Racha {
  aciertos: number;
  fallos: number;
}

const VACIA: Racha = { aciertos: 0, fallos: 0 };
const clave = (temaId: number | null | undefined) => `prexi_racha_tema_${temaId ?? 'sin-tema'}`;

function leer(k: string): Racha {
  if (typeof window === 'undefined') return VACIA;
  try {
    const cruda = window.sessionStorage.getItem(k);
    if (!cruda) return VACIA;
    const v = JSON.parse(cruda) as Partial<Racha>;
    return { aciertos: Number(v.aciertos) || 0, fallos: Number(v.fallos) || 0 };
  } catch {
    return VACIA; // sessionStorage inaccesible (modo privado, permisos) → racha neutra
  }
}

function escribir(k: string, r: Racha) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(k, JSON.stringify(r));
  } catch {
    /* sin persistencia: la racha simplemente no sobrevive al cambio de página */
  }
}

export function useRachaSesion(temaId: number | null | undefined) {
  const k = clave(temaId);
  const [racha, setRacha] = useState<Racha>(VACIA);

  // La lectura va en un efecto (y no en el inicializador de useState) para que
  // el HTML del servidor y el del cliente coincidan: sessionStorage no existe
  // durante el renderizado en servidor y provocaría un desajuste de hidratación.
  useEffect(() => { setRacha(leer(k)); }, [k]);

  /** Registra el resultado de un intento. Acertar borra los fallos y viceversa. */
  const registrar = useCallback((correcto: boolean) => {
    setRacha((prev) => {
      const siguiente = correcto
        ? { aciertos: prev.aciertos + 1, fallos: 0 }
        : { aciertos: 0, fallos: prev.fallos + 1 };
      escribir(k, siguiente);
      return siguiente;
    });
  }, [k]);

  /** Vuelve a empezar (tras aceptar una pausa o un repaso). */
  const reiniciar = useCallback(() => {
    escribir(k, VACIA);
    setRacha(VACIA);
  }, [k]);

  return {
    racha,
    registrar,
    reiniciar,
    /** Va lanzado: hay que animarlo a SEGUIR, no a terminar. */
    enRacha: racha.aciertos > 0 && racha.aciertos % RACHA_ACIERTOS === 0,
    /** Se está atascando: aquí sí se ofrece pausa o repaso. */
    atascado: racha.fallos >= RACHA_FALLOS,
  };
}
