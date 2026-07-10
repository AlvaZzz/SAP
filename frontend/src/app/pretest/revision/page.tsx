'use client';

import { RevisionRespuestas } from '@/components/revision-respuestas';

export default function PretestRevisionPage() {
  return (
    <div className="min-h-screen bg-app">
      <RevisionRespuestas endpoint="/pretest/revision" titulo="Revisión del diagnóstico (pretest)" volverHref="/pretest/resultado" />
    </div>
  );
}
