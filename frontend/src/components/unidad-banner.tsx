'use client';

import { ReactNode, useState } from 'react';

/**
 * Cabecera/módulo de una unidad para el estudiante, estilo "portada de curso":
 * la imagen (o un degradado generado con el color de la unidad) ocupa la franja
 * superior y el número + "UNIDAD n" + título + descripción van SOBRE ella, dentro
 * de un overlay que va de transparente arriba a un tinte sólido del color de la
 * unidad abajo, de modo que el texto claro se lee con buen contraste encima de la
 * imagen (no en un bloque blanco separado debajo). La tarjeta recorta la imagen
 * (`overflow-hidden`, esquinas de 16px).
 *
 * Color por unidad como TINTE del overlay: U1 azul, U2 morado, U3 cian, U4 ámbar,
 * U5 rosa (lo aporta `color`, ya resuelto por `colorUnidad`).
 *
 * Nota de derechos: si `imagenUrl` no tiene licencia clara, es preferible dejarlo
 * vacío — sin imagen se pinta un degradado generado con el color de la unidad (sin
 * obra de terceros), que también luce como "módulo".
 */
export function UnidadBanner({
  numero,
  titulo,
  descripcion,
  imagenUrl,
  color,
  footer,
}: {
  numero: number;
  titulo: string;
  descripcion?: string | null;
  imagenUrl?: string | null;
  /** Color de acento/tinte de ESTA unidad. */
  color: string;
  footer?: ReactNode;
}) {
  const [imgOk, setImgOk] = useState(true);
  const mostrarImagen = !!imagenUrl && imgOk;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
      {/* Franja superior: imagen recortada o degradado generado con el color. */}
      <div className="relative h-40 w-full sm:h-52">
        {mostrarImagen ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagenUrl!}
              alt=""
              aria-hidden
              onError={() => setImgOk(false)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Scrim oscuro para legibilidad + tinte del color de la unidad, ambos
                de transparente (arriba) a sólido (abajo). */}
            <div aria-hidden className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(3,7,18,0.82) 0%, rgba(3,7,18,0.35) 45%, rgba(3,7,18,0) 78%)' }} />
            <div aria-hidden className="absolute inset-0"
              style={{ background: `linear-gradient(to top, ${color}D9 0%, ${color}59 40%, transparent 80%)` }} />
          </>
        ) : (
          // Sin imagen: degradado diagonal generado con el color de la unidad
          // (sin obra de terceros). Igual de "portada", legible con texto claro.
          <div aria-hidden className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}C0 55%, ${color}80 100%), #0A0F1A` }} />
        )}

        {/* Contenido SOBRE la franja: número + UNIDAD n + título + descripción. */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 font-display text-lg font-extrabold text-white ring-1 ring-white/30 backdrop-blur-sm">
              {numero}
            </span>
            <div className="min-w-0">
              <p className="text-2xs font-bold uppercase tracking-wide text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">Unidad {numero}</p>
              <h1 className="font-display text-2xl font-extrabold leading-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.55)] sm:text-3xl">{titulo}</h1>
            </div>
          </div>
          {descripcion && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90 line-clamp-2 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">{descripcion}</p>
          )}
        </div>
      </div>

      {/* Cuerpo de la tarjeta (fondo neutro): progreso u otros datos. */}
      {footer && <div className="p-5 pt-4 sm:p-6 sm:pt-4">{footer}</div>}
    </section>
  );
}
