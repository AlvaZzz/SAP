'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { CodeEditor } from '@/components/code-editor';
import { TraceViewer, PasoTraza } from '@/components/trace-viewer';
import { ejecutarPython, trazarPython, precargarPython, onCargaRuntime } from '@/lib/python-runtime';
import { TutorRetoPanel } from '@/components/tutor-reto-panel';
import { OrigenEjercicio, type OrigenReto } from '@/components/origen-ejercicio';
import { useAnimo } from '@/components/animo-tutor';
import { TIPOS_RETO } from '@/components/docente/retos/tipos';
import { NIVEL_COLOR, NIVEL_LABEL } from '@/lib/types';
import { Play, RotateCcw, Upload, CheckCircle, Clock, AlertTriangle, ChevronLeft, Layers } from '@/components/icons';

type EstadoEntrega = 'sin_entregar' | 'pendiente_revision' | 'aprobado' | 'necesita_mejorar';
interface Entrega { estado: EstadoEntrega; xp_obtenido: number; feedback: string | null; codigo?: string | null }
interface Reto {
  titulo: string; enunciado: string; codigoInicial: string | null;
  ejemploEntrada: string | null; ejemploSalida: string | null; fechaLimite: string | null;
  esBugHunt?: boolean; autoCalificable?: boolean; contextoTema?: string;
  nivelDificultad?: 'basico' | 'intermedio' | 'avanzado';
  /** Ejercicio del banco del que se derivó este reto (trazabilidad). */
  origen?: OrigenReto | null;
}
interface Emblema { clave: string; nombre: string; descripcion: string; icono: string }

/**
 * Editor del reto. El entorno de código (editor + consola + PREXI) SOLO aparece
 * al entrar a un reto concreto; ya no existe una "Práctica" libre suelta. El
 * acceso lo controla el backend (nivel Intermedio/Avanzado habilitado por el docente).
 */
