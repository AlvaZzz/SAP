import { PrexiLoader } from '@/components/prexi-loader';

/**
 * Fallback de carga del App Router (Suspense). Se muestra mientras el segmento
 * carga y React lo retira automáticamente al estar listo — sin retraso artificial.
 */
export default function Loading() {
  return <PrexiLoader />;
}
