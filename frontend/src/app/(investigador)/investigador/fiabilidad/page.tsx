'use client';

/**
 * FIABILIDAD DEL INSTRUMENTO — segunda pantalla del recorrido de la tesis.
 *
 * Responde a lo primero que pregunta un tribunal: ¿el pretest/postest mide de
 * forma consistente? Si el instrumento no es fiable, nada de lo que venga
 * después se sostiene.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, PageHeader, ResponsiveTable, SectionTitle, Skeleton } from '@/components/ui';
import { AvisoMuestra, Explicacion, num } from '@/components/investigador/estadistica';
import { AlertTriangle, FlaskConical } from '@/components/icons';

interface Kr20 {
  coeficiente: number; interpretacion: string; confiable: boolean;
  que_significa: string; advertencia: string | null;
}
interface Item {
  ejercicio_id: number; titulo: string; categoria: string;
  dificultad: number; discriminacion: number | null; d27: number | null;
  veredicto: string; motivo: string;
}
interface Test {
  hay_datos: boolean; n_personas: number; n_items: number;
  kr20: Kr20 | null; items: Item[];
  items_problematicos: { ejercicio_id: number; titulo: string; motivo: string }[];
}
interface ItemAjuste {
  ejercicio_id: number; titulo: string; dificultad_b: number | null;
  infit: number | null; outfit: number | null; veredicto: string | null; motivo: string | null;
}
interface Ajuste {
  hay_datos: boolean; n_personas?: number; items: ItemAjuste[];
  fuera_de_rango?: number; que_significa?: string; motivo?: string;
}
interface Datos {
  pretest: Test; postest: Test;
  ajuste_rasch: { pretest: Ajuste; postest: Ajuste };
}

const TONO: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'slate'> = {
  bueno: 'green', aceptable: 'blue', débil: 'amber', 'problemático': 'red',
};

export default function FiabilidadPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/investigador/fiabilidad')
      .then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;

  const sinDatos = !d || (!d.pretest.hay_datos && !d.postest.hay_datos);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Fiabilidad del instrumento"
        subtitle="¿El pretest y el postest miden de forma consistente? Es la primera condición para que cualquier resultado posterior signifique algo."
      />

      {sinDatos ? (
        <EmptyState
          icon={<FlaskConical className="h-7 w-7" />}
          title="Todavía no hay respuestas para analizar el instrumento"
          hint="La fiabilidad se calcula sobre las respuestas ítem por ítem del pretest y el postest. Aparecerá aquí en cuanto haya exámenes rendidos."
        />
      ) : (
        <>
          {(['pretest', 'postest'] as const).map((tipo) => {
            const t = d![tipo];
            const ajuste = d!.ajuste_rasch[tipo];
            return (
              <section key={tipo} className="mb-8">
                <SectionTitle className="mb-3 capitalize">{tipo}</SectionTitle>

                {!t.hay_datos ? (
                  <Card><p className="text-sm text-muted">Aún no hay respuestas registradas para el {tipo}.</p></Card>
                ) : (
                  <>
                    {/* KR-20 */}
                    <Card className="mb-4">
                      <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted">Consistencia interna (KR-20)</p>
                          <p className="font-display text-3xl font-bold text-fg">{num(t.kr20?.coeficiente ?? null, 3)}</p>
                          <p className="mt-0.5 text-sm capitalize text-muted">{t.kr20?.interpretacion}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge tone="slate">{t.n_personas} estudiantes</Badge>
                          <Badge tone="slate">{t.n_items} ítems</Badge>
                          <Badge tone={t.kr20?.confiable ? 'green' : 'amber'}>
                            {t.kr20?.confiable ? 'Muestra suficiente' : 'Muestra insuficiente'}
                          </Badge>
                        </div>
                      </div>
                      <Explicacion>{t.kr20?.que_significa}</Explicacion>
                      {t.kr20?.advertencia && <AvisoMuestra texto={t.kr20.advertencia} />}
                    </Card>

                    {/* Ítems problemáticos: primero, porque es lo accionable */}
                    {t.items_problematicos.length > 0 && (
                      <Card className="mb-4 border-prexi-red/30">
                        <div className="mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-prexi-red" />
                          <SectionTitle>Ítems problemáticos ({t.items_problematicos.length})</SectionTitle>
                        </div>
                        <p className="mb-3 text-sm text-muted">
                          Estos ítems deben reportarse en la tesis. Un ítem con discriminación negativa mide al
                          revés: quienes más saben tienden a fallarlo.
                        </p>
                        <ul className="space-y-2">
                          {t.items_problematicos.map((i) => (
                            <li key={i.ejercicio_id} className="rounded-xl border border-line p-3">
                              <p className="text-sm font-medium text-fg">#{i.ejercicio_id} · {i.titulo}</p>
                              <p className="text-xs text-muted">{i.motivo}</p>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}

                    {/* Análisis de ítems */}
                    <div className="mb-4">
                      <p className="mb-2 text-sm text-muted">
                        Análisis de ítems. <b>Dificultad</b> = proporción que acertó (más alto = más fácil).
                        <b> Discriminación</b> = correlación con el puntaje en los demás ítems, corregida.
                      </p>
                      <ResponsiveTable
                        rows={t.items}
                        rowKey={(i) => i.ejercicio_id}
                        cols={[
                          { header: 'Ítem', cell: (i) => <span className="text-fg">{i.titulo}</span> },
                          { header: 'Área', cell: (i) => <span className="text-muted">{i.categoria}</span> },
                          { header: 'Dificultad', cell: (i) => <span className="text-fg">{num(i.dificultad, 2)}</span> },
                          { header: 'Discriminación', cell: (i) => <span className={i.discriminacion !== null && i.discriminacion < 0 ? 'font-bold text-prexi-red' : 'text-fg'}>{num(i.discriminacion, 3)}</span> },
                          { header: 'D 27 %', cell: (i) => <span className="text-muted">{num(i.d27, 2)}</span> },
                          { header: 'Veredicto', cell: (i) => <Badge tone={TONO[i.veredicto] ?? 'slate'}>{i.veredicto}</Badge> },
                        ]}
                        card={(i) => (
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-fg">{i.titulo}</span>
                              <Badge tone={TONO[i.veredicto] ?? 'slate'}>{i.veredicto}</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 text-center">
                              {[['Dificultad', num(i.dificultad, 2)], ['Discrim.', num(i.discriminacion, 3)], ['D 27%', num(i.d27, 2)]].map(([l, v]) => (
                                <div key={l} className="rounded-lg bg-subtle px-1 py-1.5">
                                  <p className="text-[10px] uppercase text-muted">{l}</p>
                                  <p className="text-sm font-semibold text-fg">{v}</p>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-muted">{i.motivo}</p>
                          </div>
                        )}
                      />
                    </div>

                    {/* Ajuste al modelo de Rasch */}
                    <Card>
                      <SectionTitle className="mb-1">Ajuste al modelo de Rasch</SectionTitle>
                      {!ajuste.hay_datos ? (
                        <p className="text-sm text-muted">{ajuste.motivo ?? 'Sin datos de ajuste disponibles.'}</p>
                      ) : (
                        <>
                          <p className="mb-3 text-sm text-muted">
                            Permite afirmar que el modelo <i>describe</i> los datos, no solo que se aplicó.
                            {typeof ajuste.fuera_de_rango === 'number' && ajuste.fuera_de_rango > 0 && (
                              <> <b className="text-prexi-amber">{ajuste.fuera_de_rango} ítem(s) fuera del rango productivo.</b></>
                            )}
                          </p>
                          <ResponsiveTable
                            rows={ajuste.items}
                            rowKey={(i) => i.ejercicio_id}
                            cols={[
                              { header: 'Ítem', cell: (i) => <span className="text-fg">{i.titulo}</span> },
                              { header: 'b', cell: (i) => <span className="text-muted">{num(i.dificultad_b, 2)}</span> },
                              { header: 'Infit', cell: (i) => <span className="text-fg">{num(i.infit, 2)}</span> },
                              { header: 'Outfit', cell: (i) => <span className="text-fg">{num(i.outfit, 2)}</span> },
                              { header: 'Veredicto', cell: (i) => <span className="text-muted">{i.veredicto ?? i.motivo ?? '—'}</span> },
                            ]}
                            card={(i) => (
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-fg">{i.titulo}</p>
                                <p className="text-xs text-muted">b = {num(i.dificultad_b, 2)} · infit {num(i.infit, 2)} · outfit {num(i.outfit, 2)}</p>
                                <p className="text-xs text-muted">{i.veredicto ?? i.motivo}</p>
                              </div>
                            )}
                          />
                          <Explicacion>{ajuste.que_significa}</Explicacion>
                        </>
                      )}
                    </Card>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
