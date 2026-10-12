'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { colorUnidad } from '@/lib/types';
import { CodeBlock } from '@/components/code-block';
import { ProgressHeader } from '@/components/pretest/progress-header';
import { ExamTimer } from '@/components/pretest/exam-timer';
import { OptionCard } from '@/components/pretest/option-card';
import { QuestionNavigator } from '@/components/pretest/question-navigator';
import { Bot, ChevronLeft, ChevronRight, CheckCircle, GraduationCap } from '@/components/icons';

/**
 * DIAGNÓSTICO INICIAL (pretest). METODOLOGÍA: mide el nivel de ENTRADA en crudo.
 * Por eso NUNCA se muestra un repaso previo con flashcards aquí (un repaso
 * formativo invalidaría la medición del estudio). El control vive en
 * `lib/flashcards.ts` → `mostrarRepasoPrevio.pretest = false`; esta pantalla no
 * importa ni invoca flashcards de forma deliberada.
 */
interface Pregunta {
  id: number; categoria: string; estrellas: number; tipo: string;
  enunciado: string; codigoPython: string | null;
  opciones: { id: string; texto: string }[]; opcion_guardada: string | null;
  tema: { numero: string; titulo: string; unidad: number } | null;
}
const DURACION = 25 * 60;
const dos = (n: number) => String(n).padStart(2, '0');

