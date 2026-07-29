'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui';
import { TeoriaUnidad, TeoriaData } from '@/components/teoria-unidad';
import { BookOpen, ChevronLeft } from '@/components/icons';

/**
 * MÓDULO DE EJERCICIOS — Vista 3: MATERIAL DE ESTUDIO de la unidad.
 * Apartado teórico SEPARADO y opcional (objetivos, mapa conceptual, analogías y
 * ejemplos), navegable por páginas. Antes vivía embebido dentro de la vista de
 * la unidad y la alargaba muchísimo; ahora se entra on-demand y se vuelve.
 */
export default function TeoriaUnidadPage() {
  const router = useRouter();
  const params = useParams();
  const unidadId = Number(params.id);
  const [data, setData] = useState<TeoriaData | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Marca la teoría como VISTA para esta unidad: la vista de la unidad redirige
    // aquí solo la PRIMERA vez (puerta de entrada); después no se fuerza.
    if (Number.isFinite(unidadId) && typeof window !== 'undefined') {
      try { localStorage.setItem(`prexi_teoria_vista_u${unidadId}`, '1'); } catch { /* sin espacio */ }
    }
    api.get<TeoriaData>(`/unidades/${unidadId}/dashboard`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setCargando(false));
  }, [unidadId]);

  const volver = () => router.push(`/ejercicios/unidad/${unidadId}`);

  if (cargando) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-16" /><Skeleton className="h-10" /><Skeleton className="h-80" /></div>;

  if (!data) return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card px-4 py-20 text-center">
      <BookOpen className="mb-3 h-10 w-10 text-muted" />
      <h2 className="font-display text-lg font-bold text-fg">No se pudo cargar el material</h2>
      <p className="mt-1 text-sm text-muted">Revisa tu conexión e inténtalo de nuevo.</p>
      <button onClick={volver} className="btn-primary mt-5"><ChevronLeft className="h-4 w-4" /> Volver a la unidad</button>
    </div>
  );

  return <TeoriaUnidad data={data} onSalir={volver} />;
}
