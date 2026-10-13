'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Markdown } from '@/components/markdown';
import { TutorAvatar, EstadoTutor } from '@/components/tutor-avatar';
import { BotonVoz } from '@/components/boton-voz';
import { useAuth } from '@/providers/auth-provider';
import { useVoz } from '@/lib/voz';
import { avisoPrexi, nombreDePila } from '@/lib/prexi-amable';
import { Lightbulb, Lock, ChevronDown, Send, Sparkles } from '@/components/icons';

const ETIQUETA: Record<number, string> = { 1: 'Por dónde empezar', 2: 'Dónde está el problema', 3: 'Casi la solución' };

interface Mensaje { id: number; de: 'tutor' | 'tu'; texto: string }

/**
 * Panel del tutor PREXI en el editor de RETOS. Es el gemelo del panel de los
 * ejercicios (components/tutor-panel.tsx) pero orientado al CÓDIGO: chat con
 * streaming sobre lo que el estudiante lleva escrito, chips contextuales, pistas
 * progresivas en acordeón e indicador "escribiendo". Consume /tutor-ia/practica
 * (/stream) y /tutor-ia/pista-reto.
 *
 * Las pistas de reto NO restan XP (el reto lo evalúa el docente, o el bug‑hunt da
 * XP fijo): quedan REGISTRADAS y cuentan para tu indicador de Autonomía. PREXI
 * GUÍA sobre el código, no lo resuelve.
 *
 * `codigo` se lee en el momento de enviar vía ref para no arrastrar un valor
 * obsoleto por el closure mientras el estudiante teclea en el editor.
 */
