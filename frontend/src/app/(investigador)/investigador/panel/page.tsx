'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card, StatCard, StatGrid, SectionTitle, Skeleton, ProgressBar, EmptyState, ResponsiveTable, PageHeader } from '@/components/ui';
import { Users, UserCheck, GraduationCap, Layers, ClipboardList, Calendar, FlaskConical } from '@/components/icons';

interface Panel {
  muestra: { total: number; paralelos: number };
  demo: { cuentas: number; modo_demo: boolean; aviso: string | null };
  paralelos: { paralelo: string; total: number }[];
  avance: { con_pretest: number; con_postest: number; pct_pretest: number; pct_postest: number };
  recoleccion: { inicio: string | null; fin: string | null };
}

interface Ficha {
  diseno: { tipo: string; esquema: string; por_que: string };
  poblacion: {
    descripcion: string; paralelos: string[]; n_registrados: number; n_con_actividad: number;
  };
  muestreo: { tipo: string; implicacion: string };
  instrumentos: { nombre: string; tipo: string; mide: string; responde: string }[];
  variables: { independiente: string; dependientes: string[] };
  hipotesis: { investigacion: string; criterio_decision: string };
  tratamiento_datos: { faltantes: string; anonimizacion: string; analisis: string };
}

export default function PanelEstudioPage() {
  const [d, setD] = useState<Panel | null>(null);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Panel>('/investigador/panel').then(setD).catch(() => undefined).finally(() => setCargando(false));
    api.get<Ficha>('/investigador/ficha-metodologica').then(setFicha).catch(() => undefined);
  }, []);

  const fecha = (f: string | null) => (f ? new Date(f).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

  return (
    <div className="animate-fade-up">
      <PageHeader title="Panel del estudio" subtitle="Diseño no experimental transversal: muestra, período de uso y ficha metodológica (solo lectura)." />

      {/* CANDADO 3: si hay cuentas sintéticas en la base, se dice. Nada oculto.
          Si además el MODO DEMOSTRACIÓN está activo, las cifras de pantalla las
          incluyen y el aviso pasa a rojo: no puede pasar desapercibido. */}
      {d?.demo.aviso && (
        <div className={`mb-6 flex gap-3 rounded-2xl border p-4 ${
          d.demo.modo_demo
            ? 'border-prexi-red/50 bg-prexi-red/10'
            : 'border-prexi-amber/40 bg-prexi-amber/10'}`}
        >
          <FlaskConical className={`mt-0.5 h-5 w-5 shrink-0 ${d.demo.modo_demo ? 'text-prexi-red' : 'text-prexi-amber'}`} />
          <div>
            <p className="font-display text-sm font-bold text-fg">
              {d.demo.modo_demo
                ? 'MODO DEMOSTRACIÓN — lo que ves NO son resultados del estudio'
                : 'Datos de demostración presentes en la base'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-fg">{d.demo.aviso}</p>
          </div>
        </div>
      )}

      {/* Muestra */}
      <StatGrid className="mb-6">
        {cargando ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <StatCard icon={<Users className="h-7 w-7" />} accent="blue" label="Muestra total (n)" value={d?.muestra.total ?? 0} />
            <StatCard icon={<UserCheck className="h-7 w-7" />} accent="navy" label="Paralelos" value={d?.muestra.paralelos ?? 0} />
            <StatCard icon={<Layers className="h-7 w-7" />} accent="green" label="Con diagnóstico inicial" value={d?.avance.con_pretest ?? 0} />
            <StatCard icon={<GraduationCap className="h-7 w-7" />} accent="blue" label="Con evaluación final" value={d?.avance.con_postest ?? 0} />
          </>
        )}
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Avance de la recolección */}
        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-prexi-blue-deep" /><SectionTitle>Avance del período de uso</SectionTitle></div>
          {cargando ? <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            : !d || d.muestra.total === 0 ? <EmptyState icon={<Users className="h-7 w-7" />} title="Aún no hay datos suficientes" hint="Cuando los estudiantes se registren y rindan las evaluaciones, verás el avance aquí." />
            : (
              <div className="space-y-5">
                <Avance label="Rindieron el diagnóstico inicial" valor={d.avance.con_pretest} total={d.muestra.total} pct={d.avance.pct_pretest} tone="blue" />
                <Avance label="Rindieron la evaluación final del curso" valor={d.avance.con_postest} total={d.muestra.total} pct={d.avance.pct_postest} tone="green" />
                <div className="rounded-xl bg-subtle p-4 text-sm text-muted">
                  El estudio no compara momentos ni grupos: el diagnóstico clasifica el nivel inicial y la evaluación final es del curso. Los indicadores de la tesis están en <b className="text-fg">Validación del sistema</b>.
                </div>
              </div>
            )}
        </Card>

        {/* Fechas de recolección */}
        <Card>
          <div className="mb-4 flex items-center gap-2"><Calendar className="h-5 w-5 text-prexi-blue-deep" /><SectionTitle>Periodo</SectionTitle></div>
          {cargando ? <Skeleton className="h-24" /> : (
            <div className="space-y-4">
              <div><p className="text-xs uppercase tracking-wide text-muted">Inicio</p><p className="font-display text-lg font-bold text-fg">{fecha(d?.recoleccion.inicio ?? null)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted">Último registro</p><p className="font-display text-lg font-bold text-fg">{fecha(d?.recoleccion.fin ?? null)}</p></div>
            </div>
          )}
        </Card>
      </div>

      {/* Desglose por paralelo */}
      <div className="mt-6">
        {cargando ? <Card className="!p-0"><div className="space-y-2 p-6">{[0, 1].map((i) => <Skeleton key={i} className="h-10" />)}</div></Card>
          : !d || d.paralelos.length === 0 ? <Card><SectionTitle>Estudiantes por paralelo</SectionTitle><p className="py-6 text-center text-sm text-muted">Sin estudiantes registrados.</p></Card>
          : (
            <>
              <SectionTitle className="mb-3">Estudiantes por paralelo</SectionTitle>
              <ResponsiveTable
                rows={d.paralelos}
                rowKey={(i) => i.paralelo}
                cols={[
                  { header: 'Paralelo', cell: (i) => <span className="font-medium text-fg">{i.paralelo}</span> },
                  { header: 'Estudiantes', cell: (i) => <span className="text-fg">{i.total}</span> },
                ]}
              />
            </>
          )}
      </div>

      {/* Ficha metodológica: diseño, hipótesis e instrumentos del estudio */}
      {ficha && (
        <div className="mt-8">
          <SectionTitle className="mb-1">Ficha metodológica</SectionTitle>
          <p className="mb-4 text-sm text-muted">
            El diseño del estudio, tal como el sistema lo aplica. Se genera desde los datos reales, así
            que no puede desincronizarse de lo que realmente se hizo.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle className="mb-3">Diseño</SectionTitle>
              <Dato etiqueta="Tipo" valor={ficha.diseno.tipo} />
              <Dato etiqueta="Esquema" valor={ficha.diseno.esquema} />
              <Dato etiqueta="Muestreo" valor={ficha.muestreo.tipo} />
              <div className="mt-3 rounded-xl bg-subtle p-3 text-xs leading-relaxed text-muted">
                <p className="mb-2">{ficha.diseno.por_que}</p>
                <p>{ficha.muestreo.implicacion}</p>
              </div>
            </Card>

            <Card>
              <SectionTitle className="mb-3">Hipótesis</SectionTitle>
              <Dato etiqueta="Hipótesis de investigación" valor={ficha.hipotesis.investigacion} />
              <div className="mt-3 rounded-xl bg-subtle p-3 text-xs leading-relaxed text-muted">
                <p>{ficha.hipotesis.criterio_decision}</p>
              </div>
            </Card>

            <Card>
              <SectionTitle className="mb-3">Variables</SectionTitle>
              <Dato etiqueta="Independiente" valor={ficha.variables.independiente} />
              <div className="mb-2">
                <p className="text-2xs uppercase tracking-wide text-muted">Dependientes</p>
                <ul className="mt-1 space-y-0.5">
                  {ficha.variables.dependientes.map((v) => (
                    <li key={v} className="flex gap-1.5 text-sm text-fg"><span className="text-prexi-blue-deep">•</span> {v}</li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card>
              <SectionTitle className="mb-3">Instrumentos</SectionTitle>
              {ficha.instrumentos.map((i) => (
                <div key={i.nombre} className="mb-3 rounded-xl border border-line p-3">
                  <p className="text-sm font-semibold text-fg">{i.nombre}</p>
                  <p className="text-xs text-muted">{i.tipo}</p>
                  <p className="mt-1 text-xs text-muted">Mide: {i.mide}</p>
                  <p className="mt-1 text-xs text-muted">Responde: {i.responde}</p>
                </div>
              ))}
            </Card>

            <Card className="lg:col-span-2">
              <SectionTitle className="mb-3">Tratamiento de los datos</SectionTitle>
              <Dato etiqueta="Datos faltantes" valor={ficha.tratamiento_datos.faltantes} />
              <Dato etiqueta="Anonimización" valor={ficha.tratamiento_datos.anonimizacion} />
              <Dato etiqueta="Análisis" valor={ficha.tratamiento_datos.analisis} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="mb-2">
      <p className="text-2xs uppercase tracking-wide text-muted">{etiqueta}</p>
      <p className="text-sm leading-relaxed text-fg">{valor}</p>
    </div>
  );
}

function Avance({ label, valor, total, pct, tone }: { label: string; valor: number; total: number; pct: number; tone: 'blue' | 'green' }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-fg">{label}</span>
        <span className="text-muted">{valor}/{total} · {pct}%</span>
      </div>
      <ProgressBar value={pct} tone={tone} />
    </div>
  );
}