export default function PretestPage() {
  const { usuario, refrescar } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [idx, setIdx] = useState(0);
  const [resp, setResp] = useState<Record<number, string>>({});
  const [seg, setSeg] = useState(DURACION);
  const [cargando, setCargando] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [errorFin, setErrorFin] = useState('');
  const yaFin = useRef(false);
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (usuario && usuario.rol !== 'estudiante') { router.replace('/dashboard'); return; }
    if (usuario && usuario.estadoInscripcion && usuario.estadoInscripcion !== 'aprobada') { router.replace('/inscripcion'); return; }
    api.get<{ completado: boolean }>('/pretest/estado').then(async (e) => {
      if (e.completado) { router.replace('/pretest/resultado'); return; }
      // Gate: el diagnóstico solo se habilita tras revisar la introducción.
      const intro = await api.get<{ completada: boolean }>('/introduccion/estado').catch(() => ({ completada: true }));
      if (!intro.completada) { router.replace('/introduccion'); return; }
      api.get<{ preguntas: Pregunta[] }>('/pretest/preguntas').then((r) => {
        setPreguntas(r.preguntas);
        const ini: Record<number, string> = {};
        r.preguntas.forEach((p) => { if (p.opcion_guardada) ini[p.id] = p.opcion_guardada; });
        setResp(ini);
      }).finally(() => setCargando(false));
    }).catch(() => setCargando(false));
  }, [usuario, router]);

  const finalizar = useCallback(async () => {
    if (yaFin.current) return; yaFin.current = true; setFinalizando(true); setErrorFin('');
    try {
      await api.post('/pretest/finalizar', { tiempoSeg: DURACION - seg });
      await refrescar();
      router.replace('/pretest/resultado');
    } catch (err) {
      // El backend rechaza un examen en blanco: mostramos el motivo y dejamos seguir.
      setErrorFin(err instanceof ApiError ? err.message : 'No se pudo finalizar. Intenta de nuevo.');
      setFinalizando(false); yaFin.current = false;
    }
  }, [refrescar, router, seg]);

  // Finalización manual (botón): confirma si quedan preguntas sin responder.
  const finalizarManual = useCallback(() => {
    const sinResponder = preguntas.filter((q) => !resp[q.id]).length;
    if (sinResponder === preguntas.length) {
      setErrorFin('Responde al menos una pregunta antes de finalizar el pretest.');
      return;
    }
    if (sinResponder > 0 && !window.confirm(`Te faltan ${sinResponder} pregunta(s) sin responder. ¿Deseas finalizar de todos modos?`)) return;
    finalizar();
  }, [preguntas, resp, finalizar]);

  useEffect(() => {
    if (cargando) return;
    if (seg <= 0) { finalizar(); return; }
    const t = setInterval(() => setSeg((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [seg, cargando, finalizar]);

  const elegir = useCallback((op: string) => {
    const p = preguntas[idx];
    if (!p) return;
    setResp((r) => ({ ...r, [p.id]: op }));
    api.post('/pretest/responder', { ejercicioId: p.id, opcion: op }).catch(() => undefined);
  }, [preguntas, idx]);

  const answeredSet = useMemo(() => {
    const s = new Set<number>();
    preguntas.forEach((q, i) => { if (resp[q.id]) s.add(i); });
    return s;
  }, [preguntas, resp]);

  if (cargando) return <div className="grid min-h-screen place-items-center bg-app"><div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-prexi-blue" /></div>;
  if (!preguntas.length) return <div className="grid min-h-screen place-items-center bg-app text-muted">No hay preguntas disponibles.</div>;

  const p = preguntas[idx];
  const total = preguntas.length;
  const respondidas = answeredSet.size;
  const seleccion = resp[p.id];
  const acento = p.tema ? colorUnidad(p.tema.unidad) : 'rgb(var(--accent))';
  const seleccionIdx = p.opciones.findIndex((o) => o.id === seleccion);

  // Teclado dentro del radiogroup: flechas mueven la selección; A/B/C/D eligen directo.
  const onKeyOpciones = (e: React.KeyboardEvent) => {
    const n = p.opciones.length;
    const foco = (i: number) => { elegir(p.opciones[i].id); optRefs.current[i]?.focus(); };
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); foco(seleccionIdx < 0 ? 0 : (seleccionIdx + 1) % n); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); foco(seleccionIdx <= 0 ? n - 1 : seleccionIdx - 1); }
    else {
      const i = e.key.toUpperCase().charCodeAt(0) - 65; // A=0, B=1, …
      if (i >= 0 && i < n) { e.preventDefault(); foco(i); }
    }
  };

  const trans = reduce ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' as const };

  return (
    <div className="min-h-screen bg-app text-fg">
      {/* Cabecera fija: título + progreso + temporizador con urgencia */}
      <header className="sticky top-0 z-10 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <div className="flex shrink-0 items-center gap-2 font-display font-extrabold text-fg">
            <GraduationCap className="h-6 w-6 text-prexi-blue-deep" /> <span className="hidden sm:inline">Diagnóstico inicial</span>
          </div>
          <div className="mx-2 hidden flex-1 sm:block"><ProgressHeader index={idx} total={total} answered={respondidas} /></div>
          <ExamTimer seconds={seg} />
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-5 lg:grid-cols-3">
        {/* Columna principal: pregunta + opciones */}
        <div className="lg:col-span-2">
          <div className="card">
            {/* Progreso también en móvil (la cabecera lo oculta) */}
            <div className="mb-4 sm:hidden"><ProgressHeader index={idx} total={total} answered={respondidas} /></div>

            {/* Transición de pregunta: al cambiar `key`, el bloque se remonta y
                anima su ENTRADA (fade + slide). Sin AnimatePresence/exit para
                evitar bloqueos de la animación de salida. */}
            <div>
              <motion.div key={p.id}
                initial={{ opacity: 0, x: reduce ? 0 : 24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={trans}>
                {/* Contexto (color de unidad) + numeración tabular */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
                    style={{ color: acento, backgroundColor: p.tema ? `${acento}1F` : 'rgb(var(--accent) / 0.12)' }}>
                    {p.tema ? `U${p.tema.unidad} · ${p.tema.numero} ${p.tema.titulo}` : p.categoria}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-muted">{dos(idx + 1)} / {dos(total)}</span>
                </div>

                {/* Pregunta: el elemento más legible */}
                <h1 className="text-xl font-semibold leading-snug text-fg sm:text-2xl">{p.enunciado}</h1>
                {p.codigoPython && <div className="mt-4"><CodeBlock code={p.codigoPython} /></div>}

                {/* Opciones (radiogroup con teclado A/B/C/D + flechas) */}
                <div
                  role="radiogroup" aria-label="Opciones de respuesta" onKeyDown={onKeyOpciones}
                  className="mt-5 grid gap-3 sm:grid-cols-2">
                  {p.opciones.map((o, i) => (
                    <OptionCard key={o.id}
                      ref={(el) => { optRefs.current[i] = el; }}
                      letra={String.fromCharCode(65 + i)}
                      texto={o.texto}
                      selected={seleccion === o.id}
                      tabbable={seleccionIdx < 0 ? i === 0 : seleccion === o.id}
                      onSelect={() => elegir(o.id)} />
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Navegación inferior */}
            <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
              <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
                className="btn-ghost disabled:opacity-40 disabled:hover:bg-card"><ChevronLeft className="h-4 w-4" /> Anterior</button>
              {idx < total - 1 ? (
                <button onClick={() => setIdx((i) => i + 1)} className="btn-primary hover:scale-[1.02]">Siguiente <ChevronRight className="h-4 w-4" /></button>
              ) : (
                // Confirmación: verde con texto oscuro (contraste AA), no el acento azul.
                <button onClick={finalizarManual} disabled={finalizando}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-prexi-green px-5 py-2.5 font-semibold text-[#04160c] shadow-lift transition hover:scale-[1.02] hover:brightness-105 active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100">
                  {finalizando ? 'Calculando…' : <>Finalizar y enviar <CheckCircle className="h-4 w-4" /></>}
                </button>
              )}
            </div>
            {errorFin && <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-500">{errorFin}</p>}
          </div>
        </div>

        {/* Lateral: navegador de preguntas + aviso */}
        <aside className="space-y-4">
          <div className="card">
            <h3 className="mb-3 font-display text-sm font-bold text-fg">Preguntas</h3>
            <QuestionNavigator total={total} current={idx} answered={answeredSet} onJump={setIdx} />
          </div>
          <div className="card flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-subtle text-muted"><Bot className="h-5 w-5" /></div>
            <div>
              <p className="text-sm text-muted"><b className="text-fg">Examen sin ayuda de IA</b>: PREXI está deshabilitado para medir tu nivel real.</p>
              <p className="mt-1 text-xs text-muted">Puedes volver a cualquier pregunta y cambiar tu respuesta antes de finalizar.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
