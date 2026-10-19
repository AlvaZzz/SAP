'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Markdown } from '@/components/markdown';
import { CodeBlock } from '@/components/code-block';
import { BotonVoz } from '@/components/boton-voz';
import { Mazo } from '@/components/flashcards/mazo';
import { CabeceraPregunta, Enunciado } from '@/components/ejercicios/pregunta';
import { OptionCard } from '@/components/pretest/option-card';
import { VistaEjercicio } from '@/components/ejercicios';
import type { Ejercicio } from '@/lib/types';
import { QuestionNavigator } from '@/components/pretest/question-navigator';
import { fetchFlashcardsExamen, mostrarRepasoPrevio, type Flashcard } from '@/lib/flashcards';
import { colorUnidad } from '@/lib/types';
import { reproducir } from '@/lib/sonidos';
import { GraduationCap, BookOpen, CheckCircle, Check, ArrowRight, ChevronLeft, ChevronRight, Lock, Award, TrendingUp, Sparkles } from '@/components/icons';

// `repaso_previo`: repaso OPCIONAL con flashcards justo antes del examen (omitible).
type Fase = 'cargando' | 'repaso' | 'listo' | 'repaso_previo' | 'examen' | 'resultado' | 'bloqueado';
type Nivel = 'basico' | 'intermedio' | 'avanzado';

interface Estado {
  unidad: { id: number; numero: number; titulo: string };
  repaso_revisado: boolean; aprobado: boolean; hay_banco: boolean;
  total_preguntas: number; puede_intentar: boolean; en_cooldown: boolean; cooldown_hasta: string | null;
  /** Cierre de unidad: temas completos + dominio >= Intermedio. Null si ya cumple. */
  motivo_bloqueo: string | null;
  requisitos: {
    temas_total: number; temas_completos: number; temas_pendientes: string[]; temas_ok: boolean;
    dominio_pct: number; nivel_dominio_label: string; nivel_ok: boolean; nivel_requerido_label: string;
  };
  ultimo_intento: { nivel: Nivel; nivel_label: string; puntaje: number; aprobado: boolean; fecha: string } | null;
}
interface RepasoTema { id: number; numero: string; titulo: string; repaso: string | null; descripcion: string | null }
interface Pregunta { id: number; categoria: string; estrellas: number; tipo: string; enunciado: string; codigoPython: string | null; opciones: { id: string; texto: string }[] }
interface Resultado { aprobado: boolean; puntaje: number; correctos: number; parciales: number; total: number; nota_aprobacion: number; nivel: Nivel; nivel_label: string; requiere_nivel_label: string; temas_reforzar: string[] }

const COLOR_NIVEL: Record<Nivel, string> = { basico: '#F59E0B', intermedio: '#3B82F6', avanzado: '#10B981' };

