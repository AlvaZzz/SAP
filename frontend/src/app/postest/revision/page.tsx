'use client';

import { RevisionRespuestas } from '@/components/revision-respuestas';

export default function PostestRevisionPage() {
  return (
    <div className="min-h-screen bg-app">
      <RevisionRespuestas endpoint="/postest/revision" titulo="Revisión de la evaluación final (postest)" volverHref="/postest/resultado" />
    </div>
  );
}
