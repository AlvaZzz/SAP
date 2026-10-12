'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { api, ApiError } from '@/lib/api';
import { Ejercicio, ResultadoIntento, RutaTema } from '@/lib/types';
import { VistaEjercicio } from '@/components/ejercicios';
import { useRachaSesion } from '@/components/ejercicios/racha-sesion';
import { CierreTema, AvisoRacha } from '@/components/ejercicios/cierre-tema';
import { TutorPanel } from '@/components/tutor-panel';
import { RangoIcon } from '@/components/rango-icon';
import { useLogros } from '@/components/logro-toast';
import { useSound } from '@/components/use-sound';
import { CheckCircle, ArrowRight, ChevronLeft, Layers, X, Zap, Bot } from '@/components/icons';
import { NivelBadge } from '@/components/nivel-badge';

interface RangoInfo { clave: string; nombre: string; svgKey: string; color: string }

export default function DetallePage() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();
  const { celebrar } = useLogros();
  const { playCorrect, playWrong } = useSound();

  const [ej, setEj] = useState<Ejercicio | null>(null);
  const [rango, setRango] = useState<RangoInfo | null>(null);
  // Ruta del tema. Se guarda ENTERA (no solo los ids) porque `pendientes_ids` es
  // lo que decide el "Siguiente": la lista `ejercicios` trae los resueltos al
  // final y navegar por ella hacía reaparecer ejercicios ya hechos.
  const [ruta, setRuta] = useState<RutaTema | null>(null);
  const [orden, setOrden] = useState<{ idx: number; total: number }>({ idx: 0, total: 1 });
  // La racha vive por TEMA y sobrevive al cambio de página (sessionStorage).
  const { racha, registrar, reiniciar, enRacha, atascado } = useRachaSesion(ej?.temaId ?? null);
  const [avisoOculto, setAvisoOculto] = useState(false);
  // Respuesta actual reportada por el componente de tipo (null = aún sin responder).
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoIntento | null>(null);
  // Respuesta PARCIAL: no cierra el ejercicio. Se muestra qué falta y el estudiante
  // la complementa y vuelve a comprobar.
  const [parcial, setParcial] = useState<ResultadoIntento | null>(null);
  const [retro, setRetro] = useState<string | null>(null);
  const [pidiendoIa, setPidiendoIa] = useState(false);
  const [iaPedida, setIaPedida] = useState(false);
  const [ultimaRespuesta, setUltimaRespuesta] = useState('');
  const [xpVuela, setXpVuela] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [inicio, setInicio] = useState(() => Date.now());

  useEffect(() => {
    setResultado(null); setParcial(null); setRetro(null); setPidiendoIa(false); setIaPedida(false); setUltimaRespuesta('');
    setRespuesta(null); setXpVuela(null); setInicio(Date.now());
    api.get<{ ejercicio: Ejercicio }>(`/ejercicios/${id}`).then((r) => {
      setEj(r.ejercicio);
      // Progreso y ORDEN ADAPTATIVO: la ruta del backend decide la secuencia
      // según el nivel del estudiante (tema si lo tiene; si no, nivel).
      const q = r.ejercicio.temaId ? `tema=${r.ejercicio.temaId}` : `nivel=${r.ejercicio.nivel?.numero ?? ''}`;
      api.get<RutaTema>(`/ejercicios/ruta?${q}`).then((lr) => {
        setRuta(lr);
        // El contador se lee de la RUTA COMPLETA (posición real dentro del nivel),
        // pero la navegación usa `pendientes_ids`: son dos cosas distintas y
        // mezclarlas era el origen de los ejercicios repetidos.
        const ids = lr.ejercicios.map((e) => e.id);
        const i = ids.indexOf(r.ejercicio.id);
        setOrden({ idx: i < 0 ? 0 : i, total: ids.length || 1 });
      }).catch(() => undefined);
    }).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    api.get<{ global: { rango: RangoInfo } }>('/gamificacion/rangos').then((r) => setRango(r.global.rango)).catch(() => undefined);
  }, []);

  const respuestaLista = respuesta != null && respuesta.length > 0;

  async function enviar() {
    if (!ej || !respuestaLista || resultado) return;
    setEnviando(true);
    try {
      const r = await api.post<ResultadoIntento>('/intentos', {
        ejercicioId: ej.id, respuestaDada: respuesta, tiempoSeg: Math.round((Date.now() - inicio) / 1000),
      });
      if (r.estado === 'parcial') { setParcial(r); return; }
      setParcial(null);
      setResultado(r);
      registrar(r.correcto);   // racha de sesión: aciertos seguidos vs fallos seguidos
      setAvisoOculto(false);
      if (r.correcto) {
        setXpVuela(r.xp.xpOtorgado);
        // Sonido MUY sutil de acierto (si el usuario tiene los sonidos activados).
        playCorrect();
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#3B82F6', '#10B981', '#F59E0B'] });
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
        // Tono neutro y AMABLE al fallar (nunca estridente): acompaña el mensaje
        // de PREXI de que equivocarse es parte de aprender.
        playWrong();
        // Retroalimentación DETERMINÍSTICA primero: mostramos la explicación
        // estática del docente (explicacion_base) sin gastar tokens de Gemini.
        // PREXI (IA) solo se llama bajo demanda si el estudiante lo pide.
        setRetro(r.explicacion_base ?? null);
        setUltimaRespuesta((respuesta ?? '').slice(0, 120));
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Error al enviar');
    } finally { setEnviando(false); }
  }

  /** Explicación personalizada de PREXI (IA) — solo a petición del estudiante. */
  async function pedirRetroIa() {
    if (!ej || pidiendoIa) return;
    setPidiendoIa(true); setIaPedida(true);
    try {
      const fb = await api.post<{ explicacion: string }>('/tutor-ia/retroalimentacion', {
        ejercicio_id: ej.id, respuesta_estudiante: ultimaRespuesta || '(sin respuesta)',
      });
      setRetro(fb.explicacion);
    } catch (err) {
      // Si PREXI no está disponible, conservamos la explicación estática ya mostrada.
      alert(err instanceof ApiError ? err.message : 'Tu tutor PREXI no está disponible ahora.');
    } finally { setPidiendoIa(false); }
  }

  if (!ej) return (
    <div className="space-y-4">
      <div className="skeleton h-16" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"><div className="skeleton h-96" /><div className="skeleton h-96" /></div>
    </div>
  );

  const progreso = Math.round(((orden.idx + 1) / orden.total) * 100);
  // SIGUIENTE = el próximo PENDIENTE, excluyendo el actual (que acaba de
  // resolverse y todavía figura como pendiente en la ruta cargada al entrar).
  // Antes era `ids[idx + 1]` sobre la lista `[...pendientes, ...resueltos]`: en
  // cuanto el índice entraba en la cola de resueltos, "Siguiente" empezaba a
  // servir ejercicios ya hechos aunque quedaran pendientes.
  const sig = (ruta?.pendientes_ids ?? []).find((x) => x !== ej.id);
  const progNivel = ruta?.progreso_nivel ?? null;
  // Cierre de tema: resolvió el último pendiente de su nivel en este tema.
  const temaCerrado = !!resultado?.correcto && !sig && !!ej.temaId && !!progNivel;
  const unidadTema = ej.tema ? `U${ej.tema.unidad.numero} · ${ej.tema.numero} ${ej.tema.titulo}` : ej.nivel ? `Nivel ${ej.nivel.numero}` : null;

  return (
    <div className="animate-fade-up">
      {/* Header: barra superior con salir + progreso del tema + rango */}
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-line bg-card px-5 py-4 shadow-soft">
        <button onClick={() => router.push('/ejercicios')} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-subtle hover:text-fg" title="Salir"><X className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-fg">
            <span>Ejercicio {orden.idx + 1} de {orden.total}</span>
            {/* Progreso DENTRO del nivel: es el que habilita el mini-diagnóstico,
                así que el estudiante tiene que poder verlo mientras practica. */}
            {progNivel && (
              <span className="text-xs font-medium text-muted">
                · nivel {progNivel.nivel_label}: {progNivel.resueltos}/{progNivel.minimo} resueltos
                {progNivel.cumplido ? ' · ya puedes subir de nivel' : ` · faltan ${progNivel.faltan}`}
              </span>
            )}
          </p>
          {/* Progreso VIVO por segmentos (uno por ejercicio de la ruta) que se llenan
              con animación; si la ruta es muy larga, cae a una barra continua. */}
          {orden.total <= 30 ? (
            <div className="flex gap-1" role="progressbar" aria-valuenow={orden.idx + 1} aria-valuemin={1} aria-valuemax={orden.total} aria-label="Progreso del cuestionario">
              {Array.from({ length: orden.total }).map((_, i) => (
                <div key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-prexi-blue to-prexi-blue-hover"
                    initial={false} animate={{ width: i <= orden.idx ? '100%' : '0%' }} transition={{ duration: 0.4, ease: 'easeOut' }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-2 w-full overflow-hidden rounded-full bg-subtle"><motion.div className="h-full rounded-full bg-gradient-to-r from-prexi-blue to-prexi-blue-hover" initial={false} animate={{ width: `${progreso}%` }} transition={{ duration: 0.4 }} /></div>
          )}
        </div>
        {rango && (
          <div className="hidden shrink-0 items-center gap-2 rounded-xl bg-subtle px-3 py-1.5 sm:flex" title={`Tu rango: ${rango.nombre}`}>
            <RangoIcon svgKey={rango.svgKey} color={rango.color} className="h-7 w-7" />
            <span className="text-xs font-semibold text-fg">{rango.nombre}</span>
          </div>
        )}
      </div>

      {/* Escritorio amplio (xl+): 2 columnas PROPORCIONADAS (~57% ejercicio /
          ~43% PREXI). El ancho fijo de 340px se quedaba corto al crecer la
          pantalla (PREXI caía a ~28% y el chat quedaba estrecho); 1.35fr/1fr
          mantiene la proporción a cualquier ancho.
          El corte va en xl y no en lg a propósito: en lg el sidebar (w-64) deja
          ~575px útiles, y partirlos en dos dejaba el ejercicio en ~210px. Por
          debajo de xl, PREXI se apila DEBAJO a todo el ancho. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className={`card ${resultado && !resultado.correcto ? 'animate-shake' : ''}`}>
            {/* Badges del ejercicio */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {unidadTema && <span className="inline-flex items-center gap-1.5 rounded-full bg-prexi-navy/10 px-2.5 py-1 text-[11px] font-bold text-prexi-navy dark:bg-white/10 dark:text-blue-200"><Layers className="h-3.5 w-3.5" /> {unidadTema}</span>}
              <span className="rounded-full bg-prexi-blue/10 px-2.5 py-1 text-[11px] font-bold text-prexi-blue-deep">{ej.categoria}</span>
              <NivelBadge nivel={ej.nivelDificultad} estrellas={ej.estrellas} />
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-prexi-green/10 px-2.5 py-1 text-[11px] font-bold text-prexi-green"><Zap className="h-3.5 w-3.5" /> +{ej.xp} XP</span>
            </div>

            <h1 className="mb-5 font-display text-2xl font-bold leading-snug text-fg">{ej.enunciado}</h1>

            {/* Cada tipo renderiza su interacción y reporta la respuesta con onChange.
                `key={ej.id}` remonta el componente (estado limpio) al cambiar de ejercicio. */}
            <VistaEjercicio key={ej.id} ejercicio={ej} resultado={resultado} onChange={setRespuesta} />

            {parcial && !resultado && (
              <div className="mt-6 rounded-xl border border-prexi-amber/40 bg-prexi-amber/10 p-4 animate-fade-up" role="status">
                <p className="font-bold text-prexi-amber">Casi: tu respuesta está parcialmente correcta ({Math.round((parcial.puntaje ?? 0) * 100)} %)</p>
                <p className="mt-1 text-sm text-fg">{parcial.retroalimentacion}</p>
                {parcial.faltantes && parcial.faltantes.length > 0 && (
                  <p className="mt-1 text-sm text-muted">Revisa: {parcial.faltantes.join(', ')}.</p>
                )}
                <p className="mt-2 text-sm font-semibold text-fg">Complétala y vuelve a pulsar «Comprobar».</p>
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
                      {resultado.nivel.nivelDesbloqueadoNumero && <p className="mt-1 text-sm font-semibold text-prexi-blue-deep">Desbloqueaste el Nivel {resultado.nivel.nivelDesbloqueadoNumero}</p>}
                    </div>
                    {/* XP que "vuela" hacia arriba */}
                    {xpVuela != null && <span className="xp-fly pointer-events-none absolute right-6 top-4 font-display text-2xl font-extrabold text-prexi-amber">+{xpVuela}</span>}
                  </div>
                ) : (
                  <div className="rounded-xl bg-red-500/10 p-4 animate-fade-up">
                    <p className="font-bold text-red-500">No es correcta esta vez.</p>
                    {retro && (
                      <p className="mt-1 text-sm text-muted">
                        <span className="font-semibold text-fg">{iaPedida ? 'PREXI:' : 'Explicación:'}</span> {retro}
                      </p>
                    )}
                    {/* La IA (PREXI) solo se invoca si el estudiante quiere una
                        explicación personalizada: ahorra tokens en cada fallo. */}
                    {!iaPedida && (
                      <button
                        onClick={pedirRetroIa}
                        disabled={pidiendoIa}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-prexi-blue px-3 py-1.5 text-xs font-semibold text-accent-on transition hover:bg-prexi-blue-hover disabled:opacity-50"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        {pidiendoIa ? 'PREXI está pensando…' : 'Explícame más con tu tutor PREXI'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* RACHA (arreglo de la lógica invertida): con aciertos seguidos se
                anima a CONTINUAR; solo con fallos seguidos se ofrece pausa o
                repaso. Antes era al revés: proponía terminar tras 3 aciertos. */}
            {resultado && !avisoOculto && !temaCerrado && enRacha && (
              <AvisoRacha tipo="racha" aciertos={racha.aciertos} temaId={ej.temaId ?? null}
                onSeguir={() => { setAvisoOculto(true); if (sig) router.push(`/ejercicios/${sig}`); }} />
            )}
            {resultado && !avisoOculto && !temaCerrado && atascado && (
              <AvisoRacha tipo="atasco" aciertos={racha.aciertos} temaId={ej.temaId ?? null}
                onSeguir={() => { setAvisoOculto(true); reiniciar(); }} />
            )}

            <div className="mt-7 flex items-center justify-between border-t border-line pt-5">
              <button onClick={() => router.push('/ejercicios')} className="btn-ghost"><ChevronLeft className="h-4 w-4" /> Volver</button>
              {!resultado ? (
                <button onClick={enviar} disabled={!respuestaLista || enviando} className="btn-primary disabled:opacity-50">{enviando ? 'Comprobando…' : 'Comprobar'}</button>
              ) : sig ? (
                <button onClick={() => router.push(`/ejercicios/${sig}`)} className="btn-primary">Siguiente <ArrowRight className="h-4 w-4" /></button>
              ) : temaCerrado ? (
                // El cierre del tema se resuelve en la tarjeta de abajo, que ya
                // ofrece subir de nivel o pasar al siguiente tema.
                <span className="text-sm font-semibold text-prexi-green">Tema completado en tu nivel</span>
              ) : (
                <button onClick={() => router.push('/ejercicios')} className="btn-primary">Finalizar <CheckCircle className="h-4 w-4" /></button>
              )}
            </div>
          </div>

          {/* CIERRE DE TEMA: felicita indicando el nivel alcanzado y ofrece de
              forma activa el paso siguiente (repetir en nivel superior, o el
              siguiente tema si ya está en Avanzado). */}
          {temaCerrado && ej.temaId != null && (
            <div className="mt-6">
              <CierreTema temaId={ej.temaId} tituloTema={ej.tema?.titulo ?? 'este tema'} progreso={progNivel} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <TutorPanel ejercicioId={ej.id} contextoTema={ej.categoria} maxPistas={ej.maxPistas} tipo={ej.tipo} resultado={resultado} />
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