export function TutorRetoPanel({ retoId, contextoTema, enunciado, codigo, esBugHunt }: {
  retoId: number; contextoTema?: string; enunciado?: string; codigo: string; esBugHunt?: boolean;
}) {
  const { usuario } = useAuth();
  const saludo = nombreDePila(usuario);
  const hola = saludo ? `Hola, ${saludo}.` : 'Hola.';
  const bienvenida = contextoTema
    ? `${hola} Estás en **${contextoTema}**. Escribe tu código y pregúntame lo que quieras: reviso lo que llevas y te oriento, pero no lo resuelvo por ti.`
    : `${hola} Soy PREXI. Escribe tu código y pregúntame: reviso lo que llevas y te guío para que lo resuelvas tú.`;

  const { hablar } = useVoz();
  const [mensajes, setMensajes] = useState<Mensaje[]>([{ id: 0, de: 'tutor', texto: bienvenida }]);
  const [pregunta, setPregunta] = useState('');
  const [pistas, setPistas] = useState<Record<number, string>>({});
  const [abierta, setAbierta] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<{ titulo: string; texto: string } | null>(null);
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  // Código SIEMPRE actualizado para leerlo al enviar (evita el closure obsoleto).
  const codigoRef = useRef(codigo);
  useEffect(() => { codigoRef.current = codigo; }, [codigo]);

  // Auto-scroll al último mensaje / mientras escribe.
  useEffect(() => { cuerpoRef.current?.scrollTo({ top: cuerpoRef.current.scrollHeight, behavior: 'smooth' }); }, [mensajes, cargando, abierta]);

  function empujar(de: Mensaje['de'], texto: string) {
    setMensajes((m) => [...m, { id: nextId.current++, de, texto }]);
  }

  const estadoAvatar: EstadoTutor = cargando ? 'pensando' : 'atento';
  const estadoTexto = cargando ? 'Revisando tu código…' : 'En línea · revisando tu código';

  async function enviar(texto: string) {
    const q = texto.trim();
    if (!q || cargando) return;
    setPregunta('');
    empujar('tu', q);
    setCargando(true); setError(null);
    const cuerpo = { codigo_actual: codigoRef.current || '# (sin código todavía)', enunciado_reto: enunciado, pregunta: q };
    const idTutor = nextId.current++;
    setMensajes((m) => [...m, { id: idTutor, de: 'tutor', texto: '' }]);
    const set = (t: string) => setMensajes((m) => m.map((x) => (x.id === idTutor ? { ...x, texto: t } : x)));
    try {
      const res = await fetch('/api/tutor-ia/practica/stream', {
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
      else if (usuario?.vozAutomatica) hablar(acc);
    } catch (streamErr) {
      // Fallback robusto: si el streaming falla, usa el endpoint normal.
      try {
        const r = await api.post<{ respuesta: string }>('/tutor-ia/practica', cuerpo);
        set(r.respuesta);
      } catch (err) {
        set('');
        setMensajes((m) => m.filter((x) => x.id !== idTutor));
        setError(avisoPrexi(err instanceof ApiError ? err : streamErr));
      }
    } finally { setCargando(false); }
  }

  async function pedirPista(nivel: 1 | 2 | 3) {
    if (pistas[nivel]) { setAbierta(abierta === nivel ? null : nivel); return; }
    setCargando(true); setError(null);
    try {
      const r = await api.post<{ pista: string }>('/tutor-ia/pista-reto', { reto_id: retoId, nivel_pista: nivel, codigo_actual: codigoRef.current || '# (sin código todavía)' });
      setPistas((p) => ({ ...p, [nivel]: r.pista })); setAbierta(nivel);
    } catch (err) { setError(avisoPrexi(err)); }
    finally { setCargando(false); }
  }

  // Siguiente pista disponible (para el chip "Dame una pista").
  const siguientePista = ([1, 2, 3] as const).find((n) => !pistas[n]) ?? 3;

  const chips: { texto: string; accion: () => void }[] = [
    { texto: '¿Por qué falla mi código?', accion: () => enviar('¿Por qué falla mi código?') },
    { texto: 'Dame una pista', accion: () => pedirPista(siguientePista) },
    { texto: '¿Por dónde empiezo?', accion: () => enviar('¿Por dónde empiezo?') },
    { texto: 'Revisa mi lógica', accion: () => enviar('Revisa la lógica de mi código, ¿tiene sentido?') },
  ];

  return (
    // Panel CONTENIDO: header/chips/input fijos y el chat con scroll interno.
    // Sticky en xl+ (donde va en columna propia junto al editor).
    <div className="flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-lift xl:sticky xl:top-24">
      {/* Header con avatar + estado */}
      <div className="relative flex shrink-0 items-center gap-3 overflow-hidden border-b border-line bg-gradient-to-r from-prexi-navy to-prexi-navy-soft px-4 py-3.5">
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
              m.de === 'tu' ? 'rounded-br-md bg-prexi-blue text-accent-on' : 'rounded-bl-md bg-subtle text-fg'}`}>
              {m.de === 'tutor'
                ? (m.texto ? (
                    <>
                      <div className="prose-tutor"><Markdown content={m.texto} /></div>
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

        {/* Pistas progresivas (acordeón). Para retos NO restan XP: se registran. */}
        <div className="!mt-4 rounded-xl border border-line bg-subtle/50 p-2.5">
          <p className="mb-1.5 flex items-center gap-1.5 px-1 text-2xs font-bold uppercase tracking-wide text-muted">
            <Lightbulb className="h-3.5 w-3.5 text-prexi-amber" /> ¿Te trabaste? Pide una pista
          </p>
          <div className="space-y-1.5">
            {([1, 2, 3] as const).map((nivel) => {
              const bloqueada = nivel > 1 && !pistas[nivel - 1]; // deben pedirse en orden
              const desbloqueada = !!pistas[nivel];
              const open = abierta === nivel && desbloqueada;
              return (
                <div key={nivel} className={`overflow-hidden rounded-lg border transition ${open ? 'border-prexi-blue/40' : 'border-line'} bg-card`}>
                  <button disabled={bloqueada || cargando} onClick={() => pedirPista(nivel)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-45">
                    <span className="flex min-w-0 items-center gap-2">
                      {bloqueada ? <Lock className="h-4 w-4 shrink-0 text-muted" /> : desbloqueada ? <Lightbulb className="h-4 w-4 shrink-0 text-prexi-amber" /> : <Lightbulb className="h-4 w-4 shrink-0 text-prexi-blue-deep" />}
                      <span className="truncate"><b className="font-semibold text-fg">Pista {nivel}</b> <span className="text-muted">· {ETIQUETA[nivel]}</span></span>
                    </span>
                    {desbloqueada
                      ? <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                      : bloqueada ? <span className="shrink-0 text-2xs font-semibold text-muted">pide la {nivel - 1}</span>
                        : <span className="shrink-0 rounded-full bg-prexi-blue/15 px-2 py-0.5 text-2xs font-bold text-prexi-blue-deep">pedir</span>}
                  </button>
                  {open && <div className="border-t border-line px-3 py-2.5 text-sm leading-relaxed text-fg"><Markdown content={pistas[nivel]} /></div>}
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 px-1 text-2xs leading-snug text-muted">Las pistas no restan XP del reto, pero quedan registradas y cuentan para tu <b className="text-fg">Autonomía</b>. Úsalas cuando de verdad las necesites.</p>
        </div>

        {error && (
          <div className="!mt-3 flex items-start gap-2.5 rounded-xl border border-prexi-amber/40 bg-prexi-amber/10 px-3 py-2.5" role="status">
            <TutorAvatar estado="atento" size={28} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-fg">{error.titulo}</p>
              <p className="text-sm leading-snug text-muted">{error.texto}</p>
            </div>
            <button onClick={() => setError(null)} aria-label="Cerrar aviso" className="shrink-0 text-xs font-semibold text-muted hover:text-fg">Cerrar</button>
          </div>
        )}
      </div>

      {/* Sugerencias rápidas */}
      <div className="shrink-0 border-t border-line px-3 pt-2.5">
        <p className="mb-1.5 flex items-center gap-1 px-0.5 text-xs font-semibold text-muted"><Sparkles className="h-3.5 w-3.5 text-prexi-amber" /> Toca una pregunta o escribe la tuya:</p>
        <div className="grid grid-cols-2 gap-1.5">
          {chips.map((c) => (
            <button key={c.texto} disabled={cargando} onClick={c.accion}
              className="rounded-xl border border-prexi-blue/30 bg-prexi-blue/10 px-2.5 py-2 text-left text-sm font-semibold leading-tight text-prexi-blue-deep transition hover:border-prexi-blue/60 hover:bg-prexi-blue/20 disabled:opacity-45">
              {c.texto}
            </button>
          ))}
        </div>
      </div>

      {/* Input fijo al fondo DENTRO de la tarjeta */}
      <div className="flex shrink-0 items-end gap-2 p-3">
        <input
          className="input min-w-0 flex-1 !py-2.5 text-sm"
          placeholder="Escribe tu duda sobre tu código…"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar(pregunta)}
          disabled={cargando}
        />
        <button onClick={() => enviar(pregunta)} disabled={cargando || !pregunta.trim()} aria-label="Enviar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-prexi-blue text-accent-on transition hover:bg-prexi-blue-hover disabled:opacity-40">
          <Send className="h-[18px] w-[18px]" />
        </button>
      </div>
      <p className="shrink-0 px-3 pb-2 text-center text-2xs text-muted">PREXI te guía, no resuelve por ti</p>
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