export default function RetoEditorPage() {
  const router = useRouter();
  const params = useParams();
  const retoId = Number(params.id);

  const [reto, setReto] = useState<Reto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [bloqueado, setBloqueado] = useState<string | null>(null);
  const { alentar } = useAnimo();
  const [codigo, setCodigo] = useState('');
  const [salida, setSalida] = useState<{ texto: string; ok: boolean } | null>(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [entrega, setEntrega] = useState<Entrega | null>(null);
  const [entregando, setEntregando] = useState(false);
  const [avisoEntrega, setAvisoEntrega] = useState('');
  // Visualizador de traza
  const [traza, setTraza] = useState<{ pasos: PasoTraza[]; error: string | null; codigo: string } | null>(null);
  const refTraza = useRef<HTMLElement>(null);
  const [trazando, setTrazando] = useState(false);
  // Bug‑hunt: resultado de la auto‑validación
  const [verif, setVerif] = useState<{ correcto: boolean; salida: string; esperado: string; xp: number; emblemas: Emblema[] } | null>(null);
  const [verificando, setVerificando] = useState(false);
  // Carga del runtime de Python en el navegador (la primera vez tarda unos
  // segundos: se descarga Pyodide desde el CDN y se cachea para la sesión).
  const [cargandoPython, setCargandoPython] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(retoId)) { router.replace('/retos'); return; }
    api.get<{ reto: Reto | null; entrega: Entrega | null }>(`/retos/${retoId}`)
      .then((r) => {
        if (!r.reto) { setBloqueado('Este reto no está disponible.'); return; }
        setReto(r.reto);
        setEntrega(r.entrega);
        setCodigo(r.entrega?.codigo || r.reto.codigoInicial || '# Escribe tu solución aquí\n');
      })
      .catch((err) => {
        // 403 del guard de acceso (nivel Básico o no habilitado por el docente).
        if (err instanceof ApiError && err.status === 403) { router.replace('/retos'); return; }
        setBloqueado('No se pudo cargar el reto.');
      })
      .finally(() => setCargando(false));
  }, [retoId, router]);

  // Se precarga al entrar al reto para que el primer "Ejecutar" no espere la
  // descarga completa del runtime.
  useEffect(() => {
    const off = onCargaRuntime(setCargandoPython);
    precargarPython();
    return off;
  }, []);

  async function ejecutar() {
    setEjecutando(true); setSalida(null);
    try {
      // La ejecución ocurre EN EL NAVEGADOR (Pyodide en un Web Worker): el código
      // del estudiante no viaja al backend.
      const r = await ejecutarPython(codigo);
      const texto = r.sandboxError
        || (r.timeout ? 'Tu código tardó demasiado (posible bucle infinito). Revisa la condición de corte.' : '')
        || (r.ok ? r.stdout : r.stderr || r.stdout)
        || '(sin salida)';
      setSalida({ texto, ok: r.ok && !r.sandboxError && !r.timeout });
      // Persistir es "mejor esfuerzo": si falla, la ejecución ya se mostró.
      void api.post('/practica/ejecucion', { codigo, salida: texto, contexto: 'reto', refId: retoId }).catch(() => undefined);
    } catch {
      setSalida({ texto: 'Error al ejecutar. Intenta de nuevo.', ok: false });
    } finally { setEjecutando(false); }
  }

  async function entregarReto() {
    setEntregando(true); setAvisoEntrega('');
    try {
      const r = await api.post<{ estado: EstadoEntrega }>(`/retos/${retoId}/entregar`, { codigo });
      setEntrega({ estado: r.estado, xp_obtenido: 0, feedback: null });
      // Ánimo del tutor como tarjeta arriba (igual que en los ejercicios).
      alentar('Reto entregado. Tu docente lo revisará pronto. Mientras, puedes seguir practicando.', 'felicitacion');
    } catch (err) {
      setAvisoEntrega(err instanceof ApiError ? err.message : 'No se pudo entregar el reto');
    } finally { setEntregando(false); }
  }

  async function verTraza() {
    setTrazando(true); setTraza(null);
    try {
      const r = await trazarPython(codigo);
      setTraza({ pasos: r.pasos, error: r.error, codigo });
      // Aparece debajo del editor: se lleva la vista hasta allí.
      setTimeout(() => refTraza.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    } catch {
      setTraza({ pasos: [], error: 'No se pudo generar el paso a paso.', codigo });
    } finally { setTrazando(false); }
  }

  async function verificarBug() {
    setVerificando(true); setAvisoEntrega(''); setVerif(null);
    try {
      // Se ejecuta aquí y se manda SOLO la salida: el backend compara contra la
      // esperada. Ya no otorga XP (esa salida la produce el cliente).
      const ej = await ejecutarPython(codigo);
      const salidaObtenida = ej.sandboxError
        || (ej.timeout ? 'Tu código tardó demasiado (posible bucle infinito).' : '')
        || (ej.ok ? ej.stdout : ej.stderr || ej.stdout);
      const r = await api.post<{ correcto: boolean; salida: string; esperado: string; xp: number; emblemas_nuevos: Emblema[] }>('/practica/verificar-reto', { retoId, salida: salidaObtenida });
      setVerif({ correcto: r.correcto, salida: r.salida, esperado: r.esperado, xp: r.xp, emblemas: r.emblemas_nuevos });
      if (r.correcto) {
        setEntrega({ estado: 'aprobado', xp_obtenido: r.xp, feedback: null });
        alentar(`Bug corregido. ${r.xp > 0 ? `+${r.xp} XP. ` : ''}Cazaste el error tú mismo; así se aprende a depurar.`, 'felicitacion');
      } else {
        alentar('Todavía no coincide. Compara tu salida con la esperada y revisa la lógica con calma.');
      }
    } catch (err) {
      setAvisoEntrega(err instanceof ApiError ? err.message : 'No se pudo verificar');
    } finally { setVerificando(false); }
  }

  if (cargando) return <div className="grid min-h-[60vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-prexi-blue" /></div>;
  if (bloqueado || !reto) return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center">
      <div className="card max-w-md">
        <p className="text-sm text-muted">{bloqueado || 'Reto no disponible.'}</p>
        <button onClick={() => router.push('/retos')} className="btn-primary mt-4"><ChevronLeft className="h-4 w-4" /> Volver a Retos</button>
      </div>
    </div>
  );

  const est = entrega?.estado;
  const esAuto = !!(reto.esBugHunt || reto.autoCalificable);
  const tipoReto = reto.esBugHunt ? 'bug' : 'codigo';
  const infoTipo = TIPOS_RETO[tipoReto];
  const bloqueoEntrega = est === 'pendiente_revision' || est === 'aprobado';

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <button onClick={() => router.push(`/retos?tipo=${tipoReto}`)} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-fg"><ChevronLeft className="h-4 w-4" /> Volver a los retos</button>

        {/* Qué reto es */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: infoTipo.color, backgroundColor: `${infoTipo.color}1F` }}>
            <infoTipo.Icono className="h-3.5 w-3.5" /> {infoTipo.nombre}
          </span>
          {reto.nivelDificultad && <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: NIVEL_COLOR[reto.nivelDificultad], backgroundColor: `${NIVEL_COLOR[reto.nivelDificultad]}1F` }}>Nivel {NIVEL_LABEL[reto.nivelDificultad]}</span>}
          {reto.contextoTema && <span className="text-xs font-medium text-muted">{reto.contextoTema}</span>}
          {reto.fechaLimite && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Clock className="h-3.5 w-3.5" /> Hasta el {new Date(reto.fechaLimite).toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })}
            </span>
          )}
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{reto.titulo}</h1>

        {/* Qué hay que hacer */}
        <div className="mt-3 grid items-start gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="card border-l-4" style={{ borderLeftColor: infoTipo.color }}>
            <p className="text-2xs font-bold uppercase tracking-wide text-muted">{esAuto ? 'Tu misión' : 'Lo que tienes que programar'}</p>
            <p className="mt-1 whitespace-pre-line text-base leading-relaxed text-fg">{reto.enunciado}</p>
            {(reto.ejemploEntrada || reto.ejemploSalida) && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {reto.ejemploEntrada && (
                  <div className="rounded-xl bg-subtle px-3 py-2">
                    <p className="text-2xs font-bold uppercase tracking-wide text-muted">Ejemplo de entrada</p>
                    <pre className="mt-0.5 whitespace-pre-wrap font-mono text-sm text-fg">{reto.ejemploEntrada}</pre>
                  </div>
                )}
                {reto.ejemploSalida && (
                  <div className="rounded-xl bg-prexi-green/10 px-3 py-2">
                    <p className="text-2xs font-bold uppercase tracking-wide text-prexi-green">{esAuto ? 'Debe imprimir exactamente' : 'Salida esperada'}</p>
                    <pre className="mt-0.5 whitespace-pre-wrap font-mono text-sm text-fg">{reto.ejemploSalida}</pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cómo se resuelve, en tres pasos */}
          <div className="card">
            <p className="text-2xs font-bold uppercase tracking-wide text-muted">Cómo resolverlo</p>
            <ol className="mt-2 space-y-2.5 text-base">
            {[
              reto.esBugHunt ? 'Lee el código: tiene un error escondido.' : 'Escribe tu programa en el editor.',
              'Pulsa «Ejecutar» para probarlo. Si no entiendes qué pasa, usa «Ver paso a paso».',
              esAuto ? 'Cuando la salida sea la correcta, pulsa «Comprobar»: sabrás al instante si lo lograste.' : 'Cuando funcione, pulsa «Entregar»: tu docente lo revisará.',
            ].map((texto, i) => (
              <li key={texto} className="flex items-start gap-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-prexi-blue/15 text-xs font-bold text-prexi-blue-deep">{i + 1}</span>
                <span className="text-muted">{texto}</span>
              </li>
            ))}
            </ol>
          </div>
        </div>

        {/* TRAZABILIDAD: de qué ejercicio del banco salió este reto. Si falla, es
            el material que debe repasar — no una explicación genérica. */}
        {reto.origen && <OrigenEjercicio origen={reto.origen} />}

        {entrega && entrega.estado !== 'sin_entregar' && (
          <div className={`mt-3 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            entrega.estado === 'aprobado' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : entrega.estado === 'necesita_mejorar' ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'border-prexi-blue/40 bg-prexi-blue/10 text-prexi-blue-deep'}`} role="status">
            {entrega.estado === 'aprobado' ? <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
              : entrega.estado === 'necesita_mejorar' ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              : <Clock className="mt-0.5 h-5 w-5 shrink-0" />}
            <div>
              <p className="font-bold">
                {entrega.estado === 'aprobado' ? `Reto aprobado${entrega.xp_obtenido > 0 ? `: ganaste ${entrega.xp_obtenido} XP` : ''}`
                  : entrega.estado === 'necesita_mejorar' ? 'Tu docente te pide mejorarlo. Corrige y vuelve a entregar.'
                  : 'Entregado. Falta que tu docente lo revise.'}
              </p>
              {entrega.feedback && <p className="mt-0.5 text-fg"><b>Tu docente dice:</b> {entrega.feedback}</p>}
            </div>
          </div>
        )}
        {avisoEntrega && <p className="mt-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-prexi-red" role="alert">{avisoEntrega}</p>}
      </div>

      {/* Escritorio amplio (xl): editor ancho + panel de PREXI cómodo. Por debajo
          de xl, el panel de PREXI se apila DEBAJO del editor, a todo el ancho. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        {/* Editor + consola, y debajo la ejecución paso a paso */}
        <div className="min-w-0">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#04162E] shadow-soft">
          <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-2 font-mono text-xs text-slate-400">main.py</span>
            </div>
          </div>
          <div className="h-[19rem] overflow-hidden sm:h-[22rem] xl:h-[24rem]">
            <CodeEditor value={codigo} onChange={setCodigo} height="100%" className="h-full" />
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-slate-700/80 px-3 py-3 sm:flex sm:flex-wrap sm:items-center sm:px-4">
            <button onClick={ejecutar} disabled={ejecutando || cargandoPython} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-prexi-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.98] disabled:opacity-60">
              <Play className="h-4 w-4" /> {cargandoPython ? 'Preparando Python…' : ejecutando ? 'Ejecutando…' : 'Ejecutar'}
            </button>
            <button onClick={verTraza} disabled={trazando || cargandoPython} title="Ejecuta el programa línea por línea y muestra cuánto vale cada variable"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 py-2.5 text-sm font-semibold text-slate-200 sm:px-4 transition hover:bg-slate-800 disabled:opacity-60">
              <Layers className="h-4 w-4" /> {trazando ? 'Preparando…' : 'Ver paso a paso'}
            </button>
            <button onClick={() => { if (confirm('¿Borrar lo que escribiste y volver al código inicial?')) setCodigo(reto.codigoInicial || '# Escribe tu solución aquí\n'); }} title="Vuelve al código con el que empezó el reto" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 py-2.5 text-sm font-semibold text-slate-200 sm:px-4 transition hover:bg-slate-800">
              <RotateCcw className="h-4 w-4" /> Empezar de nuevo
            </button>
            {/* Los retos DERIVADOS del banco (y los bug-hunt) se autocalifican
                comparando la salida; el resto va a revisión del docente. */}
            {reto.esBugHunt || reto.autoCalificable ? (
              <button onClick={verificarBug} disabled={verificando || est === 'aprobado'}
                title={est === 'aprobado' ? 'Ya resolviste este reto' : 'Comprobar tu solución contra la salida esperada'}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-prexi-blue px-5 py-2.5 text-sm font-semibold text-white sm:ml-auto transition hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                <CheckCircle className="h-4 w-4" />
                {verificando ? 'Verificando…'
                  : est === 'aprobado' ? (reto.esBugHunt ? 'Bug corregido' : 'Resuelto')
                  : 'Comprobar'}
              </button>
            ) : (
              <button onClick={entregarReto} disabled={entregando || bloqueoEntrega}
                title={bloqueoEntrega ? 'Ya entregaste este reto' : 'Enviar tu solución al docente'}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-prexi-blue px-5 py-2.5 text-sm font-semibold text-white sm:ml-auto transition hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                <Upload className="h-4 w-4" /> {entregando ? 'Entregando…' : est === 'necesita_mejorar' ? 'Volver a entregar' : est === 'aprobado' ? 'Aprobado' : est === 'pendiente_revision' ? 'En revisión' : 'Entregar'}
              </button>
            )}
          </div>
          <div className="border-t border-slate-700/80 px-4 py-3">
            <p className="mb-1.5 flex items-center gap-2 font-mono text-xs text-slate-400">▸ Lo que imprime tu programa {salida && <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${salida.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>{salida.ok ? 'Terminó bien' : 'Hubo un error'}</span>}</p>
            <pre className={`max-h-44 overflow-auto whitespace-pre-wrap font-mono text-sm ${salida ? (salida.ok ? 'text-green-300' : 'text-red-300') : 'text-slate-500'}`}>
              {salida ? salida.texto : cargandoPython ? 'Preparando el entorno de Python… (solo la primera vez)' : 'Aquí verás el resultado cuando pulses «Ejecutar».'}
            </pre>
          </div>
          {verif && (
            <div className={`border-t border-slate-700/80 p-4 ${verif.correcto ? 'bg-emerald-950/55' : 'bg-amber-950/45'}`}>
              {verif.correcto ? (
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />
                  <div>
                    <p className="font-bold text-emerald-200">¡Lo lograste! {verif.xp > 0 ? `+${verif.xp} XP` : ''}</p>
                    <p className="text-sm text-emerald-100/80">Tu programa imprime exactamente lo que se esperaba.</p>
                    {verif.emblemas.map((e) => (
                      <p key={e.clave} className="mt-1 text-sm font-semibold text-emerald-100">Emblema desbloqueado: {e.nombre}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
                  <div className="min-w-0">
                    <p className="font-bold text-amber-100">Todavía no coincide.</p>
                    <p className="mt-0.5 text-sm text-amber-100/75">Compara las dos salidas: fíjate en qué se diferencian. «Ver paso a paso» te ayuda a encontrar dónde se desvía.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-rose-300/20 bg-rose-950/30 p-2.5"><p className="text-2xs font-bold uppercase tracking-wide text-rose-200">Tu salida</p><pre className="mt-1 overflow-x-auto rounded-lg border border-rose-200/10 bg-[#120d16] px-3 py-2 font-mono text-base leading-6 text-rose-100">{verif.salida || '(vacía)'}</pre></div>
                      <div className="rounded-xl border border-emerald-300/20 bg-emerald-950/30 p-2.5"><p className="text-2xs font-bold uppercase tracking-wide text-emerald-200">Salida esperada</p><pre className="mt-1 overflow-x-auto rounded-lg border border-emerald-200/10 bg-[#091710] px-3 py-2 font-mono text-base leading-6 text-emerald-100">{verif.esperado}</pre></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {traza && (
          <section ref={refTraza} className="mt-5 scroll-mt-24" aria-label="Ejecución paso a paso">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-fg"><Layers className="h-5 w-5 text-prexi-blue-deep" /> Tu programa, paso a paso</h2>
                <p className="text-sm text-muted">Avanza con las flechas o pulsa «Reproducir». Mira qué línea se ejecuta y cómo cambian las variables.</p>
              </div>
              <button onClick={() => setTraza(null)} className="btn-ghost text-sm">Cerrar</button>
            </div>
            <TraceViewer codigo={traza.codigo} pasos={traza.pasos} error={traza.error} />
          </section>
        )}
        </div>

        {/* Tutor PREXI completo (chat con streaming + pistas + chips), igual que en ejercicios */}
        <TutorRetoPanel retoId={retoId} contextoTema={reto.contextoTema} enunciado={reto.enunciado} codigo={codigo} esBugHunt={reto.esBugHunt} />
      </div>

    </div>
  );
}
