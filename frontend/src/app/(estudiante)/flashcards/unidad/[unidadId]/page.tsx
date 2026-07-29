'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { MazoLoader } from '@/components/flashcards/mazo-loader';

/** Mazo de flashcards de toda una UNIDAD (repaso libre). No puntúa ni afecta al θ. */
export default function FlashcardsUnidadPage() {
  const params = useParams();
  const search = useSearchParams();
  const unidadId = String(params.unidadId);
  const volver = search.get('volver') || `/ejercicios/unidad/${unidadId}`;
  return <MazoLoader tipo="unidad" id={unidadId} volverHref={volver} />;
}
