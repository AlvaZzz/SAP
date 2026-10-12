'use client';

/**
 * SEGUIMIENTO — pensado para responder tres preguntas del docente:
 *  1) ¿A quién tengo que atender y por qué?   → "Qué hacer ahora"
 *  2) ¿Por dónde va el curso y qué le cuesta? → "Cómo va el curso"
 *  3) ¿Cómo está cada estudiante?             → la lista, con el motivo a la vista
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { NivelDificultad } from '@/lib/types';
import { Badge, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { FilaCurso, NivelChip, PromedioChip } from '@/components/docente/curso';
import { Search, UserCheck, Users, Download, ArrowRight, CheckCircle, AlertTriangle, Clock, Lock, GraduationCap, TrendingDown, ClipboardList } from '@/components/icons';

interface TemaDificil { tema_id: number; tema: string; intentos: number; tasa_acierto: number }
interface Respuesta {
  estudiantes: FilaCurso[];
  temas_dificiles: TemaDificil[];
  paralelos: { id: number | null; nombre: string; materia: string | null; total: number }[];
  umbrales: { diasInactivo: number; aprobacion: number; cerca: number };
}

/** Grupos de atención: a quiénes incluye cada uno y qué conviene hacer. */
const ACCIONES = [
  { clave: 'nunca_entro', titulo: 'Nunca ingresaron', consejo: 'Recuérdales que entran con su RU como usuario y su CI como contraseña.', color: '#EF4444', Icono: Lock },
  { clave: 'sin_diagnostico', titulo: 'No rindieron el diagnóstico', consejo: 'Sin el diagnóstico no pueden empezar a practicar. Pídeles que lo rindan.', color: '#EF4444', Icono: ClipboardList },
  { clave: 'inactivo', titulo: 'Dejaron de entrar', consejo: 'Llevan varios días sin actividad. Conviene preguntarles qué pasó.', color: '#F59E0B', Icono: Clock },
  { clave: 'acierto_bajo', titulo: 'Practican pero fallan mucho', consejo: 'Entran y lo intentan, pero no lo están entendiendo: necesitan una explicación.', color: '#F59E0B', Icono: TrendingDown },
  { clave: 'sin_practica', titulo: 'Rindieron el diagnóstico y no siguieron', consejo: 'Anímalos a empezar su primer tema.', color: '#F59E0B', Icono: AlertTriangle },
  { clave: 'estancado', titulo: 'No suben de nivel', consejo: 'Llevan tiempo en el mismo nivel. Revisa en su ficha en qué tema se quedaron.', color: '#F59E0B', Icono: AlertTriangle },
  { clave: 'cerca', titulo: 'Cerca de aprobar', consejo: 'Su promedio está entre 70 y 79. Puedes habilitarles el examen de la unidad.', color: '#3B82F6', Icono: GraduationCap },
] as const;
type ClaveAccion = typeof ACCIONES[number]['clave'];
type Filtro = '' | ClaveAccion | 'al_dia' | 'baja';

const tiene = (e: FilaCurso, clave: ClaveAccion) => (clave === 'cerca' ? e.situacion === 'cerca' : e.motivos_riesgo.some((m) => m.clave === clave));

