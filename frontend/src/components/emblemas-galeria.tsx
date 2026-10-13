'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EmblemaIcon } from './emblema-icon';
import { Card, SectionTitle, ProgressBar, Skeleton } from './ui';
import { Award } from './icons';

export interface Emblema {
  id: number; clave: string; nombre: string; condicion: string; descripcion: string;
  icono: string; svgKey: string; categoria: string; obtenido: boolean; fecha_obtenido: string | null;
}

const CAT_LABEL: Record<string, string> = {
  constancia: 'Constancia', precision: 'Precisión', velocidad: 'Velocidad',
  maestria: 'Maestría', especial: 'Especiales', general: 'General',
};

/**
 * Galería de emblemas: desbloqueados a color (oro), bloqueados en gris CON su
 * requisito visible, para que el estudiante sepa cómo conseguirlos. Se usa en
 * ranking y perfil.
 */
export function EmblemasGaleria({ compacto = false }: { compacto?: boolean }) {
  const [data, setData] = useState<{ total: number; desbloqueados: number; emblemas: Emblema[] } | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ total: number; desbloqueados: number; emblemas: Emblema[] }>('/gamificacion/emblemas')
      .then(setData).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <Card><Skeleton className="h-40" /></Card>;
  if (!data) return null;

  // Agrupa por categoría, respetando el orden del catálogo.
  const categorias = [...new Set(data.emblemas.map((e) => e.categoria))];

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Award className="h-5 w-5 text-prexi-amber" /><SectionTitle className="!text-lg">Emblemas</SectionTitle></div>
        <p className="text-xs text-muted"><b className="font-semibold text-prexi-amber">{data.desbloqueados}</b> de {data.total}</p>
      </div>
      <div className="mb-5"><ProgressBar value={data.total ? (data.desbloqueados / data.total) * 100 : 0} tone="amber" size="sm" /></div>

      {compacto ? (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {data.emblemas.map((e) => <EmblemaBadge key={e.id} e={e} />)}
        </div>
      ) : (
        <div className="space-y-5">
          {categorias.map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-muted">{CAT_LABEL[cat] ?? cat}</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {data.emblemas.filter((e) => e.categoria === cat).map((e) => (
                  <div key={e.id} className={`flex items-start gap-3 rounded-xl border p-3 transition ${e.obtenido ? 'border-prexi-amber/40 bg-amber-500/5' : 'border-line opacity-80'}`}>
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${e.obtenido ? 'bg-amber-500/15 text-prexi-amber' : 'bg-subtle text-muted/50'}`}>
                      <EmblemaIcon svgKey={e.svgKey} className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${e.obtenido ? 'text-fg' : 'text-muted'}`}>{e.nombre}</p>
                      <p className="text-xs text-muted">{e.obtenido ? e.descripcion : e.condicion}</p>
                      {!e.obtenido && <p className="mt-0.5 text-2xs font-medium text-prexi-amber/80">{e.condicion}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Versión mini (tooltip con requisito) para grids compactos. */
function EmblemaBadge({ e }: { e: Emblema }) {
  return (
    <div title={e.obtenido ? `${e.nombre} — ${e.descripcion}` : `${e.nombre} — ${e.condicion}`}
      className="flex cursor-default flex-col items-center gap-1.5 transition hover:-translate-y-0.5">
      <div className={`grid h-12 w-12 place-items-center rounded-full ${e.obtenido ? 'bg-amber-500/15 text-prexi-amber ring-2 ring-amber-500/20' : 'bg-subtle text-muted/40'}`}>
        <EmblemaIcon svgKey={e.svgKey} className="h-6 w-6" />
      </div>
      <span className={`text-center text-2xs leading-tight ${e.obtenido ? 'text-fg' : 'text-muted'}`}>{e.nombre}</span>
    </div>
  );
}
