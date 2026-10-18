'use client';

/**
 * INICIO DEL ROL INVESTIGADOR. Como el panel del docente y del admin: saludo,
 * en qué punto está el estudio (la hipótesis y la validación del sistema, con
 * su veredicto en palabras), qué falta para cerrar la medición —cada paso dice
 * qué hacer y lleva a donde se hace— y, al final, las herramientas del rol
 * agrupadas como en la barra lateral.
 */

import { ComponentType, ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Badge, Card, ProgressBar, SectionTitle, Skeleton } from '@/components/ui';
import {
  Users, FlaskConical, Layers, Download, ClipboardList, BarChart3, CheckCircle, Circle, ArrowRight,
  GraduationCap, AlertTriangle, ShieldCheck, Target,
} from '@/components/icons';

interface Panel {
  muestra: { total: number; paralelos: number };
  demo: { cuentas: number; modo_demo: boolean; aviso: string | null };
  avance: { con_pretest: number; pct_pretest: number };
  evaluacion: { fase_activa: boolean; iso_validado: boolean };
}
interface Validacion {
  muestra: { n_con_actividad: number; n_decisiones_motor: number };
  rendimiento: {
    umbral: number; n_estudiantes: number; media: number | null; pct_80: number | null;
    ic: { inferior: number | null; superior: number | null };
    contraste: { calculado: boolean; prueba: string | null; p_texto: string | null };
  };
  usabilidad: { n_respuestas: number };
  calidad: { n_evaluadores: number };
  hipotesis: { aceptada: boolean | null; motivo_sin_decision: string | null };
  criterios: {
    filas: { criterio: string; umbral: string; valor: string | null; cumple: boolean | null }[];
    satisfechos: number; total: number; sistema_validado: boolean | null;
  };
}

interface Paso { hecho: boolean; titulo: string; detalle: string; href?: string; accion?: string }

const MODULOS: { titulo: string; items: { href: string; titulo: string; texto: string; icon: ComponentType<{ className?: string }> }[] }[] = [
  {
    titulo: 'El estudio',
    items: [
      { href: '/investigador/panel', titulo: 'Diseño y muestra', texto: 'Diseño, población, paralelos, período y ficha metodológica.', icon: ClipboardList },
      { href: '/investigador/validez', titulo: 'Participantes y uso', texto: 'Cuántos se registraron, usaron el sistema y llegaron al final.', icon: Users },
    ],
  },
  {
    titulo: 'Resultados',
    items: [
      { href: '/investigador/validacion', titulo: 'Hipótesis y validación', texto: 'Rendimiento académico frente a 80 y los tres criterios del sistema.', icon: BarChart3 },
    ],
  },
  {
    titulo: 'Instrumentos',
    items: [
      { href: '/investigador/fiabilidad', titulo: 'Fiabilidad del diagnóstico', texto: 'KR-20, dificultad y discriminación de cada pregunta.', icon: FlaskConical },
      { href: '/investigador/clasificacion', titulo: 'Mecanismo adaptativo', texto: 'Si el sistema adaptó el contenido al nivel de cada estudiante.', icon: Layers },
    ],
  },
  {
    titulo: 'Entrega',
    items: [
      { href: '/investigador/exportacion', titulo: 'Descargar los datos', texto: 'CSV anónimos y diccionario de variables para Python o SPSS.', icon: Download },
    ],
  },
];

