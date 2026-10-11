'use client';

import { CuestionarioInstrumento } from '@/components/cuestionario-instrumento';

/** Escala de usabilidad (SUS): la responden los estudiantes, una sola vez. */
export default function EvaluarPrexiPage() {
  return <CuestionarioInstrumento clave="SUS" volver="/dashboard" />;
}
