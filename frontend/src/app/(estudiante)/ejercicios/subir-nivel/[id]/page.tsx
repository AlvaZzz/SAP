'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { api, ApiError } from '@/lib/api';
import { Ejercicio, Opcion } from '@/lib/types';
import { CodeViewer } from '@/components/code-viewer';
import { CabeceraPregunta, Enunciado } from '@/components/ejercicios/pregunta';
import { OptionCard } from '@/components/pretest/option-card';
import { Skeleton } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { reproducir } from '@/lib/sonidos';
import { ChevronLeft, ChevronUp, ChevronDown, GripVertical, TrendingUp, CheckCircle, X, ArrowRight, RotateCcw } from '@/components/icons';

interface MiniDiag {
  tema: { id: number; numero: string; titulo: string };
  nivel_actual_label: string; nivel_objetivo_label: string;
  umbral: number; total: number; preguntas: Ejercicio[];
}
interface ResultadoSubida {
  aprobado: boolean; puntaje: number; umbral: number; correctos: number; total: number;
  nivel_anterior_label: string; nivel_actual_label: string;
}

function barajar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * MINI-DIAGNÓSTICO para SUBIR DE NIVEL en un tema (sin ayuda de PREXI). Presenta
 * preguntas del NIVEL OBJETIVO; con ≥ umbral (por defecto 80%) el estudiante sube
 * de nivel en ese tema. El resultado se calcula y persiste en el backend.
 */
