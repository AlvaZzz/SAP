'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { api, ApiError } from '@/lib/api';
import { Ejercicio, ResultadoIntento, Opcion } from '@/lib/types';
import { CodeViewer } from '@/components/code-viewer';
import { AlexPanel } from '@/components/alex-panel';
import { RangoIcon } from '@/components/rango-icon';
import { useLogros } from '@/components/logro-toast';
import { CheckCircle, ArrowRight, ChevronLeft, Layers, X, ChevronUp, ChevronDown, GripVertical, Star, Zap, Bot } from '@/components/icons';

interface RangoInfo { clave: string; nombre: string; svgKey: string; color: string }

/** Baraja las líneas de un ejercicio "ordenar_lineas" (Fisher-Yates). */
function barajar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function DetallePage() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();
  const { celebrar } = useLogros();

  const [ej, setEj] = useState<Ejercicio | null>(null);
  const [rango, setRango] = useState<RangoInfo | null>(null);
  const [orden, setOrden] = useState<{ idx: number; total: number; ids: number[] }>({ idx: 0, total: 1, ids: [] });
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [textoLibre, setTextoLibre] = useState('');
  const [lineas, setLineas] = useState<Opcion[]>([]);
  const [resultado, setResultado] = useState<ResultadoIntento | null>(null);
  const [retro, setRetro] = useState<string | null>(null);
  const [pidiendoIa, setPidiendoIa] = useState(false);
  const [iaPedida, setIaPedida] = useState(false);
  const [ultimaRespuesta, setUltimaRespuesta] = useState('');
  const [xpVuela, setXpVuela] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [inicio, setInicio] = useState(() => Date.now());

  useEffect(() => {
    setResultado(null); setRetro(null); setPidiendoIa(false); setIaPedida(false); setUltimaRespuesta('');
    setSeleccion(null); setTextoLibre(''); setXpVuela(null); setInicio(Date.now());
    api.get<{ ejercicio: Ejercicio }>(`/ejercicios/${id}`).then((r) => {
      setEj(r.ejercicio);
      if (r.ejercicio.tipo === 'ordenar_lineas') setLineas(barajar(r.ejercicio.opciones));
      // Progreso y ORDEN ADAPTATIVO: la ruta del backend decide la secuencia
      // según el nivel del estudiante (tema si lo tiene; si no, nivel).
      const q = r.ejercicio.temaId ? `tema=${r.ejercicio.temaId}` : `nivel=${r.ejercicio.nivel?.numero ?? ''}`;
      api.get<{ ejercicios: Ejercicio[] }>(`/ejercicios/ruta?${q}`).then((lr) => {
        const ids = lr.ejercicios.map((e) => e.id);
        const i = ids.indexOf(r.ejercicio.id);
        setOrden({ idx: i < 0 ? 0 : i, total: ids.length || 1, ids });
      }).catch(() => undefined);
    }).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    api.get<{ global: { rango: RangoInfo } }>('/gamificacion/rangos').then((r) => setRango(r.global.rango)).catch(() => undefined);
  }, []);

  function moverLinea(i: number, dir: -1 | 1) {
    setLineas((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const nuevas = [...prev];
      [nuevas[i], nuevas[j]] = [nuevas[j], nuevas[i]];
      return nuevas;
    });
  }

  const respuestaLista = ej?.tipo === 'completar_codigo' ? textoLibre.trim().length > 0
    : ej?.tipo === 'ordenar_lineas' ? lineas.length > 0
    : !!seleccion;

  async function enviar() {
    if (!ej || !respuestaLista) return;
    const respuestaDada = ej.tipo === 'completar_codigo' ? textoLibre.trim()
      : ej.tipo === 'ordenar_lineas' ? lineas.map((o) => o.id).join(',')
      : seleccion!;
    setEnviando(true);
    try {
      const r = await api.post<ResultadoIntento>('/intentos', {
        ejercicioId: ej.id, respuestaDada, tiempoSeg: Math.round((Date.now() - inicio) / 1000),
      });
      setResultado(r);
      if (r.correcto) {
        setXpVuela(r.xp.xpOtorgado);
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#2C4A6E', '#2E7D5B', '#B5822E'] });
        if (r.nivel.nivelDesbloqueadoNumero) {
          setTimeout(() => confetti({ particleCount: 140, spread: 100, origin: { y: 0.5 } }), 300);
        }
        // Celebración tipo videojuego de emblemas y rango (cola global).
        const celebs = [
          ...(r.emblemas_nuevos ?? []).map((e) => ({ tipo: 'emblema' as const, nombre: e.nombre, descripcion: e.descripcion, svgKey: e.svgKey })),
          ...(r.rango_subido ? [{ tipo: 'rango' as const, nombre: r.rango_subido.titulo, descripcion: '¡Nuevo rango alcanzado!', svgKey: rango?.svgKey ?? 'escudo_2', color: rango?.color }] : []),
        ];
        if (celebs.length) setTimeout(() => celebrar(celebs), 600);
      } else {
        // Retroalimentación DETERMINÍSTICA primero: mostramos la explicación
        // estática del docente (explicacion_base) sin gastar tokens de Gemini.
        // ALVARO (IA) solo se llama bajo demanda si el estudiante lo pide.
        setRetro(r.explicacion_base ?? null);
        setUltimaRespuesta(respuestaDada.slice(0, 120));
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Error al enviar');
    } finally { setEnviando(false); }
  }

  /** Explicación personalizada de ALVARO (IA) — solo a petición del estudiante. */
  async function pedirRetroIa() {
    if (!ej || pidiendoIa) return;
    setPidiendoIa(true); setIaPedida(true);
    try {
      const fb = await api.post<{ explicacion: string }>('/tutor-ia/retroalimentacion', {
        ejercicio_id: ej.id, respuesta_estudiante: ultimaRespuesta || '(sin respuesta)',
      });
      setRetro(fb.explicacion);
    } catch (err) {
      // Si ALVARO no está disponible, conservamos la explicación estática ya mostrada.
      alert(err instanceof ApiError ? err.message : 'ALVARO no está disponible ahora.');
    } finally { setPidiendoIa(false); }
  }

  if (!ej) return (
    <div className="space-y-4">
      <div className="skeleton h-16" />
      <div className="grid gap-6 lg:grid-cols-3"><div className="skeleton h-96 lg:col-span-2" /><div className="skeleton h-96" /></div>
    </div>
  );

  const progreso = Math.round(((orden.idx + 1) / orden.total) * 100);
  const sig = orden.ids[orden.idx + 1];
  const unidadTema = ej.tema ? `U${ej.tema.unidad.numero} · ${ej.tema.numero} ${ej.tema.titulo}` : ej.nivel ? `Nivel ${ej.nivel.numero}` : null;

  return (
    <div className="animate-fade-up">
      {/* Header: barra superior con salir + progreso del tema + rango */}
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-line bg-card px-5 py-4 shadow-soft">
        <button onClick={() => router.push('/ejercicios')} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-subtle hover:text-fg" title="Salir"><X className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-sm font-semibold text-fg">Ejercicio {orden.idx + 1} de {orden.total}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-subtle"><div className="h-full origin-left rounded-full bg-gradient-to-r from-prexi-blue to-prexi-blue-hover transition-all animate-grow-x" style={{ width: `${progreso}%` }} /></div>
        </div>
        {rango && (
          <div className="hidden shrink-0 items-center gap-2 rounded-xl bg-subtle px-3 py-1.5 sm:flex" title={`Tu rango: ${rango.nombre}`}>
            <RangoIcon svgKey={rango.svgKey} color={rango.color} className="h-7 w-7" />
            <span className="text-xs font-semibold text-fg">{rango.nombre}</span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className={`card ${resultado && !resultado.correcto ? 'animate-shake' : ''}`}>
            {/* Badges del ejercicio */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {unidadTema && <span className="inline-flex items-center gap-1.5 rounded-full bg-prexi-navy/10 px-2.5 py-1 text-[11px] font-bold text-prexi-navy dark:bg-white/10 dark:text-blue-200"><Layers className="h-3.5 w-3.5" /> {unidadTema}</span>}
              <span className="rounded-full bg-prexi-blue/10 px-2.5 py-1 text-[11px] font-bold text-prexi-blue-deep">{ej.categoria}</span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-prexi-amber">
                {Array.from({ length: ej.estrellas }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-prexi-green/10 px-2.5 py-1 text-[11px] font-bold text-prexi-green"><Zap className="h-3.5 w-3.5" /> +{ej.xp} XP</span>
            </div>

            <h1 className="mb-5 font-display text-2xl font-bold leading-snug text-fg">{ej.enunciado}</h1>
            {ej.codigoPython && <div className="mb-6"><CodeViewer code={ej.codigoPython} /></div>}

            {ej.tipo === 'completar_codigo' ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-fg">Escribe la línea o el valor que falta</label>
                <input value={textoLibre} onChange={(e) => setTextoLibre(e.target.value)} disabled={!!resultado}
                  onKeyDown={(e) => { if (e.key === 'Enter' && respuestaLista && !resultado) enviar(); }}
                  placeholder="Ej.: for i in range(10)"
                  className={`input font-mono text-sm ${resultado ? (resultado.correcto ? 'border-prexi-green' : 'border-red-400') : ''}`} />
                {resultado && !resultado.correcto && <p className="mt-2 text-sm text-muted">Respuesta esperada: <span className="font-mono font-semibold text-prexi-green">{resultado.respuesta_correcta}</span></p>}
              </div>
            ) : ej.tipo === 'ordenar_lineas' ? (
              <div>
                <p className="mb-2 text-sm text-muted">Ordena las líneas con las flechas hasta lograr la secuencia correcta.</p>
                <div className="space-y-2">
                  {lineas.map((o, i) => (
                    <div key={o.id} className="flex items-center gap-2 rounded-xl border border-[#24466B] bg-[#0F1B2D] p-2.5">
                      <GripVertical className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-slate-300">{i + 1}</span>
                      <span className="flex-1 whitespace-pre font-mono text-sm text-slate-100">{o.texto}</span>
                      <div className="flex shrink-0 flex-col">
                        <button type="button" disabled={!!resultado || i === 0} onClick={() => moverLinea(i, -1)} className="grid h-4 w-6 place-items-center text-slate-500 disabled:opacity-20 hover:text-sky-300"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={!!resultado || i === lineas.length - 1} onClick={() => moverLinea(i, 1)} className="grid h-4 w-6 place-items-center text-slate-500 disabled:opacity-20 hover:text-sky-300"><ChevronDown className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {ej.opciones.map((o) => {
                  const elegido = seleccion === o.id;
                  const esCorrecta = resultado && o.id === resultado.respuesta_correcta;
                  const malaElegida = resultado && elegido && !resultado.correcto;
                  return (
                    <button key={o.id} disabled={!!resultado} onClick={() => setSeleccion(o.id)}
                      className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition active:scale-[0.99] ${esCorrecta ? 'border-prexi-green bg-emerald-500/10' : malaElegida ? 'border-red-400 bg-red-500/10' : elegido ? 'border-prexi-blue bg-prexi-blue/10' : 'border-line hover:border-prexi-blue/40 hover:bg-subtle'}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${esCorrecta ? 'bg-prexi-green text-white' : elegido ? 'bg-prexi-blue text-white' : 'bg-subtle text-muted'}`}>{o.id}</span>
                      <span className="whitespace-pre-line font-medium text-fg">{o.texto}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {resultado && (
              <div className="mt-6">
                {resultado.correcto ? (
                  <div className="relative flex items-start gap-3 overflow-hidden rounded-xl bg-emerald-500/10 p-4 animate-fade-up">
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-prexi-green" />
                    <div>
                      <p className="font-bold text-prexi-green">¡Correcto! <span className="ml-1 text-prexi-amber">+{resultado.xp.xpOtorgado} XP</span></p>
                      <p className="text-sm text-muted">base × {resultado.xp.multiplicador} por racha de {resultado.xp.rachaDias} días.</p>
                      {resultado.nivel.nivelDesbloqueadoNumero && <p className="mt-1 text-sm font-semibold text-prexi-blue-deep">🔓 ¡Desbloqueaste el Nivel {resultado.nivel.nivelDesbloqueadoNumero}!</p>}
                    </div>
                    {/* XP que "vuela" hacia arriba */}
                    {xpVuela != null && <span className="xp-fly pointer-events-none absolute right-6 top-4 font-display text-2xl font-extrabold text-prexi-amber">+{xpVuela}</span>}
                  </div>
                ) : (
                  <div className="rounded-xl bg-red-500/10 p-4 animate-fade-up">
                    <p className="font-bold text-red-500">No es correcta esta vez.</p>
                    {retro && (
                      <p className="mt-1 text-sm text-muted">
                        <span className="font-semibold text-fg">{iaPedida ? 'ALVARO:' : 'Explicación:'}</span> {retro}
                      </p>
                    )}
                    {/* La IA (ALVARO) solo se invoca si el estudiante quiere una
                        explicación personalizada: ahorra tokens en cada fallo. */}
                    {!iaPedida && (
                      <button
                        onClick={pedirRetroIa}
                        disabled={pidiendoIa}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-prexi-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-prexi-navy-soft disabled:opacity-50"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        {pidiendoIa ? 'ALVARO está pensando…' : 'Explícame más con ALVARO'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="mt-7 flex items-center justify-between border-t border-line pt-5">
              <button onClick={() => router.push('/ejercicios')} className="btn-ghost"><ChevronLeft className="h-4 w-4" /> Volver</button>
              {!resultado ? (
                <button onClick={enviar} disabled={!respuestaLista || enviando} className="btn-primary disabled:opacity-50">{enviando ? 'Enviando…' : 'Enviar respuesta'}</button>
              ) : sig ? (
                <button onClick={() => router.push(`/ejercicios/${sig}`)} className="btn-primary">Siguiente <ArrowRight className="h-4 w-4" /></button>
              ) : (
                <button onClick={() => router.push('/ejercicios')} className="btn-primary">Finalizar <CheckCircle className="h-4 w-4" /></button>
              )}
            </div>
          </div>
        </div>

        <div>
          <AlexPanel ejercicioId={ej.id} contextoTema={ej.categoria} maxPistas={ej.maxPistas} />
        </div>
      </div>

      <style jsx>{`
        @keyframes xp-fly {
          0% { opacity: 0; transform: translateY(0) scale(0.8); }
          25% { opacity: 1; transform: translateY(-6px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-42px) scale(1); }
        }
        .xp-fly { animation: xp-fly 1.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
