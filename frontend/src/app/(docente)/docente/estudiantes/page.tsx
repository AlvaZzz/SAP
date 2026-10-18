'use client';

/**
 * SEGUIMIENTO — una sola lista de estudiantes. Arriba, unos contadores que
 * dicen a quiénes hay que atender; al tocar uno, la lista muestra solo a esos.
 * Cada fila explica en una línea por qué ese estudiante necesita atención.
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AvisoSolicitudes } from '@/components/docente/aviso-solicitudes';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { FilaCurso, NivelChip, PromedioChip } from '@/components/docente/curso';
import { Search, UserCheck, Users, Download, ArrowRight, CheckCircle, AlertTriangle } from '@/components/icons';

interface Respuesta {
  estudiantes: FilaCurso[];
  paralelos: { id: number | null; nombre: string; materia: string | null; total: number }[];
}

/** Grupos de atención, del más urgente al menos. */
const GRUPOS = [
  { clave: 'nunca_entro', texto: 'Nunca ingresaron', color: '#EF4444' },
  { clave: 'sin_diagnostico', texto: 'Sin diagnóstico', color: '#EF4444' },
  { clave: 'inactivo', texto: 'Dejaron de entrar', color: '#F59E0B' },
  { clave: 'acierto_bajo', texto: 'Fallan mucho', color: '#F59E0B' },
  { clave: 'sin_practica', texto: 'No empezaron a practicar', color: '#F59E0B' },
  { clave: 'estancado', texto: 'No suben de nivel', color: '#F59E0B' },
  { clave: 'cerca', texto: 'Cerca de aprobar', color: '#3B82F6' },
] as const;
type Clave = typeof GRUPOS[number]['clave'];
type Filtro = '' | Clave | 'al_dia' | 'atencion' | 'activos';

/** Filtro inicial según el enlace de origen (las tarjetas del panel del docente). */
const FILTRO_DE_ENLACE: Record<string, Filtro> = { sin_ingresar: 'nunca_entro', atencion: 'atencion', activos: 'activos' };
// Mismos criterios que los contadores del panel (docente-dashboard.service): semana desde
// la medianoche (UTC, como el servidor y como se guarda `ultima_sesion`) de hace 7 días,
// y quien nunca ingresó se cuenta aparte, no como «atención».
const activoEstaSemana = (e: FilaCurso) => {
  const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0);
  return !!e.ultima_sesion && new Date(e.ultima_sesion).getTime() >= hoy.getTime() - 7 * 86_400_000;
};
const necesitaAtencion = (e: FilaCurso) => e.motivos_riesgo.length > 0 && e.estado !== 'sin_ingresar';

const esDe = (e: FilaCurso, clave: Clave) => (clave === 'cerca' ? e.situacion === 'cerca' : e.motivos_riesgo.some((m) => m.clave === clave));

function hace(f: string | null): string {
  if (!f) return 'Nunca entró';
  const dias = Math.floor((Date.now() - new Date(f).getTime()) / 86_400_000);
  if (dias <= 0) return 'Entró hoy';
  if (dias === 1) return 'Entró ayer';
  return dias < 60 ? `Hace ${dias} días` : `Hace ${Math.floor(dias / 30)} meses`;
}

const urgencia = (e: FilaCurso) => (e.motivos_riesgo.some((m) => m.gravedad === 'alta') ? 0 : e.motivos_riesgo.length > 0 ? 1 : 2);