export default function ExamenUnidadPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const params = useParams();
  const unidadId = Number(params.id);

  const [fase, setFase] = useState<Fase>('cargando');
  const [estado, setEstado] = useState<Estado | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Repaso
  const [temas, setTemas] = useState<RepasoTema[]>([]);
  const [activa, setActiva] = useState(0);
  const [leidos, setLeidos] = useState<Set<number>>(new Set([0]));

  // Examen
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [idx, setIdx] = useState(0);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // Repaso previo OPCIONAL con flashcards (solo para el examen de unidad).
  const [cardsPrevio, setCardsPrevio] = useState<Flashcard[]>([]);

  const cargarEstado = useCallback(async () => {
    try {
      const e = await api.get<Estado>(`/examen-unidad/${unidadId}/estado`);
      setEstado(e);
      if (e.aprobado) { setFase('bloqueado'); setMensaje('Ya aprobaste el examen de esta unidad. ¡La siguiente ya está desbloqueada!'); return; }
      if (!e.hay_banco) { setFase('bloqueado'); setMensaje('Esta unidad aún no tiene un examen configurado por tu docente.'); return; }
      if (!e.repaso_revisado) {
        const r = await api.get<{ temas: RepasoTema[] }>(`/examen-unidad/${unidadId}/repaso`);
        setTemas(r.temas);
        setFase('repaso');
        return;
      }
      // Cierre de unidad: el estudiante ve QUÉ le falta aquí, no al pulsar
      // "Iniciar". El backend rechaza igual (ver ExamenUnidadService.iniciar);
      // esto solo evita que el bloqueo se descubra a golpe de botón.
      if (e.motivo_bloqueo) { setFase('bloqueado'); setMensaje(e.motivo_bloqueo); return; }
      setFase('listo');
    } catch {
      setFase('bloqueado'); setMensaje('No se pudo cargar el examen de la unidad.');
    }
  }, [unidadId]);

  useEffect(() => {
    if (usuario && usuario.rol !== 'estudiante') { router.replace('/dashboard'); return; }
    if (!Number.isFinite(unidadId)) { router.replace('/dashboard'); return; }
    cargarEstado();
  }, [usuario, router, unidadId, cargarEstado]);

  // ── Repaso ──
  const abrir = useCallback((i: number) => { setActiva(i); setLeidos((s) => new Set(s).add(i)); }, []);
  const completarRepaso = useCallback(async () => {
    setEnviando(true); setError('');
    try { await api.post(`/examen-unidad/${unidadId}/repaso/completar`, {}); setFase('listo'); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo continuar.'); }
    finally { setEnviando(false); }
  }, [unidadId]);

  // ── Examen ──
  const iniciar = useCallback(async () => {
    setEnviando(true); setError('');
    try {
      const r = await api.get<{ preguntas: Pregunta[] }>(`/examen-unidad/${unidadId}/iniciar`);
      setPreguntas(r.preguntas); setIdx(0); setResp({}); setFase('examen');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo iniciar el examen.'); }
    finally { setEnviando(false); }
  }, [unidadId]);

  /**
   * "Comenzar examen": si el REPASO PREVIO está activado para este tipo de examen
   * (examen_unidad ✅), muestra primero un mazo de flashcards OMITIBLE de los temas
   * más débiles; si no, arranca el examen directo. El repaso no puntúa ni cronometra.
   * (El pretest tiene `mostrarRepasoPrevio.pretest = false` → jamás llega aquí.)
   */
  const comenzar = useCallback(async () => {
    if (!mostrarRepasoPrevio.examen_unidad) { iniciar(); return; }
    setEnviando(true); setError('');
    try {
      const r = await fetchFlashcardsExamen(unidadId, 12);
      setCardsPrevio(r.flashcards);
    } catch { setCardsPrevio([]); }
    finally { setEnviando(false); setFase('repaso_previo'); }
  }, [unidadId, iniciar]);

  const enviar = useCallback(async () => {
    setEnviando(true); setError('');
    try {
      const respuestas = preguntas.map((p) => ({ ejercicioId: p.id, respuesta: resp[p.id] ?? '' }));
      const r = await api.post<{ resultado: Resultado }>(`/examen-unidad/${unidadId}/evaluar`, { respuestas });
      setResultado(r.resultado); setFase('resultado');
      // Unidad completada (examen aprobado): sonido de celebración.
      if (r.resultado.aprobado) reproducir('unidad', usuario?.sonidosActivados ?? true);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo enviar el examen.'); setEnviando(false); }
  }, [preguntas, resp, unidadId, usuario?.sonidosActivados]);

  const enviarManual = useCallback(() => {
    const sinResponder = preguntas.filter((q) => !resp[q.id]).length;
    if (sinResponder === preguntas.length) { setError('Responde al menos una pregunta antes de enviar.'); return; }
    if (sinResponder > 0 && !window.confirm(`Te faltan ${sinResponder} pregunta(s). ¿Enviar de todos modos?`)) return;
    enviar();
  }, [preguntas, resp, enviar]);

  // ── Render ──
  if (fase === 'cargando') return <div className="grid min-h-screen place-items-center bg-app"><div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-prexi-blue" /></div>;

  if (fase === 'bloqueado') return (
    <div className="grid min-h-screen place-items-center bg-app p-6 text-center">
      <div className="card max-w-md">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-prexi-blue/10 text-prexi-blue-deep">{estado?.aprobado ? <CheckCircle className="h-7 w-7" /> : <Lock className="h-7 w-7" />}</div>
        <h1 className="text-xl font-bold text-fg">Examen de la Unidad {estado?.unidad.numero}</h1>
        <p className="mt-2 text-sm text-muted">{mensaje}</p>
        <button onClick={() => router.push('/ejercicios')} className="btn-primary mt-5">Volver a Mi Ruta</button>
      </div>
    </div>
  );

  const u = estado!.unidad;
  const header = (sub: string) => (
    <header className="sticky top-0 z-10 border-b border-line bg-card">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
        <div className="flex items-center gap-2 font-extrabold text-fg"><GraduationCap className="h-6 w-6 text-prexi-blue-deep" /> Examen · Unidad {u.numero}</div>
        <span className="ml-auto text-xs font-semibold text-muted">{sub}</span>
      </div>
    </header>
  );

  // ── Fase REPASO ──
  if (fase === 'repaso') {
    const todos = leidos.size >= temas.length;
    const t = temas[activa];
    return (
      <div className="min-h-screen bg-app">
        {header(`${leidos.size} de ${temas.length} temas repasados`)}
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="mb-4 rounded-xl border border-prexi-blue/20 bg-prexi-blue/5 p-4 text-sm text-muted">
            <b className="text-fg">Repaso de la Unidad {u.numero}: {u.titulo}.</b> Revisa los temas antes de rendir el examen que te permitirá avanzar.
          </div>
          {temas.length === 0 ? (
            <p className="card text-center text-sm text-muted">Esta unidad no tiene temas con repaso. Puedes continuar al examen.</p>
          ) : (
            <>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {temas.map((tm, i) => {
                  const leido = leidos.has(i); const sel = i === activa;
                  return (
                    <button key={tm.id} onClick={() => abrir(i)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${sel ? 'border-prexi-blue bg-prexi-blue text-white' : 'border-line bg-card text-muted hover:border-prexi-blue/40'}`}>
                      <span className={`grid h-5 w-5 place-items-center rounded-full text-2xs ${sel ? 'bg-white/25' : leido ? 'bg-prexi-green/15 text-prexi-green' : 'bg-subtle text-muted'}`}>{leido && !sel ? <Check className="h-3 w-3" /> : i + 1}</span>
                      {tm.numero}
                    </button>
                  );
                })}
              </div>
              <article className="card animate-fade-up">
                <div className="mb-3 flex flex-wrap items-start gap-3 border-b border-line pb-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-prexi-blue/10 text-prexi-blue-deep"><BookOpen className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-prexi-blue-deep">Tema {t.numero}</p><h1 className="text-lg font-extrabold text-fg">{t.titulo}</h1></div>
                  {/* Escuchar el repaso del tema (accesibilidad) */}
                  {t.repaso && <BotonVoz texto={`Tema ${t.numero}. ${t.titulo}. ${t.repaso}`} variante="boton" className="shrink-0" />}
                </div>
                {t.repaso ? <Markdown content={t.repaso} /> : <p className="py-4 text-sm text-muted">{t.descripcion || 'Sin repaso para este tema.'}</p>}
              </article>
            </>
          )}
          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button onClick={() => abrir(Math.max(0, activa - 1))} disabled={activa === 0} className="btn-ghost disabled:opacity-40">Anterior</button>
              <button onClick={() => abrir(Math.min(temas.length - 1, activa + 1))} disabled={activa >= temas.length - 1} className="btn-ghost disabled:opacity-40">Siguiente <ArrowRight className="h-4 w-4" /></button>
            </div>
            <button onClick={completarRepaso} disabled={(temas.length > 0 && !todos) || enviando} className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-50">
              {enviando ? 'Preparando…' : (temas.length === 0 || todos) ? <>He repasado, continuar al examen <CheckCircle className="h-4 w-4" /></> : <><Lock className="h-4 w-4" /> Repasa los {temas.length} temas</>}
            </button>
          </div>
          {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Fase LISTO (arrancar examen) ──
  if (fase === 'listo') return (
    <div className="grid min-h-screen place-items-center bg-app p-6 text-center">
      <div className="card max-w-md">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-prexi-blue/10 text-prexi-blue-deep"><GraduationCap className="h-7 w-7" /></div>
        <h1 className="text-xl font-bold text-fg">Examen de la Unidad {u.numero}</h1>
        <p className="mt-2 text-sm text-muted">Son {estado!.total_preguntas} preguntas que combinan los temas de la unidad. Se califica sobre 100 y necesitas <b className="text-fg">80 o más</b> para pasar a la siguiente unidad. Sin ayuda de IA, y una vez enviada una respuesta no se puede corregir.</p>
        {estado!.ultimo_intento && !estado!.ultimo_intento.aprobado && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-600">Intento anterior: {estado!.ultimo_intento.puntaje}/100. Necesitas 80. ¡Tú puedes!</p>
        )}
        {estado!.en_cooldown
          ? <p className="mt-4 rounded-lg bg-subtle px-3 py-2 text-sm text-muted">Debes esperar antes de reintentar. Vuelve más tarde.</p>
          : <button onClick={comenzar} disabled={enviando} className="btn-primary mt-5 w-full justify-center">{enviando ? 'Cargando…' : <>Comenzar examen <ArrowRight className="h-4 w-4" /></>}</button>}
        <button onClick={() => router.push('/ejercicios')} className="btn-ghost mt-2 w-full justify-center">Volver a Mi Ruta</button>
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );

  // ── Fase REPASO PREVIO (flashcards, OMITIBLE) ──
  if (fase === 'repaso_previo') {
    return (
      <div className="min-h-screen bg-app">
        {header('Repaso rápido (opcional)')}
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-prexi-blue/20 bg-prexi-blue/5 p-4 text-sm text-muted">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" />
            <span><b className="text-fg">Repaso rápido con flashcards (opcional).</b> Unas tarjetas de los temas que más conviene reforzar antes del examen. No puntúa, no cronometra y puedes omitirlo.</span>
          </div>
          {cardsPrevio.length > 0
            ? <Mazo cards={cardsPrevio} color={colorUnidad(u.numero)} titulo={`Repaso · Unidad ${u.numero}`} scope={`examen-${unidadId}`} onSalir={iniciar} />
            : <p className="card text-center text-sm text-muted">No hay flashcards disponibles para esta unidad. Puedes comenzar el examen.</p>}
          {/* "Omitir repaso" SIEMPRE visible: no se obliga a pasar por todas las tarjetas. */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button onClick={iniciar} disabled={enviando} className="btn-primary justify-center">{enviando ? 'Cargando…' : <>Empezar examen <ArrowRight className="h-4 w-4" /></>}</button>
            <button onClick={iniciar} disabled={enviando} className="btn-ghost justify-center">Omitir repaso</button>
          </div>
          {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Fase RESULTADO ──
  if (fase === 'resultado' && resultado) {
    const aprob = resultado.aprobado;
    return (
      <div className="grid min-h-screen place-items-center bg-app p-4">
        <div className="card w-full max-w-lg animate-fade-up text-center">
          <div className={`mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full text-white`} style={{ backgroundColor: aprob ? '#10B981' : '#F59E0B' }}>{aprob ? <Award className="h-8 w-8" /> : <TrendingUp className="h-8 w-8" />}</div>
          <h1 className="text-2xl font-extrabold text-fg">{aprob ? '¡Unidad aprobada!' : 'Aún no lo logras'}</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {aprob
              ? <>Sacaste <b className="text-fg">{resultado.puntaje} sobre 100</b>. La siguiente unidad ya está desbloqueada.</>
              : <>Sacaste <b className="text-fg">{resultado.puntaje} sobre 100</b> y se aprueba con {resultado.nota_aprobacion}. Refuerza los temas de abajo y vuelve a intentarlo.</>}
          </p>
          <div className="my-5 flex items-center justify-center gap-6">
            <div><p className="text-3xl font-extrabold" style={{ color: aprob ? '#10B981' : '#F59E0B' }}>{resultado.puntaje}<span className="text-base font-semibold text-muted">/100</span></p><p className="text-xs text-muted">tu nota</p></div>
            <div><p className="text-3xl font-extrabold text-fg">{resultado.correctos}/{resultado.total}</p><p className="text-xs text-muted">correctas</p></div>
            {resultado.parciales > 0 && <div><p className="text-3xl font-extrabold text-fg">{resultado.parciales}</p><p className="text-xs text-muted">a medias</p></div>}
          </div>
          {!aprob && resultado.temas_reforzar.length > 0 && (
            <div className="mb-4 rounded-xl bg-amber-500/10 p-4 text-left">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-amber-600"><TrendingUp className="h-4 w-4" /> Temas a reforzar</h3>
              <ul className="space-y-1 text-sm text-muted">{resultado.temas_reforzar.map((t) => <li key={t}>• {t}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {aprob
              ? <button onClick={() => router.push('/ejercicios')} className="btn-primary w-full sm:w-auto">Continuar a la siguiente unidad <ArrowRight className="h-4 w-4" /></button>
              : <>
                  <button onClick={() => { setResultado(null); cargarEstado(); }} className="btn-ghost w-full sm:w-auto">Repasar de nuevo</button>
                  <button onClick={iniciar} disabled={enviando} className="btn-primary w-full sm:w-auto">{enviando ? 'Cargando…' : 'Reintentar examen'}</button>
                </>}
          </div>
        </div>
      </div>
    );
  }

  // ── Fase EXAMEN ──
  if (fase === 'examen') {
    if (!preguntas.length) return <div className="grid min-h-screen place-items-center bg-app text-muted">No hay preguntas disponibles.</div>;
    const p = preguntas[idx]; const total = preguntas.length;
    const respondidas = preguntas.filter((q) => resp[q.id]).length;
    return (
      <div className="min-h-screen bg-app">
        {header(`${respondidas} de ${total} respondidas`)}
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${(respondidas / total) * 100}%` }} /></div>
            <div className="card">
              <CabeceraPregunta numero={idx + 1} total={total} tipo={p.tipo} tema={p.categoria} />
              <Enunciado tipo={p.tipo}>{p.enunciado}</Enunciado>
              {p.codigoPython && <div className="mb-5"><CodeBlock code={p.codigoPython} /></div>}
              {/* Las preguntas sin opciones (completar u ordenar) se responden como en la práctica. */}
              {p.tipo === 'completar_codigo' ? (
                <input value={resp[p.id] ?? ''} onChange={(e) => setResp((r) => ({ ...r, [p.id]: e.target.value }))}
                  placeholder="Escribe la línea o el valor que falta" aria-label="Tu respuesta" className="input font-mono text-sm" />
              ) : p.tipo === 'ordenar_lineas' ? (
                <VistaEjercicio key={p.id} ejercicio={p as unknown as Ejercicio} resultado={null}
                  onChange={(v) => setResp((r) => ({ ...r, [p.id]: v ?? '' }))} />
              ) : (
                <div role="radiogroup" aria-label="Opciones de respuesta" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {p.opciones.map((o, i) => (
                    <OptionCard key={o.id} letra={o.id} texto={o.texto} selected={resp[p.id] === o.id}
                      tabbable={resp[p.id] ? resp[p.id] === o.id : i === 0}
                      onSelect={() => setResp((r) => ({ ...r, [p.id]: o.id }))} />
                  ))}
                </div>
              )}
              <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
                <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="btn-ghost disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Anterior</button>
                {idx < total - 1
                  ? <button onClick={() => setIdx((i) => i + 1)} className="btn-primary">Siguiente <ChevronRight className="h-4 w-4" /></button>
                  : <button onClick={enviarManual} disabled={enviando} className="btn-primary disabled:opacity-60">{enviando ? 'Calculando…' : <>Enviar examen <CheckCircle className="h-4 w-4" /></>}</button>}
              </div>
              {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
            </div>
          </div>

          {/* Mapa del examen: saltar a cualquier pregunta y ver cuáles faltan */}
          <aside className="space-y-4">
            <div className="card">
              <h2 className="mb-3 font-display text-sm font-bold text-fg">Tus preguntas</h2>
              <QuestionNavigator total={total} current={idx} onJump={setIdx}
                answered={new Set(preguntas.map((q, i) => (resp[q.id] ? i : -1)).filter((i) => i >= 0))} />
            </div>
            <div className="card text-sm text-muted">
              <p><b className="text-fg">Se aprueba con 80 sobre 100.</b> Puedes volver a cualquier pregunta y cambiar tu respuesta antes de enviar.</p>
              {respondidas < total && <p className="mt-2 font-semibold text-prexi-amber">Te faltan {total - respondidas} por responder.</p>}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return null;
}
