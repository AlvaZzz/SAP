'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { UnidadEstudiante, TemaEstudiante, NIVEL_COLOR, colorUnidad } from '@/lib/types';
import { Skeleton } from '@/components/ui';
import { TeoriaData } from '@/components/teoria-unidad';
import { UnidadBanner } from '@/components/unidad-banner';
import { BotonFlashcards } from '@/components/flashcards/boton-flashcards';
import { resumenUnidad, estadoExamen, temasEnOrden } from '@/components/ejercicios/camino';
import { ChevronLeft, CheckCircle, Lock, Play, ArrowRight, RotateCcw, Layers, TrendingUp, BookOpen, GraduationCap, Trophy, Star } from '@/components/icons';

/**
 * EJERCICIOS — dentro de una unidad. De arriba abajo: qué hacer ahora (un botón
 * grande), la teoría, los temas como pasos numerados y, al final, el examen de
 * la unidad, que es la puerta a la siguiente.
 */
export default function UnidadPage() {
  const router = useRouter();
  const params = useParams();
  const unidadId = Number(params.id);
  const [unidad, setUnidad] = useState<UnidadEstudiante | null>(null);
  const [dash, setDash] = useState<TeoriaData | null>(null);
  const [resueltos, setResueltos] = useState<Set<number>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [yendo, setYendo] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ unidades: UnidadEstudiante[] }>('/unidades').then((r) => setUnidad(r.unidades.find((u) => u.id === unidadId) ?? null)),
      api.get<{ ids: number[] }>('/ejercicios/resueltos').then((r) => setResueltos(new Set(r.ids))).catch(() => undefined),
      api.get<TeoriaData>(`/unidades/${unidadId}/dashboard`).then(setDash).catch(() => undefined),
    ]).catch(() => undefined).finally(() => setCargando(false));
  }, [unidadId]);

  // PRIMERA VISITA a la unidad: la teoría es la puerta de entrada. Después queda
  // accesible desde su tarjeta y no se fuerza (la propia página la marca vista).
  useEffect(() => {
    if (!dash || typeof window === 'undefined') return;
    try {
      if (!localStorage.getItem(`prexi_teoria_vista_u${unidadId}`)) router.replace(`/ejercicios/unidad/${unidadId}/teoria`);
    } catch { /* localStorage inaccesible → no forzar */ }
  }, [dash, unidadId, router]);

  // Arranca la ruta ADAPTATIVA del tema: el backend la ordena y deja los
  // pendientes primero. Se abre el primer ejercicio sin resolver.
  async function iniciar(temaId: number, total: number) {
    if (!total) return;
    setYendo(temaId);
    try {
      const r = await api.get<{ ejercicios: { id: number }[] }>(`/ejercicios/ruta?tema=${temaId}`);
      const pend = r.ejercicios.find((e) => !resueltos.has(e.id)) ?? r.ejercicios[0];
      if (pend) { router.push(`/ejercicios/${pend.id}`); return; }
    } catch { /* sin ruta */ }
    setYendo(null);
  }

  const r = useMemo(() => (unidad ? resumenUnidad(unidad) : null), [unidad]);

  if (cargando) return <div className="space-y-5"><Skeleton className="h-44" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>;

  if (!unidad || !r) return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card py-20 text-center">
      <Layers className="mb-3 h-10 w-10 text-muted" />
      <h2 className="font-display text-lg font-bold text-fg">Unidad no disponible</h2>
      <p className="mt-1 text-sm text-muted">Puede que aún no tenga temas publicados.</p>
      <button onClick={() => router.push('/ejercicios')} className="btn-primary mt-4"><ChevronLeft className="h-4 w-4" /> Volver a las unidades</button>
    </div>
  );

  const color = colorUnidad(unidad.numero);
  const examen = estadoExamen(unidad);
  const sig = r.siguiente;
  const subir = (id: number) => router.push(`/ejercicios/subir-nivel/${id}`);
  // Temas completos pero aún en nivel Básico: lo que falta para el examen.
  const porSubir = temasEnOrden(unidad).filter((t) => t.estado === 'completado' && t.nivel_actual === 'basico');

  return (
    <div className="animate-fade-up">
      <button onClick={() => router.push('/ejercicios')} className="btn-ghost mb-4"><ChevronLeft className="h-4 w-4" /> Todas las unidades</button>

      <UnidadBanner numero={unidad.numero} titulo={unidad.titulo} descripcion={unidad.descripcion} imagenUrl={unidad.imagen_url} color={color}
        footer={
          <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="min-w-[180px] flex-1"><div className="h-2.5 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, backgroundColor: color }} /></div></div>
            <span className="text-sm font-semibold text-fg">{r.completos} <span className="font-normal text-muted">de {r.temas} temas</span></span>
            <span className="text-sm font-semibold text-fg">{r.hechos} <span className="font-normal text-muted">de {r.total} ejercicios</span></span>
          </div>
        } />

      {/* ── Qué hacer ahora: un solo botón grande ── */}
      <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 p-5" style={{ borderColor: examen === 'aprobado' ? '#10B98199' : '#F7C255', backgroundColor: examen === 'aprobado' ? '#10B9810F' : '#F7C2551A' }}>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${examen === 'aprobado' ? 'bg-prexi-green text-white' : 'bg-amber-300 text-amber-900'}`}>
          {examen === 'aprobado' ? <Trophy className="h-6 w-6" /> : examen === 'listo' ? <GraduationCap className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </span>
        <div className="min-w-[220px] flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">Tu siguiente paso</p>
          {examen === 'aprobado' ? (
            <><p className="font-display text-xl font-bold text-fg">¡Unidad aprobada!</p><p className="text-sm text-muted">Puedes repasar cualquier tema o seguir con la siguiente unidad.</p></>
          ) : examen === 'listo' ? (
            <><p className="font-display text-xl font-bold text-fg">Rendir el examen de la unidad</p><p className="text-sm text-muted">Completaste todos los temas. Son 10 preguntas y apruebas con 80 sobre 100.</p></>
          ) : sig ? (
            <><p className="font-display text-xl font-bold text-fg">{sig.ejercicios_completados > 0 ? 'Continuar' : 'Empezar'}: {sig.numero} {sig.titulo}</p><p className="text-sm text-muted">Llevas {sig.ejercicios_completados} de {sig.umbral} ejercicios en este tema.</p></>
          ) : porSubir.length > 0 ? (
            <><p className="font-display text-xl font-bold text-fg">Sube de nivel para llegar al examen</p><p className="text-sm text-muted">Te {porSubir.length === 1 ? 'falta 1 tema' : `faltan ${porSubir.length} temas`} en nivel Intermedio: {porSubir.slice(0, 2).map((t) => t.numero).join(', ')}{porSubir.length > 2 ? '…' : ''}.</p></>
          ) : (
            <><p className="font-display text-xl font-bold text-fg">Sigue practicando</p><p className="text-sm text-muted">Elige un tema de la lista de abajo.</p></>
          )}
        </div>
        {examen === 'aprobado' ? (
          <Link href="/ejercicios" className="btn-primary !px-6 !py-3 text-base">Ver las unidades <ArrowRight className="h-5 w-5" /></Link>
        ) : examen === 'listo' ? (
          <Link href={`/examen-unidad/${unidad.id}`} className="btn-accion text-base">
            <GraduationCap className="h-5 w-5" /> Rendir el examen <ArrowRight className="h-5 w-5" />
          </Link>
        ) : sig ? (
          <button onClick={() => iniciar(sig.id, sig.total_ejercicios_nivel)} disabled={yendo === sig.id}
            className="btn-accion text-base">
            <Play className="h-5 w-5" /> {yendo === sig.id ? 'Abriendo…' : 'Practicar ahora'} <ArrowRight className="h-5 w-5" />
          </button>
        ) : porSubir[0] && porSubir[0].puede_subir ? (
          <button onClick={() => subir(porSubir[0].id)} className="btn-primary !px-6 !py-3 text-base"><TrendingUp className="h-5 w-5" /> Subir de nivel en {porSubir[0].numero}</button>
        ) : null}
      </section>

      {/* ── Teoría ── */}
      {dash && (
        <Link href={`/ejercicios/unidad/${unidadId}/teoria`} className="card card-hover mb-6 flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ color, backgroundColor: `${color}26` }}><BookOpen className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold text-fg">Teoría de la unidad</span>
            <span className="block text-sm text-muted">Para qué sirve, analogías y ejemplos con código.</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold" style={{ color, backgroundColor: `${color}1F` }}>Leer <ArrowRight className="h-4 w-4" /></span>
        </Link>
      )}

      {/* ── Temas, como pasos ── */}
      <h2 className="mb-1 font-display text-xl font-extrabold text-fg">Temas de la unidad</h2>
      <p className="mb-4 text-sm text-muted">Van en orden: al completar uno se abre el siguiente.</p>
      <ol className="space-y-3">
        {unidad.temas.map((t, i) => (
          <li key={t.id}><TemaPaso tema={t} paso={i + 1} unidadId={unidadId} esSiguiente={sig?.id === t.id} siguienteId={sig?.id ?? null} yendo={yendo} onIniciar={iniciar} onSubir={subir} /></li>
        ))}
      </ol>

      {/* ── Examen de la unidad ── */}
      {examen !== 'sin_examen' && (
        <section className={`mt-6 overflow-hidden rounded-3xl border-2 p-6 sm:p-7 ${examen === 'listo' ? 'border-amber-300 bg-amber-300/10' : examen === 'aprobado' ? 'border-prexi-green/50 bg-prexi-green/10' : 'border-line bg-card'}`}>
          <div className="flex flex-wrap items-center gap-5">
            <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl ${examen === 'listo' ? 'bg-amber-300 text-amber-900' : examen === 'aprobado' ? 'bg-prexi-green text-white' : 'bg-prexi-blue/15 text-prexi-blue-deep'}`}>
              {examen === 'aprobado' ? <Trophy className="h-8 w-8" /> : <GraduationCap className="h-8 w-8" />}
            </span>
            <div className="min-w-[220px] flex-1">
              <h2 className="font-display text-2xl font-extrabold text-fg">Examen de la Unidad {unidad.numero}</h2>
              <p className="mt-0.5 text-sm text-muted">10 preguntas que combinan los temas de la unidad. Se aprueba con <b className="text-fg">80 sobre 100</b> y abre la siguiente unidad.</p>
              {examen === 'aprobado' ? (
                <p className="mt-2 flex items-center gap-1.5 font-semibold text-prexi-green"><CheckCircle className="h-5 w-5" /> Lo aprobaste. La siguiente unidad ya está abierta.</p>
              ) : (
                <ul className="mt-3 space-y-1.5 text-sm">
                  <Requisito ok={r.completos === r.temas} texto={`Completar todos los temas (${r.completos} de ${r.temas})`} />
                  <Requisito ok={r.enNivel === r.temas} texto={`Estar en nivel Intermedio o más en cada uno (${r.enNivel} de ${r.temas})`} />
                </ul>
              )}
            </div>
            {examen === 'listo' ? (
              <Link href={`/examen-unidad/${unidad.id}`} className="btn-accion !px-7 !py-4 text-lg">
                <Star className="h-5 w-5" /> Rendir el examen <ArrowRight className="h-5 w-5" />
              </Link>
            ) : examen === 'falta' ? (
              <div className="text-right">
                <Link href={`/examen-unidad/${unidad.id}`} className="btn-ghost !px-5 !py-3 text-base"><Lock className="h-5 w-5" /> Ver el examen</Link>
                <p className="mt-1.5 max-w-[16rem] text-xs text-muted">Si tu docente te lo habilitó, puedes rendirlo desde ahí.</p>
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

function Requisito({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? 'font-semibold text-prexi-green' : 'text-muted'}`}>
      {ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <span className="h-4 w-4 shrink-0 rounded-full border-2 border-line" />} {texto}
    </li>
  );
}

function NivelChip({ tema }: { tema: TemaEstudiante }) {
  const c = NIVEL_COLOR[tema.nivel_actual];
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold" style={{ color: c, backgroundColor: `${c}26` }} title="Tu nivel de dificultad en este tema"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} /> Nivel {tema.nivel_actual_label}</span>;
}

/** Botón principal de un tema o subtema, según su estado. */
function AccionTema({ t, destacado, yendo, onIniciar, pequeno = false }: { t: TemaEstudiante; destacado: boolean; yendo: number | null; onIniciar: (id: number, total: number) => void; pequeno?: boolean }) {
  const tam = pequeno ? '!px-3.5 !py-1.5 text-sm' : '!px-5 !py-2.5';
  if (t.total_ejercicios === 0) return <span className="text-xs italic text-muted">Aún sin ejercicios</span>;
  if (!t.desbloqueado) return <span className="inline-flex items-center gap-1.5 text-sm text-muted"><Lock className="h-4 w-4" /> Bloqueado</span>;
  const abriendo = yendo === t.id;
  if (t.estado === 'completado') {
    return <button onClick={() => onIniciar(t.id, t.total_ejercicios_nivel)} disabled={abriendo} className={`btn-ghost ${tam} disabled:opacity-60`}><RotateCcw className="h-4 w-4" /> {abriendo ? 'Abriendo…' : 'Repasar'}</button>;
  }
  return (
    <button onClick={() => onIniciar(t.id, t.total_ejercicios_nivel)} disabled={abriendo} className={`${destacado ? 'btn-accion !rounded-xl' : 'btn-ghost'} ${tam} disabled:opacity-60`}>
      <Play className="h-4 w-4" /> {abriendo ? 'Abriendo…' : t.ejercicios_completados > 0 ? 'Continuar' : 'Practicar'}
    </button>
  );
}

/** Un tema como paso del recorrido, con sus subtemas debajo. */
function TemaPaso({ tema, paso, unidadId, esSiguiente, siguienteId, yendo, onIniciar, onSubir }: {
  tema: TemaEstudiante; paso: number; unidadId: number; esSiguiente: boolean; siguienteId: number | null; yendo: number | null;
  onIniciar: (id: number, total: number) => void; onSubir: (id: number) => void;
}) {
  const completo = tema.estado === 'completado';
  const bloqueado = !tema.desbloqueado;
  const acento = completo ? '#10B981' : bloqueado ? null : NIVEL_COLOR[tema.nivel_actual];
  const pct = Math.min(100, Math.round((tema.ejercicios_completados / Math.max(1, tema.umbral)) * 100));
  const subtemas = tema.subtemas ?? [];

  return (
    <div className={`rounded-2xl border bg-card p-4 transition sm:p-5 ${esSiguiente ? 'border-2 border-amber-300 shadow-soft' : 'border-line shadow-soft'} ${bloqueado ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg font-extrabold"
          style={acento ? { color: completo ? '#fff' : acento, backgroundColor: completo ? acento : `${acento}26` } : { backgroundColor: 'rgb(var(--subtle))', color: 'rgb(var(--muted))' }}>
          {completo ? <CheckCircle className="h-6 w-6" /> : bloqueado ? <Lock className="h-5 w-5" /> : paso}
        </span>
        <div className="min-w-[200px] flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            Tema {tema.numero}
            {!bloqueado && <NivelChip tema={tema} />}
            {esSiguiente && <span className="chip-accion">Sigue aquí</span>}
            {completo && <span className="font-bold text-prexi-green">Completado</span>}
          </p>
          <h3 className="font-display text-lg font-bold text-fg">{tema.titulo}</h3>
          {bloqueado
            ? <p className="text-sm text-muted">Se abre al completar el tema anterior.</p>
            : tema.total_ejercicios > 0 && (
              <div className="mt-1.5 flex max-w-md items-center gap-3">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-subtle"><span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: acento ?? undefined }} /></span>
                <span className="shrink-0 text-xs font-semibold text-muted">{Math.min(tema.ejercicios_completados, tema.umbral)} de {tema.umbral}</span>
              </div>
            )}
        </div>
        <AccionTema t={tema} destacado={esSiguiente} yendo={yendo} onIniciar={onIniciar} />
      </div>

      {/* Apoyos del tema: flashcards y subir de nivel */}
      {!bloqueado && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-[3.75rem]">
          <BotonFlashcards compacto href={`/flashcards/tema/${tema.id}?volver=/ejercicios/unidad/${unidadId}`} />
          <SubirNivel t={tema} onSubir={onSubir} />
        </div>
      )}

      {subtemas.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-line pt-3 sm:pl-[3.75rem]">
          {subtemas.map((s) => {
            const sOk = s.estado === 'completado';
            const sAcento = sOk ? '#10B981' : s.desbloqueado ? NIVEL_COLOR[s.nivel_actual] : null;
            return (
              <li key={s.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 ${siguienteId === s.id ? 'border-amber-300 bg-amber-300/10' : 'border-line bg-subtle/40'} ${s.desbloqueado ? '' : 'opacity-60'}`}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={sAcento ? { color: sAcento, backgroundColor: `${sAcento}26` } : { backgroundColor: 'rgb(var(--subtle))', color: 'rgb(var(--muted))' }}>
                  {sOk ? <CheckCircle className="h-4 w-4" /> : s.desbloqueado ? <Play className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </span>
                <div className="min-w-[180px] flex-1">
                  <p className="font-semibold text-fg">{s.numero} {s.titulo}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {s.desbloqueado && <NivelChip tema={s} />}
                    {s.total_ejercicios > 0 && <span>{Math.min(s.ejercicios_completados, s.umbral)} de {s.umbral} ejercicios</span>}
                  </p>
                </div>
                <SubirNivel t={s} onSubir={onSubir} />
                <AccionTema t={s} destacado={siguienteId === s.id} yendo={yendo} onIniciar={onIniciar} pequeno />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** "Subir de nivel": visible y llamativo cuando ya se puede; si falta, dice cuánto. */
function SubirNivel({ t, onSubir }: { t: TemaEstudiante; onSubir: (id: number) => void }) {
  if (!t.desbloqueado || t.total_ejercicios === 0) return null;
  if (t.nivel_maximo) return <span className="inline-flex items-center gap-1 rounded-full bg-prexi-green/10 px-3 py-1.5 text-xs font-bold text-prexi-green"><TrendingUp className="h-3.5 w-3.5" /> Nivel máximo</span>;
  if (t.puede_subir && t.nivel_objetivo_label) {
    return (
      <button onClick={() => onSubir(t.id)} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-prexi-blue px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition hover:-translate-y-0.5">
        <TrendingUp className="h-3.5 w-3.5" /> Subir a nivel {t.nivel_objetivo_label}
      </button>
    );
  }
  if (!t.cumple_minimo_nivel && t.total_ejercicios_nivel > 0) {
    return <span className="text-xs text-muted">Te {t.faltan_nivel === 1 ? 'falta 1 ejercicio' : `faltan ${t.faltan_nivel} ejercicios`} para poder subir de nivel</span>;
  }
  return null;
}
