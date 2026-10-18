'use client';

/**
 * EXÁMENES DE UNIDAD (docente). La evaluación final ya no es un módulo aparte:
 * cada unidad cierra con su examen de 10 preguntas sobre 100.
 *
 * Aquí el docente elige una unidad y un paralelo y ve a cada estudiante con su
 * nivel, su promedio y el estado de su examen. Quien completó todos los temas
 * en nivel Intermedio queda habilitado solo; a quien se quedó cerca, el docente
 * puede habilitarlo a mano (uno por uno o varios a la vez).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { NivelDificultad } from '@/lib/types';
import { Badge, Card, EmptyState, PageHeader, ProgressBar, Skeleton } from '@/components/ui';
import { NivelChip, PromedioChip } from '@/components/docente/curso';
import { AlertTriangle, CheckCircle, GraduationCap, Search, Users } from '@/components/icons';

type Estado = 'aprobado' | 'reprobado' | 'habilitado' | 'habilitado_docente' | 'cerca' | 'no_habilitado';
interface Fila {
  id: number; nombre: string; ci: string | null; ru: string | null; paralelo: string;
  nivel: NivelDificultad; promedio: number | null;
  temas_total: number; temas_completos: number; temas_en_nivel: number; avance_pct: number; pendientes: string[];
  unidad_abierta: boolean; nota: number | null; intentos: number;
  estado: Estado; habilitado_por: string | null; habilitado_en: string | null; puede_habilitarse: boolean;
}
interface Datos {
  unidades: { id: number; numero: number; titulo: string }[];
  unidad: { id: number; numero: number; titulo: string; temas: number; preguntas_examen: number; preguntas_integradoras: number } | null;
  nota_aprobacion: number; umbral_cerca: number;
  estudiantes: Fila[];
  resumen: { total: number; aprobados: number; habilitados: number; cerca: number; reprobados: number; no_habilitados: number } | null;
}

const ESTADOS: Record<Estado, { tone: 'green' | 'blue' | 'amber' | 'red' | 'slate'; label: string }> = {
  aprobado: { tone: 'green', label: 'Aprobó' },
  habilitado: { tone: 'blue', label: 'Habilitado' },
  habilitado_docente: { tone: 'blue', label: 'Habilitado por el docente' },
  cerca: { tone: 'amber', label: 'Cerca: puede habilitarse' },
  reprobado: { tone: 'red', label: 'Rindió sin aprobar' },
  no_habilitado: { tone: 'slate', label: 'Aún no habilitado' },
};
type Filtro = '' | Estado | 'habilitables';

export default function ExamenesUnidadPage() {
  const router = useRouter();
  const [d, setD] = useState<Datos | null>(null);
  const [unidadId, setUnidadId] = useState<number | null>(null);
  const [paralelo, setParalelo] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('');
  const [q, setQ] = useState('');
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(async (id: number | null) => {
    try {
      const r = await api.get<Datos>(`/docente/examenes${id ? `?unidadId=${id}` : ''}`);
      setD(r); setUnidadId(r.unidad?.id ?? null); setMarcados(new Set());
    } catch { setD({ unidades: [], unidad: null, nota_aprobacion: 80, umbral_cerca: 70, estudiantes: [], resumen: null }); }
  }, []);
  useEffect(() => { cargar(null); }, [cargar]);

  const paralelos = useMemo(() => [...new Set((d?.estudiantes ?? []).map((e) => e.paralelo))].sort(), [d]);
  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return (d?.estudiantes ?? []).filter((e) => {
      if (paralelo && e.paralelo !== paralelo) return false;
      if (filtro === 'habilitables' ? !e.puede_habilitarse : filtro && e.estado !== filtro) return false;
      if (texto && !`${e.nombre} ${e.ci ?? ''} ${e.ru ?? ''}`.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [d, paralelo, filtro, q]);

  const habilitables = visibles.filter((e) => e.puede_habilitarse);
  const alternar = (id: number) => setMarcados((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function habilitar(ids: number[]) {
    if (!d?.unidad || ids.length === 0) return;
    const elegidos = d.estudiantes.filter((e) => ids.includes(e.id));
    const detalle = elegidos.length === 1
      ? `${elegidos[0].nombre} (avance ${elegidos[0].avance_pct} %, promedio ${elegidos[0].promedio ?? 'sin evaluaciones'})`
      : `${elegidos.length} estudiantes`;
    if (!confirm(`¿Habilitar el examen de la Unidad ${d.unidad.numero} a ${detalle}?\n\nPodrán rendirlo aunque no hayan completado todos los temas en nivel Intermedio. Quedará registrado que tú los habilitaste.`)) return;
    setOcupado(true); setAviso(null);
    try {
      const r = await api.post<{ habilitados: number }>(`/docente/examenes/${d.unidad.id}/habilitar`, { ids });
      setAviso({ tipo: 'ok', texto: `Se habilitó a ${r.habilitados} estudiante(s) y se les envió una notificación.` });
      await cargar(d.unidad.id);
    } catch (e) { setAviso({ tipo: 'error', texto: e instanceof ApiError ? e.message : 'No se pudo habilitar.' }); }
    finally { setOcupado(false); }
  }

  async function retirar(e: Fila) {
    if (!d?.unidad || !confirm(`¿Retirar la habilitación manual de ${e.nombre}?`)) return;
    setOcupado(true);
    try { await api.del(`/docente/examenes/${d.unidad.id}/habilitar/${e.id}`); await cargar(d.unidad.id); }
    catch { /* se refleja al recargar */ } finally { setOcupado(false); }
  }

  if (!d) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Exámenes de unidad"
        subtitle={`Cada unidad cierra con su examen: 10 preguntas sobre 100, se aprueba con ${d.nota_aprobacion}. Aprobarlo abre la unidad siguiente.`}
      />

      {d.unidades.length === 0 || !d.unidad ? (
        <Card><EmptyState icon={<GraduationCap className="h-7 w-7" />} title="Aún no hay unidades publicadas" hint="Publica los temas de una unidad para que aparezca aquí su examen." /></Card>
      ) : (
        <>
          {/* Selector de unidad */}
          <div className="mb-4 flex flex-wrap gap-2">
            {d.unidades.map((u) => (
              <button key={u.id} onClick={() => cargar(u.id)} aria-pressed={u.id === unidadId}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${u.id === unidadId ? 'border-prexi-blue bg-prexi-blue text-accent-on' : 'border-line bg-card text-fg hover:bg-subtle'}`}>
                Unidad {u.numero}
              </button>
            ))}
          </div>

          <Card className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-fg">Unidad {d.unidad.numero} · {d.unidad.titulo}</h2>
                <p className="text-sm text-muted">
                  {d.unidad.temas} temas y subtemas · banco del examen: {d.unidad.preguntas_examen} preguntas ({d.unidad.preguntas_integradoras} integran 2 o más temas)
                </p>
              </div>
            </div>
            {d.unidad.preguntas_examen < 10 && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-prexi-amber/10 px-4 py-3 text-sm text-fg">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-prexi-amber" />
                El examen necesita 10 preguntas y esta unidad tiene {d.unidad.preguntas_examen}. Agrégalas desde Unidades → «Examen de la unidad».
              </p>
            )}

            {/* Cada cifra filtra la lista: ningún número queda suelto */}
            {d.resumen && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Cifra activo={filtro === ''} onClick={() => setFiltro('')}>{d.resumen.total} estudiantes</Cifra>
                <Cifra activo={filtro === 'aprobado'} onClick={() => setFiltro('aprobado')}>{d.resumen.aprobados} aprobaron</Cifra>
                <Cifra activo={filtro === 'habilitado'} onClick={() => setFiltro('habilitado')}>{d.resumen.habilitados} habilitados</Cifra>
                <Cifra activo={filtro === 'cerca'} onClick={() => setFiltro('cerca')}>{d.resumen.cerca} cerca del umbral</Cifra>
                <Cifra activo={filtro === 'reprobado'} onClick={() => setFiltro('reprobado')}>{d.resumen.reprobados} rindieron sin aprobar</Cifra>
                <Cifra activo={filtro === 'no_habilitado'} onClick={() => setFiltro('no_habilitado')}>{d.resumen.no_habilitados} aún no habilitados</Cifra>
              </div>
            )}
          </Card>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input !py-2 pl-9 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, CI o RU" aria-label="Buscar estudiante" />
            </div>
            <select className="input !w-auto !py-2 text-sm" value={paralelo} onChange={(e) => setParalelo(e.target.value)} aria-label="Paralelo">
              <option value="">Todos los paralelos</option>
              {paralelos.map((p) => <option key={p} value={p}>Paralelo {p}</option>)}
            </select>
            <button onClick={() => setMarcados(new Set(habilitables.map((e) => e.id)))} disabled={habilitables.length === 0} className="btn-ghost !py-2 text-sm disabled:opacity-50">
              Seleccionar habilitables ({habilitables.length})
            </button>
          </div>

          {marcados.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-prexi-blue/40 bg-prexi-blue/10 px-4 py-2.5 text-sm">
              <b className="text-fg">{marcados.size} seleccionado(s)</b>
              <button onClick={() => habilitar([...marcados])} disabled={ocupado} className="btn-primary !px-3 !py-1.5 text-sm disabled:opacity-50">
                <CheckCircle className="h-4 w-4" /> Habilitar examen
              </button>
              <button onClick={() => setMarcados(new Set())} className="text-sm font-semibold text-muted hover:text-fg">Quitar selección</button>
            </div>
          )}

          {aviso && (
            <p className={`mb-3 rounded-xl px-4 py-3 text-sm ${aviso.tipo === 'ok' ? 'bg-prexi-green/10 text-fg' : 'bg-red-500/10 text-prexi-red'}`}>{aviso.texto}</p>
          )}

          {visibles.length === 0 ? (
            <Card><EmptyState icon={<Users className="h-7 w-7" />} title="Ningún estudiante coincide" hint="Cambia de paralelo o quita el filtro." /></Card>
          ) : (
            <div className="space-y-2">
              {visibles.map((e) => {
                const est = ESTADOS[e.estado];
                return (
                  <Card key={e.id} className="!p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {e.puede_habilitarse
                        ? <input type="checkbox" checked={marcados.has(e.id)} onChange={() => alternar(e.id)} aria-label={`Seleccionar a ${e.nombre}`} className="h-4 w-4 shrink-0 accent-prexi-blue" />
                        : <span className="w-4 shrink-0" />}
                      <button onClick={() => router.push(`/docente/estudiantes/${e.id}`)} className="min-w-0 flex-1 text-left">
                        <p className="truncate font-semibold text-fg hover:underline">{e.nombre}</p>
                        <p className="text-xs text-muted">CI {e.ci ?? '—'}{e.ru ? ` · RU ` : ''} · Paralelo {e.paralelo}</p>
                      </button>
                      <NivelChip nivel={e.nivel} />
                      <div className="w-24 text-center"><p className="text-2xs uppercase tracking-wide text-muted">Promedio</p><PromedioChip promedio={e.promedio} /></div>
                      <div className="w-24 text-center">
                        <p className="text-2xs uppercase tracking-wide text-muted">Examen</p>
                        {e.nota !== null ? <PromedioChip promedio={e.nota} /> : <span className="text-xs text-muted">Sin rendir</span>}
                      </div>
                      <Badge tone={est.tone}>{est.label}</Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-7">
                      <div className="min-w-[180px] flex-1">
                        <div className="mb-1 flex justify-between text-xs text-muted">
                          <span>Temas listos (completos y en nivel Intermedio)</span>
                          <span>{e.avance_pct} %</span>
                        </div>
                        <ProgressBar value={e.avance_pct} tone={e.avance_pct >= 100 ? 'green' : e.avance_pct >= d.umbral_cerca ? 'amber' : 'blue'} size="sm" />
                      </div>
                      {e.estado === 'habilitado_docente' && (
                        <span className="text-xs text-muted">
                          Por {e.habilitado_por ?? 'un docente'}{e.habilitado_en ? ` · ${new Date(e.habilitado_en).toLocaleDateString('es-BO')}` : ''}{' '}
                          <button onClick={() => retirar(e)} disabled={ocupado} className="font-semibold text-prexi-red hover:underline">Retirar</button>
                        </span>
                      )}
                      {e.puede_habilitarse && (
                        <button onClick={() => habilitar([e.id])} disabled={ocupado} className="btn-ghost !px-3 !py-1.5 text-sm disabled:opacity-50">Habilitar examen</button>
                      )}
                    </div>
                    {e.pendientes.length > 0 && e.estado !== 'aprobado' && (
                      <p className="mt-2 pl-7 text-xs text-muted">Le falta: {e.pendientes.join(' · ')}{e.temas_total - e.temas_completos > e.pendientes.length ? '…' : ''}</p>
                    )}
                    {!e.unidad_abierta && <p className="mt-1 pl-7 text-xs text-prexi-amber">Todavía no aprobó el examen de la unidad anterior.</p>}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Cifra({ children, activo, onClick }: { children: React.ReactNode; activo: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={activo}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${activo ? 'border-prexi-blue bg-prexi-blue/10 text-prexi-blue-deep' : 'border-line text-muted hover:bg-subtle'}`}>
      {children}
    </button>
  );
}
