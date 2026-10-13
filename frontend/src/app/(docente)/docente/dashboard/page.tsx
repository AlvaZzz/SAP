'use client';

/**
 * DASHBOARD DEL DOCENTE — sus paralelos.
 *
 * Una tarjeta por paralelo. Al entrar a uno se ve cuántos estudiantes hay en
 * Básico, Intermedio y Avanzado, y al tocar un nivel se despliega la lista de
 * esos estudiantes (nombre, CI, RU). Cada estudiante abre su ficha.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AvisoSolicitudes } from '@/components/docente/aviso-solicitudes';
import { NivelDificultad, NIVEL_COLOR } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';
import { Card, StatCard, StatGrid, SectionTitle, Skeleton, Badge, EmptyState } from '@/components/ui';
import { TarjetaEvaluarPrexi } from '@/components/cuestionario-instrumento';
import { ListaNominal, Motivo, Nominal, PromedioChip } from '@/components/docente/curso';
import { Users, UserCheck, CheckCircle, AlertTriangle, ClipboardList, ArrowLeft, ArrowRight, GraduationCap } from '@/components/icons';

interface NivelParalelo { nivel: NivelDificultad; titulo: string; total: number; estudiantes: Nominal[] }
interface Paralelo {
  id: number | null; nombre: string; materia: string | null; gestion: string | null; docente: string | null; es_mio: boolean;
  total: number; sin_ingresar: number; en_riesgo: number; promedio: number | null; niveles: NivelParalelo[];
}
interface Dashboard {
  stats: {
    estudiantes_total: number; estudiantes_activos: number; resolvieron_hoy: number;
    necesitan_atencion: number; sin_ingresar: number; entregas_pendientes: number;
  };
  paralelos: Paralelo[];
  atencion: (Nominal & { motivos: Motivo[] })[];
  actividad_reciente: { estudiante_id: number; estudiante: string; titulo: string; categoria: string; correcto: boolean; fecha: string }[];
}

const claveDe = (p: Paralelo) => `${p.id ?? 'sin'}`;

export default function DocenteDashboardPage() {
  const { usuario } = useAuth();
  const [d, setD] = useState<Dashboard | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nivel, setNivel] = useState<NivelDificultad | null>(null);

  useEffect(() => {
    api.get<Dashboard>('/docente/dashboard').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const paralelo = d?.paralelos.find((p) => claveDe(p) === abierto) ?? null;
  const hora = (f: string) => new Date(f).toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl lg:text-4xl">Hola, {usuario?.nombre.split(' ')[0]}</h1>
      <p className="mb-6 mt-1 text-base text-muted">Estos son tus paralelos. Entra a uno para ver a tus estudiantes por nivel.</p>

      <AvisoSolicitudes />
      <TarjetaEvaluarPrexi href="/docente/evaluar-prexi" />

      <StatGrid className="mb-6">
        {cargando ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <StatCard icon={<Users className="h-7 w-7" />} accent="blue" label="Estudiantes" value={d?.stats.estudiantes_total ?? 0} />
            <StatCard icon={<UserCheck className="h-7 w-7" />} accent="green" label="Activos esta semana" value={d?.stats.estudiantes_activos ?? 0} />
            <StatCard icon={<CheckCircle className="h-7 w-7" />} accent="navy" label="Resolvieron hoy" value={d?.stats.resolvieron_hoy ?? 0} />
            <StatCard icon={<AlertTriangle className="h-7 w-7" />} accent="amber" label="Necesitan atención" value={d?.stats.necesitan_atencion ?? 0} />
          </>
        )}
      </StatGrid>

      {/* ── Paralelos ── */}
      {cargando ? <Skeleton className="h-48" /> : !d || d.paralelos.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="h-7 w-7" />} title="Todavía no tienes paralelos"
            hint="Empieza registrando a tus estudiantes: se crean los paralelos y quedas como su docente." />
          <div className="mt-4 text-center"><Link href="/docente/estudiantes/registro" className="btn-primary">Registrar estudiantes <ArrowRight className="h-4 w-4" /></Link></div>
        </Card>
      ) : !paralelo ? (
        <>
          <SectionTitle className="mb-3">Mis paralelos</SectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {d.paralelos.map((p) => (
              <button key={claveDe(p)} onClick={() => { setAbierto(claveDe(p)); setNivel(null); }}
                className="card text-left transition hover:-translate-y-0.5 hover:border-prexi-blue/50 hover:shadow-lift">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{p.materia ?? 'Sin materia'}{p.gestion ? ` · ${p.gestion}` : ''}</p>
                    <p className="font-display text-2xl font-extrabold text-fg">{p.id === null ? p.nombre : `Paralelo ${p.nombre}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-3xl font-extrabold text-prexi-blue-deep">{p.total}</p>
                    <p className="text-2xs text-muted">estudiantes</p>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted">{p.es_mio ? 'Tú eres el docente' : p.docente ? `Docente: ${p.docente}` : 'Sin docente asignado'}</p>

                {/* Barra de distribución por nivel */}
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-subtle">
                  {p.niveles.map((n) => p.total > 0 && n.total > 0 && (
                    <div key={n.nivel} style={{ width: `${(n.total / p.total) * 100}%`, backgroundColor: NIVEL_COLOR[n.nivel] }} title={`${n.titulo}: ${n.total}`} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {p.niveles.map((n) => (
                    <span key={n.nivel} className="inline-flex items-center gap-1.5">
                      <i className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: NIVEL_COLOR[n.nivel] }} />{n.titulo} <b className="text-fg">{n.total}</b>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.en_riesgo > 0 && <Badge tone="red">{p.en_riesgo} necesitan atención</Badge>}
                  {p.sin_ingresar > 0 && <Badge tone="slate">{p.sin_ingresar} sin ingresar</Badge>}
                </div>
                <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-prexi-blue-deep">Ver estudiantes por nivel <ArrowRight className="h-4 w-4" /></p>
              </button>
            ))}
          </div>
        </>
      ) : (
        /* ── Dentro de un paralelo: niveles → lista nominal ── */
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <button onClick={() => setAbierto(null)} className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-prexi-blue-deep hover:underline">
                <ArrowLeft className="h-4 w-4" /> Todos mis paralelos
              </button>
              <h2 className="font-display text-2xl font-extrabold text-fg">{paralelo.id === null ? paralelo.nombre : `Paralelo ${paralelo.nombre}`}</h2>
              <p className="text-sm text-muted">
                {paralelo.materia ?? 'Sin materia'}{paralelo.gestion ? ` · ${paralelo.gestion}` : ''} · {paralelo.total} estudiantes ·
                promedio del paralelo: <PromedioChip promedio={paralelo.promedio} />
              </p>
            </div>
            <Link href={`/docente/estudiantes?paralelo=${encodeURIComponent(paralelo.nombre)}`} className="btn-ghost"><Users className="h-4 w-4" /> Ver seguimiento</Link>
          </div>

          <p className="mb-3 mt-5 text-sm font-semibold text-fg">Estudiantes según su nivel actual</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {paralelo.niveles.map((n) => {
              const activo = nivel === n.nivel;
              return (
                <button key={n.nivel} onClick={() => setNivel(activo ? null : n.nivel)} aria-pressed={activo}
                  className={`rounded-2xl border-2 p-4 text-left transition ${activo ? 'bg-subtle' : 'border-line hover:bg-subtle/60'}`}
                  style={activo ? { borderColor: NIVEL_COLOR[n.nivel] } : undefined}>
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: NIVEL_COLOR[n.nivel] }}>{n.titulo}</p>
                  <p className="font-display text-4xl font-extrabold text-fg">{n.total}</p>
                  <p className="text-xs text-muted">
                    {paralelo.total > 0 ? `${Math.round((n.total / paralelo.total) * 100)} % del paralelo` : 'sin estudiantes'} · {activo ? 'ocultar lista' : 'ver quiénes son'}
                  </p>
                </button>
              );
            })}
          </div>

          {nivel && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-fg">
                {paralelo.niveles.find((n) => n.nivel === nivel)?.total} estudiante(s) en nivel {paralelo.niveles.find((n) => n.nivel === nivel)?.titulo}
              </p>
              <ListaNominal estudiantes={paralelo.niveles.find((n) => n.nivel === nivel)?.estudiantes ?? []} vacio="Nadie está en este nivel todavía." />
            </div>
          )}
          {!nivel && paralelo.total > 0 && <p className="mt-4 text-sm text-muted">Toca un nivel para ver la lista de sus estudiantes.</p>}
        </Card>
      )}

      {/* ── Lo que necesita tu atención ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionTitle>Estudiantes que necesitan atención</SectionTitle>
            <Link href="/docente/estudiantes?estado=atencion" className="text-sm font-semibold text-prexi-blue-deep hover:underline">Ver todos</Link>
          </div>
          {cargando ? <Skeleton className="h-32" /> : !d || d.atencion.length === 0 ? (
            <p className="rounded-xl bg-subtle px-4 py-6 text-center text-sm text-muted">Ningún estudiante necesita atención por ahora.</p>
          ) : (
            <ul className="space-y-2">
              {d.atencion.map((e) => (
                <li key={e.id}>
                  <Link href={`/docente/estudiantes/${e.id}`} className="block rounded-xl border border-line p-3 transition hover:bg-subtle">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-fg">{e.nombre}</span>
                      <span className="text-xs text-muted">RU {e.ru ?? '—'} · Par. {e.paralelo}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{e.motivos.map((m) => m.detalle).join(' ')}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle className="mb-3">Pendientes</SectionTitle>
            <div className="space-y-2">
              <Link href="/docente/revisiones" className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:bg-subtle">
                <ClipboardList className="h-5 w-5 shrink-0 text-prexi-blue-deep" />
                <span className="flex-1 text-sm text-fg">Entregas de retos por revisar</span>
                <Badge tone={d?.stats.entregas_pendientes ? 'amber' : 'slate'}>{d?.stats.entregas_pendientes ?? 0}</Badge>
              </Link>
              <Link href="/docente/estudiantes?estado=sin_ingresar" className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:bg-subtle">
                <UserCheck className="h-5 w-5 shrink-0 text-prexi-blue-deep" />
                <span className="flex-1 text-sm text-fg">Estudiantes que aún no ingresaron</span>
                <Badge tone={d?.stats.sin_ingresar ? 'amber' : 'slate'}>{d?.stats.sin_ingresar ?? 0}</Badge>
              </Link>
              <Link href="/docente/examenes" className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:bg-subtle">
                <GraduationCap className="h-5 w-5 shrink-0 text-prexi-blue-deep" />
                <span className="flex-1 text-sm text-fg">Exámenes de unidad: habilitar estudiantes</span>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            </div>
          </Card>

          <Card>
            <SectionTitle className="mb-3">Actividad reciente de tus estudiantes</SectionTitle>
            {cargando ? <Skeleton className="h-32" /> : !d || d.actividad_reciente.length === 0 ? (
              <p className="rounded-xl bg-subtle px-4 py-6 text-center text-sm text-muted">Aún no hay actividad.</p>
            ) : (
              <ul className="space-y-1.5">
                {d.actividad_reciente.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${a.correcto ? 'bg-prexi-green' : 'bg-prexi-red'}`} />
                    <Link href={`/docente/estudiantes/${a.estudiante_id}`} className="shrink-0 font-medium text-fg hover:underline">{a.estudiante}</Link>
                    <span className="min-w-0 flex-1 truncate text-muted">{a.correcto ? 'resolvió' : 'falló'} · {a.titulo}</span>
                    <span className="shrink-0 text-xs text-muted">{hora(a.fecha)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