export default function InicioInvestigadorPage() {
  const { usuario } = useAuth();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [val, setVal] = useState<Validacion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Panel>('/investigador/panel').then(setPanel).catch(() => undefined),
      api.get<Validacion>('/investigador/validacion').then(setVal).catch(() => undefined),
    ]).finally(() => setCargando(false));
  }, []);

  const pasos: Paso[] = panel && val ? [
    {
      hecho: panel.muestra.total > 0,
      titulo: 'Estudiantes registrados',
      detalle: panel.muestra.total > 0
        ? `${panel.muestra.total} estudiantes en ${panel.muestra.paralelos} paralelo(s).`
        : 'Todavía no hay estudiantes. Se registran solos o los inscribe su docente.',
      href: '/investigador/panel', accion: 'Ver la muestra',
    },
    {
      hecho: panel.avance.con_pretest > 0,
      titulo: 'Diagnóstico inicial rendido',
      detalle: `${panel.avance.con_pretest} de ${panel.muestra.total} (${panel.avance.pct_pretest} %) rindieron la prueba diagnóstica.`,
      href: '/investigador/validez', accion: 'Ver participantes',
    },
    {
      hecho: val.muestra.n_decisiones_motor > 0,
      titulo: 'Uso del sistema',
      detalle: val.muestra.n_decisiones_motor > 0
        ? `${val.muestra.n_con_actividad} estudiantes practicaron; el motor tomó ${val.muestra.n_decisiones_motor} decisiones.`
        : 'Aún nadie practicó ejercicios: sin esto no hay precisión del motor que medir.',
      href: '/investigador/clasificacion', accion: 'Ver el motor',
    },
    {
      hecho: val.rendimiento.n_estudiantes >= 3,
      titulo: 'Exámenes de unidad rendidos',
      detalle: val.rendimiento.n_estudiantes
        ? `${val.rendimiento.n_estudiantes} estudiantes con al menos un examen de unidad.` +
          (val.rendimiento.n_estudiantes < 3 ? ' Hacen falta 3 o más para decidir la hipótesis.' : '')
        : 'Nadie rindió un examen de unidad todavía. Es el dato que decide la hipótesis.',
      href: '/investigador/validacion', accion: 'Ver el rendimiento',
    },
    {
      hecho: panel.evaluacion.iso_validado,
      titulo: 'Cuestionario de calidad validado por expertos',
      detalle: panel.evaluacion.iso_validado
        ? 'Los ítems ISO/IEC 25010 están validados (V de Aiken ≥ 0,80).'
        : 'Los 12 ítems ISO/IEC 25010 siguen siendo un borrador. Pásalos por juicio de expertos y pide que se carguen los textos validados antes de aplicarlos.',
    },
    {
      hecho: panel.evaluacion.fase_activa,
      titulo: 'Fase de evaluación abierta',
      detalle: panel.evaluacion.fase_activa
        ? 'Los estudiantes ya ven la escala SUS y los docentes el cuestionario de calidad.'
        : 'Al terminar el período de uso, el administrador la abre en Configuración → Investigación.',
    },
    {
      hecho: val.usabilidad.n_respuestas > 0 && val.calidad.n_evaluadores > 0,
      titulo: 'Encuestas respondidas',
      detalle: `${val.usabilidad.n_respuestas} respuestas a la escala SUS y ${val.calidad.n_evaluadores} evaluadores del cuestionario de calidad.`,
      href: '/investigador/validacion', accion: 'Ver resultados',
    },
    {
      hecho: val.hipotesis.aceptada !== null && val.criterios.sistema_validado !== null,
      titulo: 'Descargar los datos para el análisis',
      detalle: 'Cuando todo lo anterior esté listo, descarga los CSV anónimos y analízalos con Python (Capítulo IV).',
      href: '/investigador/exportacion', accion: 'Ir a descargas',
    },
  ] : [];
  const hechos = pasos.filter((p) => p.hecho).length;

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl lg:text-4xl">
        Hola, {usuario?.nombre.split(' ')[0]}
      </h1>
      <p className="mb-6 mt-1 text-base text-muted">
        Aquí ves en qué punto está tu estudio y qué falta para cerrarlo. Todo es de solo lectura y con datos anónimos.
      </p>

      {panel?.demo.aviso && (
        <div className={`mb-6 flex gap-3 rounded-2xl border p-4 ${panel.demo.modo_demo ? 'border-prexi-red/50 bg-prexi-red/10' : 'border-prexi-amber/40 bg-prexi-amber/10'}`}>
          <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${panel.demo.modo_demo ? 'text-prexi-red' : 'text-prexi-amber'}`} />
          <p className="text-sm leading-relaxed text-fg">{panel.demo.aviso}</p>
        </div>
      )}

      {/* ── Los dos veredictos de la tesis ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {cargando ? <><Skeleton className="h-56" /><Skeleton className="h-56" /></> : !val ? (
          <Card className="xl:col-span-2"><p className="text-sm text-muted">No se pudieron cargar los resultados. Recarga la página en unos segundos.</p></Card>
        ) : (
          <>
            <Veredicto
              icon={<Target className="h-5 w-5" />}
              titulo="Hipótesis de la tesis"
              pregunta={`¿El rendimiento promedio en los exámenes de unidad llega a ${val.rendimiento.umbral} sobre 100?`}
              estado={val.hipotesis.aceptada}
              si="Se acepta" no="No se acepta"
              href="/investigador/validacion"
            >
              {val.rendimiento.media === null ? (
                <p className="text-sm text-muted">{val.hipotesis.motivo_sin_decision}</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl font-extrabold text-fg">{val.rendimiento.media}</span>
                    <span className="text-sm text-muted">/ 100 · umbral {val.rendimiento.umbral}</span>
                  </div>
                  <ProgressBar className="mt-2" value={val.rendimiento.media} tone={val.rendimiento.media >= val.rendimiento.umbral ? 'green' : 'amber'} />
                  <p className="mt-2 text-xs text-muted">
                    {val.rendimiento.n_estudiantes} estudiantes · {val.rendimiento.pct_80} % alcanzó 80 o más
                    {val.rendimiento.ic.inferior !== null && <> · IC 95 % [{val.rendimiento.ic.inferior}; {val.rendimiento.ic.superior}]</>}
                    {val.rendimiento.contraste.calculado && val.rendimiento.contraste.p_texto !== '—' && <> · {val.rendimiento.contraste.prueba}, {val.rendimiento.contraste.p_texto}</>}
                  </p>
                  {val.hipotesis.motivo_sin_decision && <p className="mt-1 text-xs text-prexi-amber">{val.hipotesis.motivo_sin_decision}</p>}
                </>
              )}
            </Veredicto>

            <Veredicto
              icon={<ShieldCheck className="h-5 w-5" />}
              titulo="Validación del sistema"
              pregunta="¿PREXI cumple a la vez los tres criterios: precisión del motor, usabilidad y calidad?"
              estado={val.criterios.sistema_validado}
              si="Validado" no="No validado"
              href="/investigador/validacion"
            >
              <ul className="divide-y divide-line">
                {val.criterios.filas.map((c) => (
                  <li key={c.criterio} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-fg">{c.criterio}</span>
                      <span className="block text-xs text-muted">Obtenido: {c.valor ?? 'sin datos'} · meta {c.umbral}</span>
                    </span>
                    <Punto valor={c.cumple} />
                  </li>
                ))}
              </ul>
            </Veredicto>
          </>
        )}
      </div>

      {/* ── Qué falta ── */}
      <Card className="mb-8">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Qué falta para cerrar el estudio</SectionTitle>
          {!cargando && pasos.length > 0 && <Badge tone={hechos === pasos.length ? 'green' : 'blue'}>{hechos} de {pasos.length} listos</Badge>}
        </div>
        <p className="mb-4 text-sm text-muted">Los pasos en el orden en que ocurren en la investigación. Lo que está en gris todavía no se cumple.</p>
        {cargando ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div> : (
          <ol className="space-y-2">
            {pasos.map((p, i) => (
              <li key={p.titulo} className={`flex items-start gap-3 rounded-xl border p-3 ${p.hecho ? 'border-prexi-green/30 bg-prexi-green/5' : 'border-line'}`}>
                {p.hecho
                  ? <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-prexi-green" />
                  : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" />}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${p.hecho ? 'text-fg' : 'text-muted'}`}>{i + 1}. {p.titulo}</p>
                  <p className="text-sm text-muted">{p.detalle}</p>
                </div>
                {p.href && (
                  <Link href={p.href} className="hidden shrink-0 items-center gap-1 self-center text-sm font-semibold text-prexi-blue-deep hover:underline sm:inline-flex">
                    {p.accion} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* ── Herramientas del rol ── */}
      <SectionTitle className="mb-3">Tus herramientas</SectionTitle>
      <div className="flex flex-col gap-6">
        {MODULOS.map((g) => (
          <section key={g.titulo}>
            <h2 className="mb-2 text-2xs font-bold uppercase tracking-widest text-muted">{g.titulo}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.items.map((m) => (
                <Link key={m.href} href={m.href} className="group flex items-start gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-prexi-blue/40 hover:bg-subtle">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-prexi-blue/10 text-prexi-blue-deep"><m.icon className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-fg group-hover:text-prexi-blue-deep">{m.titulo}</span>
                    <span className="block text-sm text-muted">{m.texto}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted">
        <GraduationCap className="h-4 w-4" /> Junto a cada cifra cada pantalla explica qué significa y cómo se calculó, para que puedas defenderla.
      </p>
    </div>
  );
}

function Punto({ valor }: { valor: boolean | null }) {
  if (valor === null) return <Badge tone="slate">Sin datos</Badge>;
  return valor ? <Badge tone="green">Cumple</Badge> : <Badge tone="red">No cumple</Badge>;
}

function Veredicto({ icon, titulo, pregunta, estado, si, no, href, children }: {
  icon: ReactNode; titulo: string; pregunta: string; estado: boolean | null; si: string; no: string; href: string; children: ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-prexi-blue-deep">{icon}<SectionTitle>{titulo}</SectionTitle></div>
        {estado === null ? <Badge tone="amber">Aún sin datos</Badge> : estado ? <Badge tone="green">{si}</Badge> : <Badge tone="red">{no}</Badge>}
      </div>
      <p className="mb-4 text-sm text-muted">{pregunta}</p>
      <div className="flex-1">{children}</div>
      <Link href={href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-prexi-blue-deep hover:underline">
        Ver el detalle <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
