'use client';

import { useEffect, useState } from 'react';

/**
 * Devuelve `true` solo cuando la imagen `src` CARGA de verdad. Evita imágenes
 * rotas: el `<img>` renderizado en servidor dispara su evento `error` antes de
 * que React hidrate, así que `onError` no lo captura. Con este probe mostramos
 * el fallback por defecto y "ascendemos" a la imagen real cuando confirma carga.
 */
export function useImgOk(src: string): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let cancelado = false;
    const img = new Image();
    img.onload = () => { if (!cancelado && img.naturalWidth > 0) setOk(true); };
    img.src = src;
    return () => { cancelado = true; };
  }, [src]);
  return ok;
}