/** "hoy", "ayer", "hace 5 días": más útil que una fecha para decidir a quién buscar. */
function hace(f: string | null): string {
  if (!f) return 'Nunca';
  const dias = Math.floor((Date.now() - new Date(f).getTime()) / 86_400_000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return dias < 60 ? `Hace ${dias} días` : `Hace ${Math.floor(dias / 30)} meses`;
}

/** Los que más urgen primero: motivos graves, luego leves, luego el resto por apellido. */
const urgencia = (e: FilaCurso) => (e.motivos_riesgo.some((m) => m.gravedad === 'alta') ? 0 : e.motivos_riesgo.length > 0 ? 1 : e.situacion === 'cerca' ? 2 : 3);

function Contenido() {
  const params = useSearchParams();
  const [d, setD] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [paralelo, setParalelo] = useState(params.get('paralelo') ?? '');
  const [nivel, setNivel] = useState<'' | NivelDificultad>('');
  const [temaId, setTemaId] = useState<number | null>(null);
  // El panel de paralelos enlaza aquí con `?estado=sin_ingresar`.
  const [filtro, setFiltro] = useState<Filtro>(params.get('estado') === 'sin_ingresar' ? 'nunca_entro' : '');

  useEffect(() => {
    api.get<Respuesta>('/docente/estudiantes').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  // Todo lo de arriba (acciones y curso) respeta el paralelo elegido.
  const delParalelo = useMemo(
    () => (d?.estudiantes ?? []).filter((e) => !paralelo || e.paralelo.nombre === paralelo),
    [d, paralelo],
  );
  const activos = useMemo(() => delParalelo.filter((e) => e.activo), [delParalelo]);
  const deBaja = delParalelo.length - activos.length;

  const acciones = useMemo(
    () => ACCIONES.map((a) => ({ ...a, n: activos.filter((e) => tiene(e, a.clave)).length })).filter((a) => a.n > 0),
    [activos],
  );
  const alDia = useMemo(() => activos.filter((e) => e.motivos_riesgo.length === 0).length, [activos]);

  // Dónde va el curso: cuántos estudiantes están en cada tema ahora mismo.
  const porTema = useMemo(() => {
    const m = new Map<number, { id: number; etiqueta: string; n: number }>();
    let terminaron = 0;
    for (const e of activos) {
      if (!e.ya_ingreso || !e.tiene_diagnostico) continue;
      if (!e.tema_actual) { terminaron += 1; continue; }
      const t = m.get(e.tema_actual.id) ?? { ...e.tema_actual, n: 0 };
      t.n += 1; m.set(t.id, t);
    }
    const lista = [...m.values()].sort((a, b) => b.n - a.n);
    return { lista, terminaron, max: Math.max(1, ...lista.map((t) => t.n)) };
  }, [activos]);

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return delParalelo
      .filter((e) => {
        if (filtro === 'baja') return !e.activo;
        if (!e.activo) return false;
        if (filtro === 'al_dia' && e.motivos_riesgo.length > 0) return false;
        if (filtro && filtro !== 'al_dia' && !tiene(e, filtro as ClaveAccion)) return false;
        if (nivel && e.nivel !== nivel) return false;
        if (temaId !== null && e.tema_actual?.id !== temaId) return false;
        if (texto && !`${e.nombre} ${e.ci ?? ''} ${e.ru ?? ''}`.toLowerCase().includes(texto)) return false;
        return true;
      })
      .sort((a, b) => urgencia(a) - urgencia(b) || a.nombre.localeCompare(b.nombre));
  }, [delParalelo, filtro, nivel, temaId, q]);

  const accionActiva = ACCIONES.find((a) => a.clave === filtro);
  const temaActivo = temaId !== null ? porTema.lista.find((t) => t.id === temaId) : undefined;
  const hayFiltro = !!(filtro || nivel || temaId !== null || q.trim());
  const limpiar = () => { setFiltro(''); setNivel(''); setTemaId(null); setQ(''); };

  function descargar() {
    const celda = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [
      ['Estudiante', 'CI', 'RU', 'Paralelo', 'Nivel', 'Promedio', 'Tema actual', 'Temas completados', 'Última actividad', 'Motivo de atención'],
      ...visibles.map((e) => [
        e.nombre, e.ci, e.ru, e.paralelo.nombre, e.nivel_label, e.promedio, e.tema_actual?.etiqueta ?? (e.avance.total ? 'Terminó todos' : ''),
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

  if (cargando) return <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>;

  if (!d || d.estudiantes.length === 0) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Seguimiento" subtitle="A quién atender, por dónde va el curso y cómo está cada estudiante." />
        <Card>
          <EmptyState icon={<Users className="h-7 w-7" />} title="Aún no tienes estudiantes" hint="Regístralos desde tu lista de Excel: quedan en su paralelo y contigo como docente." />
          <div className="mt-4 text-center"><Link href="/docente/estudiantes/registro" className="btn-primary"><UserCheck className="h-4 w-4" /> Registrar estudiantes</Link></div>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Seguimiento" subtitle="A quién atender, por dónde va el curso y cómo está cada estudiante."
        action={
          <select className="input !w-auto !py-2 text-sm" value={paralelo} onChange={(e) => { setParalelo(e.target.value); setTemaId(null); }} aria-label="Paralelo">
            <option value="">Todos mis paralelos ({d.estudiantes.length})</option>
            {d.paralelos.map((p) => <option key={`${p.id}-${p.nombre}`} value={p.nombre}>{p.id === null ? p.nombre : `Paralelo ${p.nombre}`} ({p.total})</option>)}
          </select>
        } />

      {/* 1 · Qué hacer ahora */}
      <section className="mb-6">
        <h2 className="mb-2 font-display text-lg font-bold text-fg">Qué hacer ahora</h2>
        {acciones.length === 0 ? (
          <Card className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 shrink-0 text-prexi-green" />
            <p className="text-sm text-fg"><b>Nadie necesita atención.</b> Los {activos.length} estudiantes están avanzando.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {acciones.map((a) => {
              const sel = filtro === a.clave;
              return (
                <button key={a.clave} onClick={() => setFiltro(sel ? '' : a.clave)} aria-pressed={sel}
                  className={`flex items-start gap-3 rounded-2xl border-2 bg-card p-4 text-left transition hover:shadow-soft ${sel ? '' : 'border-line'}`}
                  style={sel ? { borderColor: a.color } : undefined}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ color: a.color, backgroundColor: `${a.color}1F` }}><a.Icono className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-extrabold leading-none" style={{ color: a.color }}>{a.n}</span>
                      <span className="font-bold text-fg">{a.titulo}</span>
                    </span>
                    <span className="mt-1 block text-sm text-muted">{a.consejo}</span>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-prexi-blue-deep">{sel ? 'Mostrando abajo · quitar filtro' : 'Ver quiénes son'} <ArrowRight className="h-3 w-3" /></span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2 · Cómo va el curso */}
      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-bold text-fg">En qué tema van</h2>
          <p className="mb-3 mt-0.5 text-sm text-muted">Cuántos estudiantes están hoy en cada tema. Toca uno para ver quiénes.</p>
          {porTema.lista.length === 0 && porTema.terminaron === 0 ? (
            <p className="text-sm text-muted">Todavía nadie empezó a practicar.</p>
          ) : (
            <ul className="space-y-1.5">
              {porTema.lista.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <button onClick={() => setTemaId(temaId === t.id ? null : t.id)} aria-pressed={temaId === t.id}
                    className={`w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-subtle ${temaId === t.id ? 'bg-prexi-blue/10 ring-1 ring-prexi-blue' : ''}`}>
                    <span className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate text-fg">{t.etiqueta}</span><b className="shrink-0 text-fg">{t.n}</b></span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full bg-prexi-blue" style={{ width: `${(t.n / porTema.max) * 100}%` }} /></span>
                  </button>
                </li>
              ))}
              {porTema.lista.length > 8 && <li className="px-2 text-xs text-muted">y {porTema.lista.length - 8} temas más con menos estudiantes.</li>}
              {porTema.terminaron > 0 && <li className="px-2 pt-1 text-sm text-prexi-green"><b>{porTema.terminaron}</b> ya completaron todos los temas.</li>}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold text-fg">Temas que más cuestan</h2>
          <p className="mb-3 mt-0.5 text-sm text-muted">Donde tus estudiantes aciertan menos al practicar. Son buenos candidatos para repasar en clase.</p>
          {d.temas_dificiles.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay suficientes intentos para saberlo (hacen falta al menos 10 por tema).</p>
          ) : (
            <ul className="space-y-2.5">
              {d.temas_dificiles.map((t) => {
                const color = t.tasa_acierto < 40 ? '#EF4444' : t.tasa_acierto < 60 ? '#F59E0B' : '#10B981';
                return (
                  <li key={t.tema_id}>
                    <span className="flex items-center justify-between gap-2 text-sm"><span className="min-w-0 truncate text-fg">{t.tema}</span><b className="shrink-0" style={{ color }}>{t.tasa_acierto} % de acierto</b></span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full" style={{ width: `${t.tasa_acierto}%`, backgroundColor: color }} /></span>
                    <span className="text-xs text-muted">{t.intentos} intentos</span>
                  </li>
                );
              })}
            </ul>
          )}
          {paralelo && d.temas_dificiles.length > 0 && <p className="mt-3 text-xs text-muted">Este cuadro suma todos tus paralelos, no solo el {paralelo}.</p>}
        </Card>
      </section>

      {/* 3 · Estudiantes */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-fg">
              {accionActiva ? accionActiva.titulo : temaActivo ? `Van en ${temaActivo.etiqueta}` : filtro === 'al_dia' ? 'Van al día' : filtro === 'baja' ? 'Dados de baja' : 'Todos los estudiantes'}
              <span className="ml-2 text-sm font-semibold text-muted">{visibles.length}</span>
            </h2>
            <p className="text-sm text-muted">Primero aparecen los que más necesitan atención.</p>
          </div>
          <button onClick={descargar} disabled={visibles.length === 0} className="btn-ghost text-sm disabled:opacity-50"><Download className="h-4 w-4" /> Descargar esta lista</button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input !py-2 pl-9 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, CI o RU" aria-label="Buscar estudiante" />
          </div>
          <select className="input !w-auto !py-2 text-sm" value={nivel} onChange={(e) => setNivel(e.target.value as '' | NivelDificultad)} aria-label="Nivel">
            <option value="">Todos los niveles</option>
            <option value="basico">Básico</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
          <button onClick={() => setFiltro(filtro === 'al_dia' ? '' : 'al_dia')} aria-pressed={filtro === 'al_dia'}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${filtro === 'al_dia' ? 'border-prexi-green bg-prexi-green/10 text-prexi-green' : 'border-line text-muted hover:bg-subtle'}`}>{alDia} al día</button>
          {deBaja > 0 && (
            <button onClick={() => setFiltro(filtro === 'baja' ? '' : 'baja')} aria-pressed={filtro === 'baja'}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${filtro === 'baja' ? 'border-muted bg-subtle text-fg' : 'border-line text-muted hover:bg-subtle'}`}>{deBaja} de baja</button>
          )}
          {hayFiltro && <button onClick={limpiar} className="text-sm font-semibold text-prexi-blue-deep hover:underline">Ver todos</button>}
        </div>

        {filtro === 'cerca' && (
          <p className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-prexi-blue/10 px-4 py-2.5 text-sm text-fg">
            Puedes habilitarles el examen aunque no hayan completado todos los temas.
            <Link href="/docente/examenes" className="font-semibold text-prexi-blue-deep hover:underline">Ir a Exámenes de unidad</Link>
          </p>
        )}

        {visibles.length === 0 ? (
          <Card><EmptyState icon={<Search className="h-7 w-7" />} title="Ningún estudiante coincide" hint="Prueba con otro nombre o quita algún filtro." /></Card>
        ) : (
          <ul className="card divide-y divide-line !p-0">
            {visibles.map((e) => <Fila key={e.id} e={e} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Fila({ e }: { e: FilaCurso }) {
  const grave = e.motivos_riesgo.some((m) => m.gravedad === 'alta');
  const pct = e.avance.total ? Math.round((e.avance.completos / e.avance.total) * 100) : 0;
  return (
    <li>
      <Link href={`/docente/estudiantes/${e.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition hover:bg-subtle">
        <div className="min-w-[220px] flex-1">
          <p className="font-semibold text-fg">{e.nombre}</p>
          <p className="text-xs text-muted">CI {e.ci ?? '—'} · RU {e.ru ?? '—'} · Paralelo {e.paralelo.nombre}</p>
          {!e.activo ? <Badge tone="slate" className="mt-1">De baja</Badge>
            : e.motivos_riesgo.length > 0 ? (
              <p className={`mt-1 flex items-start gap-1 text-xs font-medium ${grave ? 'text-prexi-red' : 'text-prexi-amber'}`}>
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{e.motivos_riesgo.map((m) => m.detalle).join(' ')}</span>
              </p>
            ) : <p className="mt-1 flex items-center gap-1 text-xs font-medium text-prexi-green"><CheckCircle className="h-3 w-3" /> Va al día</p>}
        </div>

        <div className="w-full sm:w-56">
          <p className="truncate text-xs text-muted">{!e.tiene_diagnostico ? 'Aún no empezó' : e.tema_actual ? <>Va en <b className="text-fg">{e.tema_actual.etiqueta}</b></> : <b className="text-prexi-green">Completó todos los temas</b>}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full bg-prexi-blue" style={{ width: `${pct}%` }} /></span>
            <span className="shrink-0 text-xs text-muted">{e.avance.completos}/{e.avance.total} temas</span>
          </div>
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
}

export default function EstudiantesPage() {
  return <Suspense fallback={<Skeleton className="h-64" />}><Contenido /></Suspense>;
}
