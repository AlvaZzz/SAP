'use client';

/**
 * SEGUIMIENTO DE ESTUDIANTES — los estudiantes de los paralelos del docente.
 * Búsqueda por nombre, CI o RU, y filtros por paralelo, nivel y estado.
 * "Necesitan atención" es un filtro de esta misma lista (ya no una página aparte).
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { NivelDificultad } from '@/lib/types';
import { Badge, Card, EmptyState, PageHeader, ResponsiveTable, Skeleton } from '@/components/ui';
import { EstadoChip, FilaCurso, NivelChip, PromedioChip, fechaCorta } from '@/components/docente/curso';
import { Search, UserCheck, Users } from '@/components/icons';

interface Respuesta {
  estudiantes: FilaCurso[];
  paralelos: { id: number | null; nombre: string; materia: string | null; total: number }[];
  resumen: { total: number; activos: number; sin_ingresar: number; en_riesgo: number };
}

type FiltroEstado = '' | 'atencion' | 'sin_ingresar' | 'al_dia' | 'cerca' | 'baja';

function Contenido() {
  const router = useRouter();
  const params = useSearchParams();
  const [d, setD] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [paralelo, setParalelo] = useState(params.get('paralelo') ?? '');
  const [nivel, setNivel] = useState<'' | NivelDificultad>('');
  const [estado, setEstado] = useState<FiltroEstado>((params.get('estado') as FiltroEstado) ?? '');

  useEffect(() => {
    api.get<Respuesta>('/docente/estudiantes').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return (d?.estudiantes ?? []).filter((e) => {
      if (estado === 'baja') return !e.activo;
      if (!e.activo) return false;
      if (paralelo && e.paralelo.nombre !== paralelo) return false;
      if (nivel && e.nivel !== nivel) return false;
      if (estado === 'atencion' && e.estado !== 'en_riesgo' && e.estado !== 'inactivo') return false;
      if (estado === 'sin_ingresar' && e.estado !== 'sin_ingresar') return false;
      if (estado === 'al_dia' && e.estado !== 'en_progreso') return false;
      if (estado === 'cerca' && e.situacion !== 'cerca') return false;
      if (texto && !`${e.nombre} ${e.ci ?? ''} ${e.ru ?? ''}`.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [d, q, paralelo, nivel, estado]);

  const abrir = (e: FilaCurso) => router.push(`/docente/estudiantes/${e.id}`);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Seguimiento de estudiantes"
        subtitle="Los estudiantes de tus paralelos, con su nivel actual y su promedio. Haz clic en uno para ver su ficha."
        action={<Link href="/docente/estudiantes/registro" className="btn-primary"><UserCheck className="h-4 w-4" /> Registrar estudiantes</Link>}
      />

      {/* Resumen: cada cifra filtra la lista para ver quiénes son */}
      {d && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Chip activo={estado === ''} onClick={() => setEstado('')}>{d.resumen.activos} estudiantes</Chip>
          <Chip activo={estado === 'atencion'} onClick={() => setEstado('atencion')} tono="red">{d.resumen.en_riesgo} necesitan atención</Chip>
          <Chip activo={estado === 'sin_ingresar'} onClick={() => setEstado('sin_ingresar')} tono="slate">{d.resumen.sin_ingresar} aún no ingresaron</Chip>
          <Chip activo={estado === 'cerca'} onClick={() => setEstado('cerca')} tono="amber">
            {d.estudiantes.filter((e) => e.activo && e.situacion === 'cerca').length} cerca del 80
          </Chip>
          {d.resumen.total > d.resumen.activos && (
            <Chip activo={estado === 'baja'} onClick={() => setEstado('baja')} tono="slate">{d.resumen.total - d.resumen.activos} dados de baja</Chip>
          )}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input !py-2 pl-9 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, CI o RU" aria-label="Buscar estudiante" />
        </div>
        <select className="input !w-auto !py-2 text-sm" value={paralelo} onChange={(e) => setParalelo(e.target.value)} aria-label="Paralelo">
          <option value="">Todos los paralelos</option>
          {d?.paralelos.map((p) => <option key={`${p.id}-${p.nombre}`} value={p.nombre}>{p.id === null ? p.nombre : `Paralelo ${p.nombre}`} ({p.total})</option>)}
        </select>
        <select className="input !w-auto !py-2 text-sm" value={nivel} onChange={(e) => setNivel(e.target.value as '' | NivelDificultad)} aria-label="Nivel">
          <option value="">Todos los niveles</option>
          <option value="basico">Básico</option>
          <option value="intermedio">Intermedio</option>
          <option value="avanzado">Avanzado</option>
        </select>
      </div>

      {cargando ? <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        : !d || d.estudiantes.length === 0 ? (
          <Card>
            <EmptyState icon={<Users className="h-7 w-7" />} title="Aún no tienes estudiantes"
              hint="Regístralos desde tu lista de Excel: quedan en su paralelo y contigo como docente." />
            <div className="mt-4 text-center"><Link href="/docente/estudiantes/registro" className="btn-primary">Registrar estudiantes</Link></div>
          </Card>
        ) : filtrados.length === 0 ? (
          <Card><EmptyState icon={<Search className="h-7 w-7" />} title="Ningún estudiante coincide" hint="Prueba con otro nombre o quita algún filtro." /></Card>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">{filtrados.length} estudiante(s)</p>
            <ResponsiveTable
              rows={filtrados}
              rowKey={(e) => e.id}
              onRowClick={abrir}
              cols={[
                {
                  header: 'Estudiante',
                  cell: (e) => (
                    <div>
                      <p className="font-semibold text-fg">{e.nombre}</p>
                      <p className="text-xs text-muted">CI {e.ci ?? '—'} · RU {e.ru ?? '—'}</p>
                    </div>
                  ),
                },
                { header: 'Paralelo', cell: (e) => <span className="text-fg">{e.paralelo.nombre}</span> },
                { header: 'Nivel actual', cell: (e) => <NivelChip nivel={e.nivel} /> },
                { header: 'Promedio', cell: (e) => <PromedioChip promedio={e.promedio} /> },
                { header: 'Ejercicios', cell: (e) => <span className="text-muted">{e.ejercicios_resueltos} resueltos{e.tasa_acierto !== null ? ` · ${e.tasa_acierto} %` : ''}</span> },
                { header: 'Última actividad', cell: (e) => <span className="text-muted">{fechaCorta(e.ultima_sesion)}</span> },
                { header: 'Estado', cell: (e) => (e.activo ? <EstadoChip estado={e.estado} /> : <Badge tone="slate">De baja</Badge>) },
              ]}
              card={(e) => (
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">{e.nombre}</p>
                      <p className="text-xs text-muted">CI {e.ci ?? '—'} · RU {e.ru ?? '—'} · Par. {e.paralelo.nombre}</p>
                    </div>
                    {e.activo ? <EstadoChip estado={e.estado} /> : <Badge tone="slate">De baja</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <NivelChip nivel={e.nivel} />
                    <PromedioChip promedio={e.promedio} />
                    <span className="text-xs text-muted">{e.ejercicios_resueltos} ejercicios · {fechaCorta(e.ultima_sesion)}</span>
                  </div>
                </div>
              )}
            />
          </>
        )}
    </div>
  );
}

function Chip({ children, activo, onClick, tono = 'blue' }: { children: React.ReactNode; activo: boolean; onClick: () => void; tono?: 'blue' | 'red' | 'amber' | 'slate' }) {
  const color = { blue: 'border-prexi-blue text-prexi-blue-deep', red: 'border-prexi-red text-prexi-red', amber: 'border-prexi-amber text-prexi-amber', slate: 'border-muted text-fg' }[tono];
  return (
    <button onClick={onClick} aria-pressed={activo}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${activo ? `${color} bg-subtle` : 'border-line text-muted hover:bg-subtle'}`}>
      {children}
    </button>
  );
}

export default function EstudiantesPage() {
  return <Suspense fallback={<Skeleton className="h-64" />}><Contenido /></Suspense>;
}
