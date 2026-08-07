'use client';

/**
 * EVIDENCIA COMPLEMENTARIA — relación entre el uso del sistema y la ganancia.
 *
 * Antes esta pantalla comparaba TERCILES de uso. Se reemplazó por correlaciones
 * con su valor p: trocear la muestra en tres descarta información y, con n
 * pequeño, sugiere patrones que no resisten un contraste. La correlación dice
 * lo mismo pero de forma defendible.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, PageHeader, ResponsiveTable, SectionTitle, Skeleton } from '@/components/ui';
import { AvisoMuestra, Explicacion, num, pTexto } from '@/components/investigador/estadistica';
import { ScatterChart } from '@/components/icons';

interface Correlacion {
  variable: string; metodo: string | null;
  r: number | null; p: number | null; n: number;
  magnitud: string | null; significativa: boolean | null;
  interpretacion: string;
}
interface Datos {
  hay_datos: boolean; n: number; suficiente: boolean;
  advertencia: string | null;
  correlaciones: Correlacion[];
  nota_metodologica: string;
}

export default function DatosPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/investigador/relacion-uso')
      .then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Evidencia complementaria"
        subtitle="¿Se asocia el uso real del sistema con la ganancia de aprendizaje? Evidencia de apoyo, no el contraste principal."
      />

      {!d || !d.hay_datos ? (
        <EmptyState
          icon={<ScatterChart className="h-7 w-7" />}
          title="Todavía no hay casos con pretest y postest"
          hint="Estas correlaciones necesitan estudiantes con ambas medidas para poder calcular la ganancia."
        />
      ) : (
        <>
          {d.advertencia && <AvisoMuestra texto={d.advertencia} />}

          <Card className="mb-5 mt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>Correlación entre uso y ganancia</SectionTitle>
              <Badge tone={d.suficiente ? 'green' : 'amber'}>{d.n} casos completos</Badge>
            </div>

            <ResponsiveTable
              rows={d.correlaciones}
              rowKey={(c) => c.variable}
              cols={[
                { header: 'Variable de uso', cell: (c) => <span className="font-medium text-fg">{c.variable}</span> },
                { header: 'Método', cell: (c) => <span className="text-muted">{c.metodo ?? '—'}</span> },
                { header: 'r', cell: (c) => <span className="font-semibold text-fg">{num(c.r, 3)}</span> },
                { header: 'p', cell: (c) => <span className="text-fg">{pTexto(c.p)}</span> },
                { header: 'n', cell: (c) => <span className="text-muted">{c.n}</span> },
                {
                  header: 'Magnitud',
                  cell: (c) => (
                    <Badge tone={c.significativa ? 'green' : 'slate'}>
                      {c.magnitud ?? '—'}{c.significativa ? ' · significativa' : ''}
                    </Badge>
                  ),
                },
              ]}
              card={(c) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-fg">{c.variable}</span>
                    <Badge tone={c.significativa ? 'green' : 'slate'}>{c.magnitud ?? '—'}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    {[['r', num(c.r, 3)], ['p', pTexto(c.p)], ['n', String(c.n)]].map(([l, v]) => (
                      <div key={l} className="rounded-lg bg-subtle px-1 py-1.5">
                        <p className="text-[10px] uppercase text-muted">{l}</p>
                        <p className="text-sm font-semibold text-fg">{v}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted">{c.interpretacion}</p>
                </div>
              )}
            />
          </Card>

          {/* Interpretación por variable, en lenguaje llano */}
          <Card className="mb-5">
            <SectionTitle className="mb-3">Cómo se interpreta cada una</SectionTitle>
            <ul className="space-y-2">
              {d.correlaciones.map((c) => (
                <li key={c.variable} className="rounded-xl border border-line p-3">
                  <p className="text-sm font-medium text-fg">{c.variable}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{c.interpretacion}</p>
                </li>
              ))}
            </ul>
            <Explicacion>
              Una correlación NO demuestra causalidad: que quienes más practican ganen más puede deberse
              a que ya estaban más motivados o tenían más base. Es evidencia de apoyo del capítulo de
              resultados, no el contraste que sostiene la hipótesis.
            </Explicacion>
          </Card>

          <Card>
            <SectionTitle className="mb-2">Nota metodológica</SectionTitle>
            <p className="text-sm leading-relaxed text-muted">{d.nota_metodologica}</p>
          </Card>
        </>
      )}
    </div>
  );
}