export default function SubirNivelPage() {
  const router = useRouter();
  const { usuario } = useAuth();
  const temaId = Number(useParams().id);

  const [diag, setDiag] = useState<MiniDiag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  const [ordenables, setOrdenables] = useState<Record<number, Opcion[]>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSubida | null>(null);

  useEffect(() => {
    api.get<MiniDiag>(`/ejercicios/subir-nivel?tema=${temaId}`)
      .then((d) => {
        setDiag(d);
        // Prepara el estado de las preguntas de tipo "ordenar_lineas".
        const ord: Record<number, Opcion[]> = {};
        d.preguntas.forEach((p) => { if (p.tipo === 'ordenar_lineas') ord[p.id] = barajar(p.opciones); });
        setOrdenables(ord);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo iniciar el mini-diagnóstico.'))
      .finally(() => setCargando(false));
  }, [temaId]);

  function moverLinea(ejId: number, i: number, dir: -1 | 1) {
    setOrdenables((prev) => {
      const arr = [...(prev[ejId] ?? [])];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return prev;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...prev, [ejId]: arr };
    });
  }

  const respondidas = diag ? diag.preguntas.filter((p) =>
    p.tipo === 'ordenar_lineas' ? (ordenables[p.id]?.length ?? 0) > 0 : (respuestas[p.id]?.trim().length ?? 0) > 0,
  ).length : 0;
  const todasListas = diag ? respondidas === diag.preguntas.length : false;

  async function enviar() {
    if (!diag || !todasListas || enviando) return;
    setEnviando(true);
    const payload = diag.preguntas.map((p) => ({
      ejercicioId: p.id,
      respuesta: p.tipo === 'ordenar_lineas' ? (ordenables[p.id] ?? []).map((o) => o.id).join(',') : (respuestas[p.id] ?? ''),
    }));
    try {
      const r = await api.post<ResultadoSubida>('/ejercicios/subir-nivel', { temaId, respuestas: payload });
      setResultado(r);
      if (r.aprobado) {
        // Subida de nivel (Básico → Intermedio → Avanzado): confeti + sonido.
        reproducir('nivel', usuario?.sonidosActivados ?? true);
        confetti({ particleCount: 140, spread: 100, origin: { y: 0.5 }, colors: ['#3B82F6', '#10B981', '#F59E0B'] });
      }
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Error al enviar el mini-diagnóstico.');
    } finally { setEnviando(false); }
  }

  if (cargando) return <div className="space-y-4"><Skeleton className="h-20" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div>;

  if (error) return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-card py-20 text-center">
      <TrendingUp className="mb-3 h-10 w-10 text-muted" />
      <h2 className="font-display text-lg font-bold text-fg">No disponible</h2>
      <p className="mt-1 max-w-sm text-sm text-muted">{error}</p>
      <button onClick={() => router.back()} className="btn-primary mt-4"><ChevronLeft className="h-4 w-4" /> Volver</button>
    </div>
  );

  if (!diag) return null;

  if (resultado) return (
    <div className="mx-auto max-w-xl animate-fade-up">
      <div className={`card text-center border-t-4 ${resultado.aprobado ? 'border-t-prexi-green' : 'border-t-prexi-amber'}`}>
        <div className={`mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full ${resultado.aprobado ? 'bg-prexi-green/10 text-prexi-green' : 'bg-prexi-amber/10 text-prexi-amber'}`}>
          {resultado.aprobado ? <TrendingUp className="h-7 w-7" /> : <RotateCcw className="h-7 w-7" />}
        </div>
        <h1 className="font-display text-2xl font-extrabold text-fg">
          {resultado.aprobado ? '¡Subiste de nivel!' : 'Aún no lo logras'}
        </h1>
        <p className="mx-auto mt-1 max-w-md text-muted">
          Acertaste {resultado.correctos} de {resultado.total} ({resultado.puntaje}%). Necesitas {resultado.umbral}% para subir.
        </p>
        <div className="my-5 inline-flex items-center gap-3 rounded-xl bg-subtle px-4 py-3">
          <span className="text-sm font-semibold text-muted">{resultado.nivel_anterior_label}</span>
          <ArrowRight className="h-4 w-4 text-muted" />
          <span className={`text-sm font-extrabold ${resultado.aprobado ? 'text-prexi-green' : 'text-fg'}`}>{resultado.nivel_actual_label}</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {!resultado.aprobado && <button onClick={() => { setResultado(null); setRespuestas({}); }} className="btn-ghost">Reintentar más tarde</button>}
          <button onClick={() => router.push(`/ejercicios/unidad/${diag.tema.id}`)} className="btn-ghost">Ver el tema</button>
          <button onClick={() => router.push('/ejercicios')} className="btn-primary">Ir a las unidades <ArrowRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-up">
      {/* Encabezado */}
      <div className="card mb-6 border-l-4 border-l-prexi-navy">
        <button onClick={() => router.back()} className="btn-ghost mb-2 -ml-2"><X className="h-4 w-4" /> Cancelar</button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-prexi-navy/10 px-2.5 py-1 text-2xs font-bold text-prexi-navy dark:bg-white/10 dark:text-blue-200">Subir de nivel</span>
          <span className="text-xs font-semibold text-muted">Tema {diag.tema.numero} · {diag.tema.titulo}</span>
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-fg">
          Demuestra tu nivel <span className="text-prexi-blue-deep">{diag.nivel_objetivo_label}</span>
        </h1>
        <p className="mt-1 text-sm text-muted">
          Responde estas {diag.total} preguntas sin ayuda. Con <b>{diag.umbral}%</b> o más, pasarás de <b>{diag.nivel_actual_label}</b> a <b>{diag.nivel_objetivo_label}</b> en este tema.
        </p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-2xs text-muted"><span>Respondidas</span><span>{respondidas}/{diag.total}</span></div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-prexi-blue transition-all" style={{ width: `${diag.total ? (respondidas / diag.total) * 100 : 0}%` }} /></div>
        </div>
      </div>

      <div className="space-y-5">
        {diag.preguntas.map((p, i) => (
          <div key={p.id} className="card">
            <CabeceraPregunta numero={i + 1} total={diag.total} tipo={p.tipo} tema={p.categoria}
              extra={respuestas[p.id] ? <span className="inline-flex items-center gap-1 text-xs font-bold text-prexi-green"><CheckCircle className="h-4 w-4" /> Respondida</span> : undefined} />
            <Enunciado tipo={p.tipo} como="h3">{p.enunciado}</Enunciado>
            {p.codigoPython && <div className="mb-4"><CodeViewer code={p.codigoPython} /></div>}

            {p.tipo === 'completar_codigo' ? (
              <input value={respuestas[p.id] ?? ''} onChange={(e) => setRespuestas((r) => ({ ...r, [p.id]: e.target.value }))}
                placeholder="Escribe la línea o el valor que falta" className="input font-mono text-sm" />
            ) : p.tipo === 'ordenar_lineas' ? (
              <div className="space-y-2">
                {(ordenables[p.id] ?? []).map((o, idx) => (
                  <div key={o.id} className="flex items-center gap-2 rounded-xl border border-[#0E3F7E] bg-[#04162E] p-2.5">
                    <GripVertical className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-slate-300">{idx + 1}</span>
                    <span className="flex-1 whitespace-pre font-mono text-sm text-slate-100">{o.texto}</span>
                    <div className="flex shrink-0 flex-col">
                      <button type="button" disabled={idx === 0} onClick={() => moverLinea(p.id, idx, -1)} className="grid h-4 w-6 place-items-center text-slate-500 disabled:opacity-20 hover:text-sky-300"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={idx === (ordenables[p.id]?.length ?? 0) - 1} onClick={() => moverLinea(p.id, idx, 1)} className="grid h-4 w-6 place-items-center text-slate-500 disabled:opacity-20 hover:text-sky-300"><ChevronDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div role="radiogroup" aria-label={`Opciones de la pregunta ${i + 1}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {p.opciones.map((o, j) => (
                  <OptionCard key={o.id} letra={o.id} texto={o.texto} selected={respuestas[p.id] === o.id}
                    tabbable={respuestas[p.id] ? respuestas[p.id] === o.id : j === 0}
                    onSelect={() => setRespuestas((r) => ({ ...r, [p.id]: o.id }))} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-4 shadow-soft">
        <span className="text-sm text-muted">{todasListas ? '¡Listo para enviar!' : `Faltan ${diag.total - respondidas} preguntas`}</span>
        <button onClick={enviar} disabled={!todasListas || enviando} className="btn-primary disabled:opacity-50">
          {enviando ? 'Evaluando…' : <>Enviar y evaluar <CheckCircle className="h-4 w-4" /></>}
        </button>
      </div>
    </div>
  );
}
