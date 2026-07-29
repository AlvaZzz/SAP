'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mazo } from './mazo';
import { Skeleton } from '@/components/ui';
import { colorUnidad, NIVEL_COLOR, NIVEL_LABEL, type NivelDificultad } from '@/lib/types';
import { fetchFlashcardsTema, fetchFlashcardsUnidad, type Flashcard } from '@/lib/flashcards';
import { ChevronLeft } from '@/components/icons';

/**
 * Carga un mazo (por tema o por unidad) y lo muestra con <Mazo>. El acento se
 * resuelve por número de unidad (U1 azul … U5 rosa).
 *
 * NIVEL (regla estricta): el estudiante NO elige el nivel — no hay chips ni
 * selector. El backend entrega ÚNICAMENTE tarjetas del nivel actual del
 * estudiante en cada tema (el mismo que usa la adaptatividad), así el encabezado
 * del mazo coincide siempre con el badge de todas las tarjetas. El badge en cada
 * tarjeta es informativo. Repaso libre: no puntúa ni cambia θ.
 */
export function MazoLoader({ tipo, id, volverHref }: {
  tipo: 'tema' | 'unidad'; id: number | string; volverHref: string;
}) {
  const router = useRouter();
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [titulo, setTitulo] = useState('Repaso con flashcards');
  const [unidadNumero, setUnidadNumero] = useState(1);
  const [nivelDefecto, setNivelDefecto] = useState<NivelDificultad | null>(null);

  useEffect(() => {
    let vivo = true;
    setCards(null);
    const p = tipo === 'tema' ? fetchFlashcardsTema(id) : fetchFlashcardsUnidad(id);
    p.then((r) => {
      if (!vivo) return;
      setCards(r.flashcards);
      setNivelDefecto(r.nivel_defecto);
      if ('tema' in r && r.tema) { setTitulo(`${r.tema.numero} · ${r.tema.titulo}`); setUnidadNumero(r.tema.unidadNumero); }
      else if ('unidad' in r && r.unidad) { setTitulo(`Unidad ${r.unidad.numero}: ${r.unidad.titulo}`); setUnidadNumero(r.unidad.numero); }
    }).catch(() => { if (vivo) setCards([]); });
    return () => { vivo = false; };
  }, [tipo, id]);

  const color = colorUnidad(unidadNumero);
  // Encabezado del mazo = NIVEL DEL ESTUDIANTE (coincide con todas las tarjetas).
  // En mazos de unidad el nivel puede variar por tema → "Tu nivel" (cada tarjeta
  // igual corresponde al nivel del estudiante en SU tema).
  const nivelSesion = nivelDefecto
    ? { label: `Tu nivel: ${NIVEL_LABEL[nivelDefecto]}`, color: NIVEL_COLOR[nivelDefecto] }
    : { label: 'Tu nivel', color };

  return (
    <div className="animate-fade-up">
      <button onClick={() => router.push(volverHref)} className="btn-ghost mb-4"><ChevronLeft className="h-4 w-4" /> Volver</button>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color, backgroundColor: `${color}22` }}>Flashcards · repaso</span>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: nivelSesion.color, backgroundColor: `${nivelSesion.color}22` }}>{nivelSesion.label}</span>
      </div>

      {cards === null ? (
        <div className="mx-auto max-w-md space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-[22rem]" />
        </div>
      ) : (
        <Mazo cards={cards} color={color} titulo={titulo} scope={`${tipo}-${id}`} nivelSesion={nivelSesion}
          onSalir={() => router.push(volverHref)} />
      )}
    </div>
  );
}