function Contenido() {
  const params = useSearchParams();
  const [d, setD] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [paralelo, setParalelo] = useState(params.get('paralelo') ?? '');
  // El panel del docente enlaza aquí con `?estado=sin_ingresar|atencion|activos`.
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_DE_ENLACE[params.get('estado') ?? ''] ?? '');

  useEffect(() => {
    api.get<Respuesta>('/docente/estudiantes').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const activos = useMemo(
    () => (d?.estudiantes ?? []).filter((e) => e.activo && (!paralelo || e.paralelo.nombre === paralelo)),
    [d, paralelo],
  );
  const grupos = useMemo(() => GRUPOS.map((g) => ({ ...g, n: activos.filter((e) => esDe(e, g.clave)).length })).filter((g) => g.n > 0), [activos]);
  const alDia = useMemo(() => activos.filter((e) => e.motivos_riesgo.length === 0).length, [activos]);
  const nAtencion = useMemo(() => activos.filter(necesitaAtencion).length, [activos]);
  const nSemana = useMemo(() => activos.filter(activoEstaSemana).length, [activos]);

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return activos
      .filter((e) => {
        if (filtro === 'al_dia' && e.motivos_riesgo.length > 0) return false;
        if (filtro === 'atencion' && !necesitaAtencion(e)) return false;
        if (filtro === 'activos' && !activoEstaSemana(e)) return false;
        if (filtro && filtro !== 'al_dia' && filtro !== 'atencion' && filtro !== 'activos' && !esDe(e, filtro)) return false;
        return !texto || `${e.nombre} ${e.ci ?? ''} ${e.ru ?? ''}`.toLowerCase().includes(texto);
      })
      .sort((a, b) => urgencia(a) - urgencia(b) || a.nombre.localeCompare(b.nombre));
  }, [activos, filtro, q]);

  function descargar() {
    const celda = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [
      ['Estudiante', 'CI', 'RU', 'Paralelo', 'Nivel', 'Promedio', 'Tema actual', 'Temas completados', 'Última actividad', 'Motivo de atención'],
      ...visibles.map((e) => [
        e.nombre, e.ci, e.ru, e.paralelo.nombre, e.nivel_label, e.promedio, e.tema_actual?.etiqueta ?? '',
        `${e.avance.completos} de ${e.avance.total}`, e.ultima_sesion ? new Date(e.ultima_sesion).toLocaleDateString('es-BO') : 'Nunca',
        e.motivos_riesgo.map((m) => m.detalle).join(' | '),
      ]),
    ];
    // BOM para que Excel abra los acentos bien.
    const blob = new Blob([String.fromCharCode(0xfeff) + filas.map((f) => f.map(celda).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seguimiento${paralelo ? `-paralelo-${paralelo}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (cargando) return <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>;

  if (!d || d.estudiantes.length === 0) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Seguimiento" subtitle="Cómo va cada uno de tus estudiantes." />
        <AvisoSolicitudes />
        <Card>
          <EmptyState icon={<Users className="h-7 w-7" />} title="Aún no tienes estudiantes" hint="Regístralos desde tu lista de Excel: quedan en su paralelo y contigo como docente." />
          <div className="mt-4 text-center"><Link href="/docente/estudiantes/registro" className="btn-primary"><UserCheck className="h-4 w-4" /> Registrar estudiantes</Link></div>
        </Card>
      </div>
    );
  }

  const boton = (activo: boolean, color: string) => ({
    className: `inline-flex items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-sm font-semibold transition ${activo ? 'bg-card text-fg' : 'border-line bg-card text-muted hover:bg-subtle'}`,
    style: activo ? { borderColor: color } : undefined,
  });

  return (
    <div className="animate-fade-up">
      <PageHeader title="Seguimiento" subtitle="Cómo va cada uno de tus estudiantes. Toca a uno para ver su ficha."
        action={d.paralelos.length > 1 ? (
          <select className="input !w-auto !py-2 text-sm" value={paralelo} onChange={(e) => setParalelo(e.target.value)} aria-label="Paralelo">
            <option value="">Todos mis paralelos</option>
            {d.paralelos.map((p) => <option key={`${p.id}-${p.nombre}`} value={p.nombre}>{p.id === null ? p.nombre : `Paralelo ${p.nombre}`}</option>)}
          </select>
        ) : undefined} />

      <AvisoSolicitudes />

      {/* Contadores: cada uno filtra la lista */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar estudiantes">
        <button onClick={() => setFiltro('')} aria-pressed={filtro === ''} {...boton(filtro === '', '#3B82F6')}>
          <b className="text-fg">{activos.length}</b> Todos
        </button>
        <button onClick={() => setFiltro(filtro === 'atencion' ? '' : 'atencion')} aria-pressed={filtro === 'atencion'} {...boton(filtro === 'atencion', '#F59E0B')}>
          <b className="text-prexi-amber">{nAtencion}</b> Necesitan atención
        </button>
        <button onClick={() => setFiltro(filtro === 'activos' ? '' : 'activos')} aria-pressed={filtro === 'activos'} {...boton(filtro === 'activos', '#10B981')}>
          <b className="text-prexi-green">{nSemana}</b> Activos esta semana
        </button>
        {grupos.map((g) => (
          <button key={g.clave} onClick={() => setFiltro(filtro === g.clave ? '' : g.clave)} aria-pressed={filtro === g.clave} {...boton(filtro === g.clave, g.color)}>
            <b style={{ color: g.color }}>{g.n}</b> {g.texto}
          </button>
        ))}
        <button onClick={() => setFiltro(filtro === 'al_dia' ? '' : 'al_dia')} aria-pressed={filtro === 'al_dia'} {...boton(filtro === 'al_dia', '#10B981')}>
          <b className="text-prexi-green">{alDia}</b> Van al día
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input !py-2 pl-9 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, CI o RU" aria-label="Buscar estudiante" />
        </div>
        <button onClick={descargar} disabled={visibles.length === 0} className="btn-ghost text-sm disabled:opacity-50"><Download className="h-4 w-4" /> Descargar lista</button>
      </div>

      {filtro === 'cerca' && (
        <p className="mb-3 rounded-xl bg-prexi-blue/10 px-4 py-2.5 text-sm text-fg">
          Tienen entre 70 y 79 de promedio. Puedes habilitarles el examen en <Link href="/docente/examenes" className="font-semibold text-prexi-blue-deep hover:underline">Exámenes de unidad</Link>.
        </p>
      )}

      {visibles.length === 0 ? (
        <Card><EmptyState icon={<Search className="h-7 w-7" />} title="Ningún estudiante coincide" hint="Prueba con otro nombre o toca «Todos»." /></Card>
      ) : (
        <ul className="card divide-y divide-line !p-0">
          {visibles.map((e) => {
            const grave = e.motivos_riesgo.some((m) => m.gravedad === 'alta');
            return (
              <li key={e.id}>
                <Link href={`/docente/estudiantes/${e.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-subtle">
                  <div className="min-w-[220px] flex-1">
                    <p className="font-semibold text-fg">{e.nombre}</p>
                    {e.motivos_riesgo.length > 0 ? (
                      <p className={`flex items-start gap-1 text-sm ${grave ? 'text-prexi-red' : 'text-prexi-amber'}`}>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{e.motivos_riesgo[0].detalle}</span>
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-sm text-prexi-green">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" /> {e.tema_actual ? `Va en ${e.tema_actual.etiqueta}` : 'Completó todos los temas'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <NivelChip nivel={e.nivel} />
                    <PromedioChip promedio={e.promedio} />
                    <span className="w-24 text-right text-xs text-muted">{hace(e.ultima_sesion)}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function EstudiantesPage() {
  return <Suspense fallback={<Skeleton className="h-64" />}><Contenido /></Suspense>;
}
