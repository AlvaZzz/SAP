'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Markdown } from '@/components/markdown';
import { TutorAvatar, EstadoTutor } from '@/components/tutor-avatar';
import { BotonVoz } from '@/components/boton-voz';
import { useAuth } from '@/providers/auth-provider';
import { useAnimo } from '@/components/animo-tutor';
import { useVoz } from '@/lib/voz';
import { Lightbulb, Lock, ChevronDown, Send, Sparkles } from './icons';
import type { TipoEjercicio, ResultadoIntento } from '@/lib/types';

const ETIQUETA: Record<number, string> = { 1: 'El concepto', 2: 'Dónde está el error', 3: 'Casi la solución' };

interface Mensaje { id: number; de: 'tutor' | 'tu'; texto: string }

/**
 * Panel del tutor PREXI en el detalle de ejercicio. Chat con personalidad:
 * avatar animado, bienvenida CONTEXTUAL, sugerencias rápidas (chips), streaming,
 * pistas progresivas en acordeón y refuerzo positivo. Consume los endpoints
 * reales /tutor-ia/asistente(/stream) y /tutor-ia/pista (las pistas penalizan XP).
 * PREXI GUÍA, no resuelve — comunicado de forma amable.
 */
export function TutorPanel({ ejercicioId, contextoTema, maxPistas, tipo, resultado }: {
  ejercicioId: number; contextoTema?: string; maxPistas: number;
  tipo?: TipoEjercicio; resultado?: ResultadoIntento | null;
}) {
  const bienvenida = contextoTema
    ? `Hola. Estás en **${contextoTema}**. Pregúntame lo que quieras: te guío para que lo resuelvas tú, no te doy la respuesta.`
    : 'Hola. Soy PREXI, tu tutor. Pregúntame sobre el concepto o pídeme una pista: te guío para que lo resuelvas tú.';

  const { usuario } = useAuth();
  const { alentar } = useAnimo();
  const { hablar } = useVoz();
  const [mensajes, setMensajes] = useState<Mensaje[]>([{ id: 0, de: 'tutor', texto: bienvenida }]);
  const [pregunta, setPregunta] = useState('');
  const [pistas, setPistas] = useState<Record<number, string>>({});
  const [abierta, setAbierta] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const resPrev = useRef<ResultadoIntento | null>(null);
  const pistasUsadas = Object.keys(pistas).length;

  // Auto-scroll al último mensaje / mientras escribe.
  useEffect(() => { cuerpoRef.current?.scrollTo({ top: cuerpoRef.current.scrollHeight, behavior: 'smooth' }); }, [mensajes, cargando, abierta]);

  // Refuerzo positivo / ánimo según el resultado del intento. NO va al chat: se
  // muestra como TARJETA DE TUTOR arriba (ver components/animo-tutor.tsx), para
  // que la conversación quede solo con las dudas reales del estudiante.
  useEffect(() => {
    if (!resultado || resultado === resPrev.current) return;
    resPrev.current = resultado;
    if (resultado.correcto) {
      const texto = pistasUsadas > 0
        ? `Muy bien. Lo resolviste apoyándote en ${pistasUsadas} pista${pistasUsadas === 1 ? '' : 's'}; así se aprende. Ya dominas mejor **${contextoTema ?? 'este tema'}**.`
        : 'Excelente. Lo resolviste por tu cuenta. Vas muy bien, sigue así.';
      alentar(texto, 'felicitacion');
    } else {
      alentar('Equivocarse es parte de aprender. Revisa con calma: si te trabas, pídeme una pista.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado]);

  function empujar(de: Mensaje['de'], texto: string) {
    setMensajes((m) => [...m, { id: nextId.current++, de, texto }]);
  }

  // Estado del avatar: pensativo al escribir; alentador tras acierto/ánimo; atento por defecto.
  const estadoAvatar: EstadoTutor = cargando ? 'pensando'
    : resultado ? 'alentando' : 'atento';
  const estadoTexto = cargando ? 'Pensando tu respuesta…' : 'En línea · listo para ayudarte';

  async function enviar(texto: string) {
    const q = texto.trim();
    if (!q || cargando) return;
    setPregunta('');
    empujar('tu', q);
    setCargando(true); setError('');
    const cuerpo = { pregunta: q, contextoTema, ejercicio_id: ejercicioId };
    // Mensaje de PREXI que se irá rellenando con el streaming.
    const idTutor = nextId.current++;
    setMensajes((m) => [...m, { id: idTutor, de: 'tutor', texto: '' }]);
    const set = (t: string) => setMensajes((m) => m.map((x) => (x.id === idTutor ? { ...x, texto: t } : x)));
    try {
      const res = await fetch('/api/tutor-ia/asistente/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', cache: 'no-store', body: JSON.stringify(cuerpo),
      });
      if (!res.ok || !res.body) {
        let msg = 'PREXI no está disponible ahora, intenta de nuevo.';
        try { const d = await res.json(); msg = (Array.isArray(d.message) ? d.message[0] : d.message) ?? msg; } catch { /* sin JSON */ }
        throw new ApiError(res.status, msg);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        set(acc);
      }
      if (!acc.trim()) set('PREXI no está disponible ahora, intenta de nuevo.');
      // Lectura automática (si el estudiante la activó en su perfil).
      else if (usuario?.vozAutomatica) hablar(acc);
    } catch (streamErr) {
      // Fallback robusto: si el streaming falla, usa el endpoint normal.
      try {
        const r = await api.post<{ respuesta: string }>('/tutor-ia/asistente', cuerpo);
        set(r.respuesta);
      } catch (err) {
        set('');
        setMensajes((m) => m.filter((x) => x.id !== idTutor));
        setError(err instanceof ApiError ? err.message : streamErr instanceof ApiError ? streamErr.message : 'PREXI no está disponible ahora, intenta de nuevo.');
      }
    } finally { setCargando(false); }
  }

  async function pedirPista(nivel: 1 | 2 | 3) {
    if (pistas[nivel]) { setAbierta(abierta === nivel ? null : nivel); return; }
    setCargando(true); setError('');
    try {
      const r = await api.post<{ pista: string }>('/tutor-ia/pista', { ejercicio_id: ejercicioId, nivel_pista: nivel });
      setPistas((p) => ({ ...p, [nivel]: r.pista })); setAbierta(nivel);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo obtener la pista.'); }
    finally { setCargando(false); }
  }

  // Sugerencias rápidas CONTEXTUALES al tipo de ejercicio.
  const esCodigo = tipo === 'completar_codigo' || tipo === 'ordenar_lineas';
  const chips = [
    'No entiendo el enunciado',
    esCodigo ? '¿Por dónde empiezo?' : '¿Por qué está mal mi respuesta?',
    'Dame un ejemplo',
    'Explícamelo más simple',
  ];

  return (
    // Panel CONTENIDO: header/chips/input fijos y el chat con scroll interno, a
    // cualquier tamaño. Solo se PEGA (sticky) en xl+, que es donde va en columna
    // propia junto al ejercicio; por debajo se apila y fluye con la página.
    <div className="flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-lift xl:sticky xl:top-24">
      {/* Header con avatar + estado */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line bg-gradient-to-r from-prexi-navy to-prexi-navy-soft px-4 py-3.5">
        <TutorAvatar estado={estadoAvatar} size={44} />
        <div className="min-w-0">
          <p className="font-bold leading-tight text-white">PREXI · <span className="font-semibold text-blue-100/90">Tu tutor</span></p>
          <p className="flex items-center gap-1.5 text-xs text-blue-100/75">
            <span className={`h-1.5 w-1.5 rounded-full ${cargando ? 'bg-prexi-amber' : 'bg-prexi-green'} ${cargando ? '' : 'animate-pulse-soft'}`} />
            {estadoTexto}
          </p>
        </div>
      </div>

      {/* Cuerpo scrollable: chat + pistas */}
      <div ref={cuerpoRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {mensajes.map((m) => (
          <div key={m.id} className={m.de === 'tu' ? 'flex justify-end' : 'flex items-start gap-2'}>
            {m.de === 'tutor' && <TutorAvatar estado="atento" size={26} className="mt-0.5" />}
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              m.de === 'tu'
                ? 'rounded-br-md bg-prexi-blue text-accent-on'
                : 'rounded-bl-md bg-subtle text-fg'}`}>
              {m.de === 'tutor'
                ? (m.texto ? (
                    <>
                      <div className="prose-tutor"><Markdown content={m.texto} /></div>
                      {/* Escuchar esta respuesta (Web Speech API; oculto si no hay soporte) */}
                      {!cargando && <div className="mt-1 flex justify-end"><BotonVoz texto={m.texto} /></div>}
                    </>
                  ) : <EscribiendoDots />)
                : m.texto}
            </div>
          </div>
        ))}
        {cargando && mensajes[mensajes.length - 1]?.de === 'tu' && (
          <div className="flex items-start gap-2"><TutorAvatar estado="pensando" size={26} className="mt-0.5" /><div className="rounded-2xl rounded-bl-md bg-subtle px-3.5 py-3"><EscribiendoDots /></div></div>
        )}

        {/* Pistas progresivas (acordeón con candado + costo XP honesto) */}
        <div className="!mt-4 rounded-xl border border-line bg-subtle/50 p-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 px-1 text-2xs font-bold uppercase tracking-wide text-muted">
            <Lightbulb className="h-3.5 w-3.5 text-prexi-amber" /> Pistas progresivas
          </p>
          <div className="space-y-1.5">
            {([1, 2, 3] as const).map((nivel) => {
              const bloqueada = nivel > maxPistas;
              const desbloqueada = !!pistas[nivel];
              const open = abierta === nivel && desbloqueada;
              return (
                <div key={nivel} className={`overflow-hidden rounded-lg border transition ${open ? 'border-prexi-blue/40' : 'border-line'} bg-card`}>
                  <button disabled={bloqueada || cargando} onClick={() => pedirPista(nivel)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-45">
                    <span className="flex min-w-0 items-center gap-2">
                      {bloqueada ? <Lock className="h-4 w-4 shrink-0 text-muted" /> : desbloqueada ? <Lightbulb className="h-4 w-4 shrink-0 text-prexi-amber" /> : <Lock className="h-4 w-4 shrink-0 text-prexi-blue-deep" />}
                      <span className="truncate"><b className="font-semibold text-fg">Pista {nivel}</b> <span className="text-muted">· {ETIQUETA[nivel]}</span></span>
                    </span>
                    {desbloqueada
                      ? <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                      : <span className="shrink-0 rounded-full bg-prexi-amber/15 px-2 py-0.5 text-2xs font-bold text-prexi-amber">cuesta XP</span>}
                  </button>
                  {open && <div className="border-t border-line px-3 py-2.5 text-sm leading-relaxed text-fg"><Markdown content={pistas[nivel]} /></div>}
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 px-1 text-2xs leading-snug text-muted">Cada pista que abras reduce un poco el XP del ejercicio. Úsalas cuando de verdad lo necesites.</p>
        </div>

        {error && <p className="!mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-prexi-red">{error}</p>}
      </div>

      {/* Sugerencias rápidas (bajan la barrera de uso) */}
      <div className="shrink-0 border-t border-line px-3 pt-2.5">
        <p className="mb-1.5 flex items-center gap-1 px-0.5 text-2xs font-semibold text-muted"><Sparkles className="h-3 w-3 text-prexi-blue-deep" /> Pregúntame rápido:</p>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c} disabled={cargando} onClick={() => enviar(c)}
              className="rounded-full border border-prexi-blue/30 bg-prexi-blue/10 px-2.5 py-1 text-xs font-medium text-prexi-blue-deep transition hover:border-prexi-blue/60 hover:bg-prexi-blue/20 disabled:opacity-45">
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Input fijo al fondo DENTRO de la tarjeta */}
      <div className="flex shrink-0 items-end gap-2 p-3">
        <input
          className="input min-w-0 flex-1 !py-2.5 text-sm"
          placeholder="Escríbele a PREXI…"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar(pregunta)}
          disabled={cargando}
        />
        <button onClick={() => enviar(pregunta)} disabled={cargando || !pregunta.trim()} aria-label="Enviar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-prexi-blue text-accent-on shadow-glow transition hover:bg-prexi-blue-hover disabled:opacity-50 disabled:shadow-none">
          <Send className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}

/** Indicador "PREXI está escribiendo…" con puntos animados. */
function EscribiendoDots() {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className="inline-flex gap-1">
        <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-prexi-blue-deep" style={{ animationDelay: '0s' }} />
        <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-prexi-blue-deep" style={{ animationDelay: '.15s' }} />
        <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-prexi-blue-deep" style={{ animationDelay: '.3s' }} />
      </span>
      <span className="text-xs">PREXI está escribiendo…</span>
    </span>
  );
}
