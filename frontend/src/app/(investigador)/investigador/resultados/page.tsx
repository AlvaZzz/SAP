'use client';

/**
 * RESULTADOS — el corazón de la tesis.
 *
 * Cuatro preguntas en el orden en que se defienden:
 *  1. ¿Mejoró cada grupo entre pretest y postest?
 *  2. ¿Terminó mejor el experimental?
 *  3. ¿Ganó más el experimental?
 *  4. ¿Ganó más HABILIDAD (Δθ)? — el diferencial de esta tesis frente a una
 *     simple comparación de notas.
 *
 * Cada contraste llega ya con sus supuestos verificados y su tamaño del efecto;
 * si el n no da, la tarjeta muestra el bloqueo en vez de un valor p.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import {
  BotonCopiar, Comparacion, ContrasteCard, Explicacion, num, pTexto,
} from '@/components/investigador/estadistica';

interface PrePost { grupo: string; n_completos: number; contraste: Comparacion }
interface HakeGrupo { grupo: string; n: number; g_promedio: number | null; clasificacion: string | null }
interface Datos {
  alfa: number;
  pre_post_por_grupo: PrePost[];
  postest: Comparacion;
  ganancia: Comparacion;
  delta_theta: Comparacion;
  hake: { por_grupo: HakeGrupo[]; contraste: Comparacion; que_significa: string };
}

/** Tabla de contrastes en formato APA, lista para pegar en el documento. */
function tablaApa(d: Datos): string {
  const filas: string[] = [
    'Tabla X',
    'Contrastes entre grupo control y experimental',
    '',
    'Variable\tPrueba\tEstadístico\tgl\tp\tIC 95%\td de Cohen',
  ];
  const agregar = (nombre: string, c: Comparacion) => {
    if (!c.calculado || !c.resultado) {
      filas.push(`${nombre}\t—\t—\t—\tno calculado (n insuficiente)\t—\t—`);
      return;
    }
    const ic = c.resultado.ic95 ? `[${num(c.resultado.ic95[0])}, ${num(c.resultado.ic95[1])}]` : '—';
    filas.push(
      `${nombre}\t${c.prueba}\t${num(c.resultado.estadistico, 3)}\t${c.resultado.gl !== null ? num(c.resultado.gl, 2) : '—'}\t${pTexto(c.resultado.p)}\t${ic}\t${num(c.efecto?.d ?? null, 3)}`,
    );
  };
  agregar('Postest', d.postest);
  agregar('Ganancia', d.ganancia);
  agregar('Δθ (IRT)', d.delta_theta);
  agregar('⟨g⟩ de Hake', d.hake.contraste);
  filas.push('', `Nota. α = ${d.alfa}. Los supuestos de normalidad (Shapiro-Wilk) y homogeneidad de varianzas (Levene) se verificaron antes de cada contraste.`);
  return filas.join('\n');
}

export default function ResultadosPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/investigador/inferencial')
      .then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  if (!d) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Resultados"
        subtitle="Contraste de la hipótesis. Cada prueba se elige tras verificar sus supuestos, y viene con intervalo de confianza y tamaño del efecto."
        action={<BotonCopiar texto={tablaApa(d)} />}
      />

      {/* 1. Avance dentro de cada grupo */}
      <SectionTitle className="mb-3">1. ¿Mejoró cada grupo entre el pretest y el postest?</SectionTitle>
      {d.pre_post_por_grupo.map((g) => (
        <ContrasteCard
          key={g.grupo}
          c={g.contraste}
          titulo={`Grupo ${g.grupo} — avance pretest → postest (${g.n_completos} casos completos)`}
        />
      ))}

      {/* 2. Comparación final entre grupos */}
      <SectionTitle className="mb-3 mt-8">2. ¿Terminó mejor el grupo experimental?</SectionTitle>
      <ContrasteCard c={d.postest} titulo="Postest: control vs. experimental" />

      {/* 3. Ganancia */}
      <SectionTitle className="mb-3 mt-8">3. ¿Ganó más el grupo experimental?</SectionTitle>
      <ContrasteCard c={d.ganancia} titulo="Ganancia bruta (postest − pretest)" />

      {/* Hake */}
      <Card className="mb-5">
        <SectionTitle className="mb-1">Ganancia normalizada de Hake ⟨g⟩</SectionTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {d.hake.por_grupo.map((h) => (
            <div key={h.grupo} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium capitalize text-fg">{h.grupo}</p>
                <Badge tone="slate">n = {h.n}</Badge>
              </div>
              <p className="font-display text-2xl font-bold text-fg">{num(h.g_promedio, 3)}</p>
              <p className="text-xs capitalize text-muted">{h.clasificacion ?? 'sin datos'}</p>
            </div>
          ))}
        </div>
        <Explicacion>{d.hake.que_significa}</Explicacion>
      </Card>
      <ContrasteCard c={d.hake.contraste} titulo="⟨g⟩ de Hake: control vs. experimental" />

      {/* 4. Δθ — el diferencial de esta tesis */}
      <SectionTitle className="mb-3 mt-8">4. ¿Ganó más habilidad medida por IRT?</SectionTitle>
      <Card className="mb-4">
        <p className="text-sm leading-relaxed text-muted">
          Δθ es la ganancia en la escala de habilidad del modelo de Rasch, no en puntaje bruto. Es el
          aporte diferencial de esta tesis frente a una comparación de notas: θ se estima a partir del
          patrón de respuestas y de la dificultad de cada ítem, así que dos estudiantes con el mismo
          puntaje pueden tener habilidades distintas si acertaron ítems de dificultad distinta.
        </p>
      </Card>
      <ContrasteCard c={d.delta_theta} titulo="Δθ (ganancia de habilidad IRT): control vs. experimental" />
    </div>
  );
}
