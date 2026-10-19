'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { api, ApiError } from '@/lib/api';
import { Ejercicio, ResultadoIntento, RutaTema, ValorXp } from '@/lib/types';
import { VistaEjercicio } from '@/components/ejercicios';
import { CabeceraPregunta, Enunciado } from '@/components/ejercicios/pregunta';
import { useRachaSesion } from '@/components/ejercicios/racha-sesion';
import { CierreTema, AvisoRacha } from '@/components/ejercicios/cierre-tema';
import { TutorPanel } from '@/components/tutor-panel';
import { RangoIcon } from '@/components/rango-icon';
import { useLogros } from '@/components/logro-toast';
import { useSound } from '@/components/use-sound';
import { Zap, Bot } from '@/components/icons';
import { HudEjercicio } from '@/components/ejercicios/hud';
import { BarraAccion, fraseAcierto, fraseFallo } from '@/components/ejercicios/barra-accion';
import { escribiendo } from '@/components/ejercicios/atajos';
import { XpEnJuego } from '@/components/ejercicios/xp-en-juego';
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
  // La racha vive por TEMA y sobrevive al cambio de página (sessionStorage).
  const { racha, registrar, reiniciar, atascado } = useRachaSesion(ej?.temaId ?? null);
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
  const [enviando, setEnviando] = useState(false);
  const [inicio, setInicio] = useState(() => Date.now());
  // XP EN JUEGO: el valor que da el servidor más las pistas abiertas en esta
  // visita. Se recalcula con la MISMA fórmula que usa el servidor al calificar.
  const [valorXp, setValorXp] = useState<ValorXp | null>(null);
  const [pistasNuevas, setPistasNuevas] = useState(0);
  const valorCon = (pistas: number) => valorXp
    ? Math.max(valorXp.minimo, Math.round((valorXp.base - valorXp.penalizacion_pista * pistas) * valorXp.factor_nivel))
    : null;
  const pistasTotales = (valorXp?.pistas_usadas ?? 0) + pistasNuevas;
  const xpJuego = valorCon(pistasTotales);
  const siguiente = valorCon(pistasTotales + 1);
  const costoPista = xpJuego != null && siguiente != null ? xpJuego - siguiente : null;

  useEffect(() => {
    setResultado(null); setParcial(null); setRetro(null); setPidiendoIa(false); setIaPedida(false); setUltimaRespuesta('');
    setRespuesta(null); setInicio(Date.now());
    api.get<{ ejercicio: Ejercicio; valor_xp?: ValorXp }>(`/ejercicios/${id}`).then((r) => {
      setEj(r.ejercicio);
      setValorXp(r.valor_xp ?? null);
      setPistasNuevas(0);
      // Progreso y ORDEN ADAPTATIVO: la ruta del backend decide la secuencia
      // según el nivel del estudiante (tema si lo tiene; si no, nivel).
      const q = r.ejercicio.temaId ? `tema=${r.ejercicio.temaId}` : `nivel=${r.ejercicio.nivel?.numero ?? ''}`;
      // El contador del HUD se lee de la RUTA COMPLETA (posición real dentro del
      // nivel), pero la navegación usa `pendientes_ids`: son dos cosas distintas
      // y mezclarlas era el origen de los ejercicios repetidos.
      api.get<RutaTema>(`/ejercicios/ruta?${q}`).then(setRuta).catch(() => undefined);
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
        // Sonido MUY sutil de acierto (si el usuario tiene los sonidos activados).
        playCorrect();
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#3B82F6', '#10B981', '#F59E0B'] });
        // Hitos del combo (3, 5, 10 seguidas): una ráfaga extra desde los lados.
        const combo = racha.aciertos + 1;
        if (combo === 3 || combo === 5 || combo % 10 === 0) {
          setTimeout(() => {
            confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors: ['#F97316', '#F59E0B', '#EF4444'] });
            confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors: ['#F97316', '#F59E0B', '#EF4444'] });
          }, 250);
        }
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

  // Continuar tras el resultado: al siguiente pendiente, al cierre del tema o a la lista.
  function continuar() {
    if (!ej) return;
    const siguiente = (ruta?.pendientes_ids ?? []).find((x) => x !== ej.id);
    if (siguiente) { router.push(`/ejercicios/${siguiente}`); return; }
    const cierre = document.getElementById('cierre-tema');
    if (cierre) { cierre.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    router.push('/ejercicios');
  }

  // ENTER: comprueba la respuesta y, ya corregida, pasa a la siguiente. Ritmo de
  // juego en escritorio. Mientras se escribe en un campo (p. ej. el chat de
  // PREXI) Enter es del campo; con Ctrl/⌘+Enter se comprueba igual.
  const enviarRef = useRef(enviar);
  const continuarRef = useRef(continuar);
  enviarRef.current = enviar;
  continuarRef.current = continuar;
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.isComposing) return;
      const forzado = e.ctrlKey || e.metaKey;
      if (!forzado && escribiendo(e.target)) return;
      // Un botón enfocado ya responde a Enter por su cuenta: no duplicar.
      if (!forzado && (e.target as HTMLElement | null)?.closest?.('button, a')) return;
      e.preventDefault();
      if (resultado) continuarRef.current();
      else enviarRef.current();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [resultado]);

  if (!ej) return (
    <div className="space-y-4">
      <div className="skeleton h-16" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"><div className="skeleton h-96" /><div className="skeleton h-96" /></div>
    </div>
  );

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

  // Lo que el estudiante ve avanzar. Al acertar un pendiente, el segmento y la
  // meta del nivel suman YA (sin esperar a recargar la ruta).
  const eraPendiente = (ruta?.pendientes_ids ?? []).includes(ej.id);
  const sumaAhora = resultado?.correcto && eraPendiente ? 1 : 0;
  const resueltos = new Set<number>([...(ruta?.resueltos_ids ?? []), ...(sumaAhora ? [ej.id] : [])]);
  const idsRuta = ruta?.ejercicios.map((e) => e.id) ?? [ej.id];
  const meta = progNivel ? { ...progNivel, resueltosAhora: progNivel.resueltos + sumaAhora } : null;
  const faltanMeta = meta ? Math.max(0, meta.minimo - meta.resueltosAhora) : null;

  const estadoBarra = !resultado ? 'pendiente' : resultado.correcto ? 'correcto' : 'incorrecto';
  const textoContinuar = !resultado ? '' : sig ? 'Continuar' : temaCerrado ? 'Ver mi siguiente paso' : 'Finalizar';
  const lineaMeta = resultado?.correcto && meta
    ? (faltanMeta === 0
        ? `🎯 Meta del nivel ${meta.nivel_label} cumplida: ya puedes subir de nivel`
        : `🎯 Meta del nivel ${meta.nivel_label}: ${meta.resueltosAhora}/${meta.minimo} · ${faltanMeta === 1 ? '¡te falta 1!' : `te faltan ${faltanMeta}`}`)
    : null;

  return (
    <div className="animate-fade-up">
      <HudEjercicio
        ids={idsRuta}
        actualId={ej.id}
        resueltos={resueltos}
        combo={racha.aciertos}
        meta={meta}
        onSalir={() => router.push('/ejercicios')}
        derecha={rango && (
          <div className="flex items-center gap-2 rounded-xl bg-subtle px-3 py-1.5" title={`Tu rango: ${rango.nombre}`}>
            <RangoIcon svgKey={rango.svgKey} color={rango.color} className="h-7 w-7" />
            <span className="text-xs font-semibold text-fg">{rango.nombre}</span>
          </div>
        )}
      />

      {/* Escritorio amplio (xl+): 2 columnas PROPORCIONADAS (~57% ejercicio /
          ~43% PREXI). El corte va en xl y no en lg a propósito: en lg el sidebar
          deja ~575px útiles y partirlos en dos dejaba el ejercicio en ~210px.
          Por debajo de xl, PREXI se apila DEBAJO a todo el ancho. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className={`card transition-shadow ${resultado && !resultado.correcto ? 'animate-shake' : ''} ${resultado?.correcto ? 'ring-2 ring-prexi-green/40' : ''}`}>
            <CabeceraPregunta tipo={ej.tipo} tema={unidadTema ?? ej.categoria}
              extra={<>
                <NivelBadge nivel={ej.nivelDificultad} estrellas={ej.estrellas} />
                {xpJuego != null && valorXp
                  ? <XpEnJuego actual={xpJuego} sinPistas={valorXp.sin_pistas} />
                  : <span className="inline-flex items-center gap-1 rounded-full bg-prexi-green/10 px-2.5 py-1 text-2xs font-bold text-prexi-green"><Zap className="h-3.5 w-3.5" /> +{ej.xp} XP</span>}
              </>} />
            <Enunciado tipo={ej.tipo}>{ej.enunciado}</Enunciado>

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

            {/* Desbloqueos de nivel: un momento grande, merece su propio aviso. */}
            {resultado?.correcto && resultado.nivel.nivelDesbloqueadoNumero && (
              <p className="mt-5 rounded-xl bg-prexi-blue/10 px-4 py-3 text-sm font-semibold text-prexi-blue-deep animate-fade-up">
                🔓 Desbloqueaste el Nivel {resultado.nivel.nivelDesbloqueadoNumero}
              </p>
            )}

            {/* Con fallos seguidos se ofrece pausa o repaso (sin obligar). Los
                aciertos seguidos ya se celebran en la barra (combo 🔥). */}
            {resultado && !avisoOculto && !temaCerrado && atascado && (
              <AvisoRacha tipo="atasco" aciertos={racha.aciertos} temaId={ej.temaId ?? null}
                onSeguir={() => { setAvisoOculto(true); reiniciar(); }} />
            )}
          </div>

          {/* CIERRE DE TEMA: felicita indicando el nivel alcanzado y ofrece de
              forma activa el paso siguiente (repetir en nivel superior, o el
              siguiente tema si ya está en Avanzado). */}
          {temaCerrado && ej.temaId != null && (
            <div id="cierre-tema" className="mt-6 scroll-mt-24">
              <CierreTema temaId={ej.temaId} tituloTema={ej.tema?.titulo ?? 'este tema'} progreso={progNivel} />
            </div>
          )}

          {/* La acción principal, siempre a la mano (fija abajo). */}
          <BarraAccion
            estado={estadoBarra}
            puedeComprobar={respuestaLista}
            enviando={enviando}
            onComprobar={enviar}
            onContinuar={continuar}
            textoContinuar={textoContinuar}
            xp={resultado?.correcto ? resultado.xp.xpOtorgado : undefined}
            combo={racha.aciertos}
            titulo={!resultado ? undefined : resultado.correcto
              ? (temaCerrado ? '¡Tema completado!' : fraseAcierto(racha.aciertos, ej.id))
              : fraseFallo(ej.id)}
            meta={lineaMeta}
            detalle={resultado && !resultado.correcto ? (
              <div>
                {retro
                  ? <p><span className="font-semibold">{iaPedida ? 'PREXI:' : 'Por qué:'}</span> {retro}</p>
                  : <p className="text-muted">Compara tu respuesta con la que quedó marcada como correcta.</p>}
                {/* La IA (PREXI) solo se invoca si el estudiante la pide: ahorra tokens en cada fallo. */}
                {!iaPedida && (
                  <button onClick={pedirRetroIa} disabled={pidiendoIa}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-prexi-blue px-3 py-1.5 text-xs font-semibold text-accent-on transition hover:bg-prexi-blue-hover disabled:opacity-50">
                    <Bot className="h-3.5 w-3.5" />
                    {pidiendoIa ? 'PREXI está pensando…' : 'Explícamelo, PREXI'}
                  </button>
                )}
              </div>
            ) : resultado?.correcto && (pistasTotales > 0 || resultado.xp.multiplicador > 1) ? (
              <div className="space-y-0.5 text-muted">
                {pistasTotales > 0 && valorXp && xpJuego != null && (
                  <p>
                    {pistasTotales === 1 ? 'Usaste 1 pista' : `Usaste ${pistasTotales} pistas`}: <b className="text-amber-700 dark:text-amber-300">−{valorXp.sin_pistas - xpJuego} XP</b>.
                    {' '}Sin pistas habrías ganado {valorXp.sin_pistas}.
                  </p>
                )}
                {resultado.xp.multiplicador > 1 && <p>XP × {resultado.xp.multiplicador} por tu racha de {resultado.xp.rachaDias} días seguidos.</p>}
              </div>
            ) : null}
          />
        </div>

        <div className="min-w-0">
          <TutorPanel ejercicioId={ej.id} contextoTema={ej.categoria} maxPistas={ej.maxPistas} tipo={ej.tipo} resultado={resultado}
            costoPista={resultado ? null : costoPista} xpMinimo={valorXp?.minimo}
            onPistaAbierta={() => setPistasNuevas((n) => n + 1)} />
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
