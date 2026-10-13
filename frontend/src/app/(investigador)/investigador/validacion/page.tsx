'use client';

/**
 * VALIDACIÓN DEL SISTEMA — los indicadores que declara la tesis (diseño no
 * experimental transversal): precisión del motor adaptativo, usabilidad
 * percibida (SUS) y calidad del producto (ISO/IEC 25010), más la variable
 * independiente descrita y la tabla de criterios de aceptación.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, PageHeader, ProgressBar, ResponsiveTable, SectionTitle, Skeleton } from '@/components/ui';
import { AvisoMuestra, Bloqueo, Explicacion, Metrica, num } from '@/components/investigador/estadistica';
import { CheckCircle, X, HelpCircle } from '@/components/icons';

interface IC { estimacion: number | null; inferior: number | null; superior: number | null; n: number; remuestreos: number; semilla: number }
interface Tiempos { n: number; media_s: number | null; mediana_s: number | null; p95_s: number | null; desviacion_s: number | null }
interface Datos {
  muestra: {
    institucion: string; n_estudiantes: number; n_con_actividad: number; paralelos: string[];
    periodo: { inicio: string | null; fin: string | null }; fecha_corte: string; n_decisiones_motor: number;
  };
  precision: {
    rango_objetivo: { min: number; max: number };
    n_asignaciones: number; n_evaluables: number; n_no_evaluables: number;
    en_rango: IC; latencia: Tiempos;
    por_nivel: { nivel: string; etiqueta: string; n: number; pct_en_rango: number | null }[];
    por_tema: { tema: string; titulo: string; n: number; pct_en_rango: number | null }[];
    como_se_calcula: string;
  };
  usabilidad: {
    n_respuestas: number; media: IC; desviacion: number | null; min: number | null; max: number | null;
    interpretacion: { calificativo: string; lectura: string } | null;
    distribucion: { calificativo: string; n: number }[]; nota: string;
  };
  calidad: {
    validado: boolean; aviso: string | null; n_evaluadores: number; nivel_aceptable: number;
    caracteristicas: {
      clave: string; nombre: string; n_items: number; media: number | null; ic: IC; aceptable: boolean | null;
      alfa_cronbach: number | null; alfa_confiable: boolean;
      subcaracteristicas: { clave: string; nombre: string; media: number | null; aceptable: boolean | null }[];
    }[];
    subcaracteristicas_total: number; subcaracteristicas_aceptables: number;
    pct_subcaracteristicas_aceptables: number | null; todas_aceptables: boolean | null;
  };
  variable_independiente: {
    adaptabilidad: { ejercicios_servidos: number; personalizados: number; pct_personalizacion: number | null };
    gamificacion: { retos_completados: number; cambios_posicion_ranking: number; consultas_ranking: number };
    retroalimentacion: Tiempos;
  };
  criterios: {
    filas: { criterio: string; indicador: string; umbral: string; valor: string | null; cumple: boolean | null }[];
    total: number; satisfechos: number; pendientes: number; hipotesis_aceptada: boolean | null; regla: string;
  };
}

const fecha = (f: string | null) => (f ? new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const intervalo = (ic: IC, sufijo = '') =>
  ic.inferior === null || ic.superior === null ? 'IC 95 %: sin datos suficientes' : `IC 95 % [${num(ic.inferior, 1)}${sufijo}; ${num(ic.superior, 1)}${sufijo}]`;
const seg = (v: number | null) => (v === null ? '—' : `${num(v, 3)} s`);

export default function ValidacionPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/investigador/validacion').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-28" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div>;
  if (!d) return <Bloqueo motivo="No se pudo cargar el panel de validación." explicacion="Vuelve a intentarlo en unos segundos." />;

  const { muestra, precision, usabilidad, calidad, variable_independiente: vi, criterios } = d;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Validación del sistema"
        subtitle="¿PREXI funciona bien? Precisión del motor adaptativo, usabilidad percibida y calidad del software, medidos al final del período de uso."
      />

      {/* ── Muestra ── */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metrica etiqueta={`Estudiantes ${muestra.institucion}`} valor={String(muestra.n_estudiantes)} destacado />
        <Metrica etiqueta="Con actividad" valor={String(muestra.n_con_actividad)} />
        <Metrica etiqueta="Paralelos" valor={muestra.paralelos.length ? muestra.paralelos.join(', ') : '—'} />
        <Metrica etiqueta="Período de uso" valor={`${fecha(muestra.periodo.inicio)} – ${fecha(muestra.periodo.fin)}`} />
      </div>

      {/* ── Criterios de aceptación ── */}
      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Criterios de aceptación de la hipótesis</SectionTitle>
          {criterios.hipotesis_aceptada === null
            ? <Badge tone="amber">Faltan datos · {criterios.satisfechos} de {criterios.total} cumplidos</Badge>
            : criterios.hipotesis_aceptada
              ? <Badge tone="green">{criterios.satisfechos} de {criterios.total} · se acepta la hipótesis</Badge>
              : <Badge tone="red">{criterios.satisfechos} de {criterios.total} · no se acepta</Badge>}
        </div>
        <ResponsiveTable
          rows={criterios.filas}
          rowKey={(c) => c.criterio}
          cols={[
            { header: 'Criterio', cell: (c) => <span className="font-semibold text-fg">{c.criterio}</span> },
            { header: 'Indicador', cell: (c) => <span className="text-muted">{c.indicador}</span> },
            { header: 'Umbral', cell: (c) => <span className="text-muted">{c.umbral}</span> },
            { header: 'Valor obtenido', cell: (c) => <span className="font-semibold text-fg">{c.valor ?? 'Sin datos'}</span> },
            { header: 'Resultado', cell: (c) => <Cumple valor={c.cumple} /> },
          ]}
          card={(c) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2"><p className="font-semibold text-fg">{c.criterio}</p><Cumple valor={c.cumple} /></div>
              <p className="text-xs text-muted">{c.indicador}</p>
              <p className="text-sm text-fg">Umbral {c.umbral} · obtenido <b>{c.valor ?? 'sin datos'}</b></p>
            </div>
          )}
        />
        <Explicacion>{criterios.regla} Los umbrales se configuran en Administración → Configuración → Investigación.</Explicacion>
      </Card>

      {/* ── 1. Precisión del motor adaptativo ── */}
      <Card className="mb-6">
        <SectionTitle className="mb-1">1 · Precisión del motor adaptativo</SectionTitle>
        <p className="mb-4 text-sm text-muted">
          Fuente: registro de logs del sistema ({precision.n_asignaciones} decisiones del motor; {precision.n_evaluables} evaluables).
        </p>
        {precision.n_evaluables === 0 ? (
          <Bloqueo
            motivo="Todavía no hay asignaciones del motor registradas."
            explicacion="Cada ejercicio de práctica que un estudiante responde genera una fila en el log. Los indicadores aparecen en cuanto exista actividad."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-line p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Asignaciones dentro del rango objetivo</p>
                <p className="font-display text-4xl font-extrabold text-fg">{num(precision.en_rango.estimacion, 1)} %</p>
                <p className="mt-1 text-sm text-muted">{intervalo(precision.en_rango, ' %')}</p>
                <p className="mt-1 text-2xs text-muted">
                  Bootstrap de percentil · {precision.en_rango.remuestreos} remuestreos · semilla {precision.en_rango.semilla} ·
                  rango objetivo {precision.rango_objetivo.min}–{precision.rango_objetivo.max}
                </p>
                {precision.n_no_evaluables > 0 && (
                  <p className="mt-2 text-2xs text-muted">{precision.n_no_evaluables} asignación(es) sin habilidad previa quedaron fuera del cálculo.</p>
                )}
              </div>
              <div className="rounded-2xl border border-line p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Latencia de reajuste</p>
                <p className="font-display text-4xl font-extrabold text-fg">{seg(precision.latencia.media_s)}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Metrica etiqueta="Mediana" valor={seg(precision.latencia.mediana_s)} />
                  <Metrica etiqueta="Percentil 95" valor={seg(precision.latencia.p95_s)} />
                  <Metrica etiqueta="Desv. estándar" valor={seg(precision.latencia.desviacion_s)} />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-fg">Por nivel adaptativo</p>
                <div className="space-y-3">
                  {precision.por_nivel.map((n) => (
                    <BarraPct key={n.nivel} etiqueta={n.etiqueta} n={n.n} pct={n.pct_en_rango} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-fg">Por tema</p>
                {precision.por_tema.length === 0 ? <p className="text-sm text-muted">Sin datos por tema.</p> : (
                  <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                    {precision.por_tema.map((t) => (
                      <BarraPct key={t.tema} etiqueta={`${t.tema} ${t.titulo}`} n={t.n} pct={t.pct_en_rango} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        <Explicacion>{precision.como_se_calcula}</Explicacion>
      </Card>

      {/* ── 2. Usabilidad percibida ── */}
      <Card className="mb-6">
        <SectionTitle className="mb-1">2 · Usabilidad percibida (SUS)</SectionTitle>
        <p className="mb-4 text-sm text-muted">Fuente: cuestionario SUS respondido por los estudiantes ({usabilidad.n_respuestas} respuestas).</p>
        {usabilidad.n_respuestas === 0 ? (
          <Bloqueo
            motivo="Ningún estudiante respondió todavía la escala SUS."
            explicacion="El cuestionario aparece a los estudiantes cuando se habilita la fase de evaluación del sistema, al final del período de uso."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-line p-4">
              <p className="text-xs uppercase tracking-wide text-muted">Puntaje medio SUS (0–100)</p>
              <div className="flex flex-wrap items-baseline gap-3">
                <p className="font-display text-4xl font-extrabold text-fg">{num(usabilidad.media.estimacion, 1)}</p>
                {usabilidad.interpretacion && <Badge tone="blue">{usabilidad.interpretacion.calificativo}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted">{intervalo(usabilidad.media)}</p>
              {usabilidad.interpretacion && <p className="mt-2 text-sm text-fg">{usabilidad.interpretacion.lectura}</p>}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Metrica etiqueta="Desv. estándar" valor={num(usabilidad.desviacion, 1)} />
                <Metrica etiqueta="Mínimo" valor={num(usabilidad.min, 1)} />
                <Metrica etiqueta="Máximo" valor={num(usabilidad.max, 1)} />
              </div>
            </div>
            <div className="rounded-2xl border border-line p-4">
              <p className="mb-3 text-sm font-semibold text-fg">Distribución por calificativo</p>
              <div className="space-y-3">
                {usabilidad.distribucion.map((c) => (
                  <BarraPct key={c.calificativo} etiqueta={c.calificativo} n={c.n}
                    pct={usabilidad.n_respuestas ? Math.round((c.n / usabilidad.n_respuestas) * 100) : null} />
                ))}
              </div>
            </div>
          </div>
        )}
        <Explicacion>{usabilidad.nota}</Explicacion>
      </Card>

      {/* ── 3. Calidad del producto ── */}
      <Card className="mb-6">
        <SectionTitle className="mb-1">3 · Calidad del producto de software (ISO/IEC 25010)</SectionTitle>
        <p className="mb-2 text-sm text-muted">
          Fuente: cuestionario respondido por docentes y evaluadores ({calidad.n_evaluadores} evaluadores). Nivel aceptable: media ≥ {calidad.nivel_aceptable}.
        </p>
        {calidad.aviso && <AvisoMuestra texto={calidad.aviso} />}
        {calidad.n_evaluadores === 0 ? (
          <div className="mt-4">
            <Bloqueo
              motivo="Ningún docente o evaluador respondió todavía el cuestionario de calidad."
              explicacion="Lo responden las cuentas con rol docente desde «Evaluar PREXI», con la fase de evaluación habilitada."
            />
          </div>
        ) : (
          <>
            <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metrica etiqueta="Subcaracterísticas en nivel aceptable" destacado
                valor={`${calidad.subcaracteristicas_aceptables} de ${calidad.subcaracteristicas_total} (${num(calidad.pct_subcaracteristicas_aceptables, 1)} %)`} />
              <Metrica etiqueta="Características aceptables"
                valor={`${calidad.caracteristicas.filter((c) => c.aceptable).length} de ${calidad.caracteristicas.length}`} />
              <Metrica etiqueta="Evaluadores" valor={String(calidad.n_evaluadores)} />
            </div>
            <ResponsiveTable
              rows={calidad.caracteristicas}
              rowKey={(c) => c.clave}
              cols={[
                { header: 'Característica', cell: (c) => <span className="font-semibold text-fg">{c.nombre}</span> },
                { header: 'Media (1–5)', cell: (c) => <span className="font-semibold text-fg">{num(c.media, 2)}</span> },
                { header: 'IC 95 %', cell: (c) => <span className="text-muted">{c.ic.inferior === null ? '—' : `[${num(c.ic.inferior, 2)}; ${num(c.ic.superior, 2)}]`}</span> },
                { header: 'α de Cronbach', cell: (c) => <span className="text-muted">{c.alfa_cronbach === null ? '—' : num(c.alfa_cronbach, 2)}</span> },
                { header: 'Subcaracterísticas', cell: (c) => <span className="text-muted">{c.subcaracteristicas.map((s) => `${s.nombre}: ${num(s.media, 2)}`).join(' · ')}</span> },
                { header: 'Resultado', cell: (c) => <Cumple valor={c.aceptable} si="Aceptable" no="Bajo el nivel" /> },
              ]}
              card={(c) => (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2"><p className="font-semibold text-fg">{c.nombre}</p><Cumple valor={c.aceptable} si="Aceptable" no="Bajo el nivel" /></div>
                  <p className="text-sm text-fg">Media {num(c.media, 2)}{c.alfa_cronbach !== null && <> · α = {num(c.alfa_cronbach, 2)}</>}</p>
                  <p className="text-xs text-muted">{c.subcaracteristicas.map((s) => `${s.nombre}: ${num(s.media, 2)}`).join(' · ')}</p>
                </div>
              )}
            />
            <Explicacion>
              La media de cada característica es la media, entre evaluadores, de la media de sus ítems. El α de Cronbach
              necesita al menos dos ítems por característica y dos evaluadores; con pocos evaluadores es solo orientativo.
            </Explicacion>
          </>
        )}
      </Card>

      {/* ── Variable independiente ── */}
      <Card>
        <SectionTitle className="mb-1">Variable independiente: el sistema adaptativo con gamificación</SectionTitle>
        <p className="mb-4 text-sm text-muted">Se describe, no se manipula. Fuente: logs del sistema y base de datos.</p>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metrica etiqueta="Adaptabilidad · personalización" destacado
            valor={vi.adaptabilidad.pct_personalizacion === null ? '—' : `${num(vi.adaptabilidad.pct_personalizacion, 1)} %`} />
          <Metrica etiqueta="Gamificación · retos completados" valor={String(vi.gamificacion.retos_completados)} />
          <Metrica etiqueta="Gamificación · cambios de posición" valor={String(vi.gamificacion.cambios_posicion_ranking)} />
          <Metrica etiqueta="Retroalimentación · tiempo medio" valor={seg(vi.retroalimentacion.media_s)} />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metrica etiqueta="Ejercicios servidos" valor={String(vi.adaptabilidad.ejercicios_servidos)} />
          <Metrica etiqueta="Consultas al ranking" valor={String(vi.gamificacion.consultas_ranking)} />
          <Metrica etiqueta="Retroalimentación · mediana" valor={seg(vi.retroalimentacion.mediana_s)} />
          <Metrica etiqueta="Retroalimentación · p95" valor={seg(vi.retroalimentacion.p95_s)} />
        </div>
        <Explicacion>
          Personalización = ejercicios servidos por la ruta adaptativa (filtrados por el nivel del estudiante y ordenados
          según su habilidad) ÷ total de ejercicios servidos. El tiempo de retroalimentación va desde que llega la respuesta
          hasta que el sistema tiene lista la corrección, medido en el servidor.
        </Explicacion>
      </Card>
    </div>
  );
}

function Cumple({ valor, si = 'Cumple', no = 'No cumple' }: { valor: boolean | null; si?: string; no?: string }) {
  if (valor === null) return <Badge tone="slate"><HelpCircle className="h-3 w-3" /> Sin datos</Badge>;
  return valor
    ? <Badge tone="green"><CheckCircle className="h-3 w-3" /> {si}</Badge>
    : <Badge tone="red"><X className="h-3 w-3" /> {no}</Badge>;
}

function BarraPct({ etiqueta, n, pct }: { etiqueta: string; n: number; pct: number | null }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium text-fg">{etiqueta}</span>
        <span className="shrink-0 text-muted">{pct === null ? 'sin datos' : `${pct} %`} · n = {n}</span>
      </div>
      <ProgressBar value={pct ?? 0} tone="blue" size="sm" />
    </div>
  );
}
