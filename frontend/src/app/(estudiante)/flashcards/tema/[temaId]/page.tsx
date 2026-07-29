'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { MazoLoader } from '@/components/flashcards/mazo-loader';

/** Mazo de flashcards de un TEMA (repaso libre). No puntúa ni afecta al θ. */
export default function FlashcardsTemaPage() {
  const params = useParams();
  const search = useSearchParams();
  const temaId = String(params.temaId);
  // `volver` permite regresar a la vista de origen (unidad, diagnóstico, etc.).
  const volver = search.get('volver') || '/ejercicios';
  return <MazoLoader tipo="tema" id={temaId} volverHref={volver} />;
}
