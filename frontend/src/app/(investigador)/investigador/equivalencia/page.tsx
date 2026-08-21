'use client';

/**
 * EQUIVALENCIA INICIAL DE LOS GRUPOS.
 *
 * Sin esto cualquier resultado final es atacable: la diferencia podría deberse
 * a que un grupo ya partía mejor. El veredicto de esta pantalla se cita
 * literalmente en el capítulo de resultados.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import { Comparacion, ContrasteCard } from '@/components/investigador/estadistica';
import { AlertTriangle, CheckCircle, HelpCircle } from '@/components/icons';

interface Composicion {
  grupo: string; n: number;
  theta_inicial_media: number | null; theta_inicial_n: number;
  nivel_inicial: { nivel: string; n: number }[];
  paralelos: { paralelo: string; n: number }[];
  instituciones: { institucion: string; n: number }[];
}
interface Datos {
  contraste_pretest: Comparacion;
  contraste_theta_inicial: Comparacion;
  comparables: boolean | null;
  veredicto: string;
  composicion: Composicion[];
  alfa: number;
}

export default function EquivalenciaPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/investigador/equivalencia')
      .then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  if (!d) return null;

  const icono = d.comparables === null
    ? <HelpCircle className="h-5 w-5 shrink-0 text-muted" />
    : d.comparables
      ? <CheckCircle className="h-5 w-5 shrink-0 text-prexi-green" />
      : <AlertTriangle className="h-5 w-5 shrink-0 text-prexi-red" />;

  const borde = d.comparables === null
    ? 'border-line'
    : d.comparables ? 'border-prexi-green/40' : 'border-prexi-red/40';

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Equivalencia inicial de los grupos"
        subtitle="¿Partían iguales control y experimental? Sin demostrarlo, comparar los resultados finales no es válido."
      />

      {/* Veredicto: lo primero y lo más citable */}
      <Card className={`mb-6 ${borde}`}>
        <div className="flex gap-3">
          {icono}
          <div>
            <p className="mb-1 font-display text-sm font-bold text-fg">Veredicto</p>
            <p className="text-sm leading-relaxed text-fg">{d.veredicto}</p>
            <p className="mt-2 text-xs text-muted">Nivel de significancia adoptado: α = {d.alfa}</p>
          </div>
        </div>
      </Card>

      <ContrasteCard c={d.contraste_pretest} titulo="Contraste del pretest (línea base en puntaje)" />
      <ContrasteCard c={d.contraste_theta_inicial} titulo="Contraste de la habilidad inicial θ (línea base en la escala IRT)" />

      {/* Composición de los grupos */}
      <Card>
        <SectionTitle className="mb-1">Composición de los grupos</SectionTitle>
        <p className="mb-4 text-sm text-muted">
          Más allá del puntaje: de qué está hecho cada grupo. Una diferencia marcada en nivel inicial,
          paralelo o institución es una variable interviniente que conviene declarar.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {d.composicion.map((c) => (
            <div key={c.grupo} className="rounded-2xl border border-line p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display font-bold capitalize text-fg">{c.grupo}</p>
                <Badge tone={c.grupo === 'experimental' ? 'green' : 'slate'}>n = {c.n}</Badge>
              </div>

              <div className="mb-3 rounded-xl bg-subtle p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted">θ inicial media (IRT)</p>
                <p className="font-display text-lg font-bold text-fg">
                  {c.theta_inicial_media !== null ? c.theta_inicial_media.toFixed(3) : '—'}
                  <span className="ml-1 text-xs font-normal text-muted">logits · n = {c.theta_inicial_n}</span>
                </p>
              </div>

              <Bloque titulo="Nivel inicial" datos={c.nivel_inicial.map((x) => [x.nivel, x.n])} />
              <Bloque titulo="Paralelos" datos={c.paralelos.map((x) => [x.paralelo, x.n])} />
              <Bloque titulo="Instituciones" datos={c.instituciones.map((x) => [x.institucion, x.n])} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Bloque({ titulo, datos }: { titulo: string; datos: [string, number][] }) {
  if (datos.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {datos.map(([k, v]) => (
          <span key={k} className="rounded-lg bg-subtle px-2 py-1 text-xs text-fg">
            {k} <b className="text-muted">· {v}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
