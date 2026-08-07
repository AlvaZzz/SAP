'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { CodeEditor } from '@/components/code-editor';
import { TraceViewer, PasoTraza } from '@/components/trace-viewer';
import { ejecutarPython, trazarPython, precargarPython, onCargaRuntime } from '@/lib/python-runtime';
import { AlvaroRetoPanel } from '@/components/alvaro-reto-panel';
import { OrigenEjercicio, type OrigenReto } from '@/components/origen-ejercicio';
import { useAnimo } from '@/components/animo-alvaro';
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
 * Editor del reto. El entorno de código (editor + consola + ALVARO) SOLO aparece
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
  const [traza, setTraza] = useState<{ pasos: PasoTraza[]; error: string | null } | null>(null);
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
      setTraza({ pasos: r.pasos, error: r.error });
    } catch {
      setTraza({ pasos: [], error: 'No se pudo generar la traza.' });
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
  const bloqueoEntrega = est === 'pendiente_revision' || est === 'aprobado';

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <button onClick={() => router.push('/retos')} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-fg"><ChevronLeft className="h-4 w-4" /> Retos</button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{reto.titulo}</h1>
          {reto.esBugHunt && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">Misión de depuración</span>}
        </div>
        <p className="mt-2 rounded-xl bg-prexi-blue/10 px-4 py-2.5 text-sm text-fg"><b className="text-prexi-blue-deep">{reto.esBugHunt ? 'Encuentra y corrige el bug:' : 'Reto:'}</b> {reto.enunciado}</p>

        {(reto.ejemploEntrada || reto.ejemploSalida || reto.fechaLimite) && (
          <div className="mt-2 flex flex-wrap items-stretch gap-2 text-sm">
            {reto.ejemploEntrada && (
              <div className="rounded-xl border border-line bg-card px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Entrada</p>
                <pre className="whitespace-pre-wrap font-mono text-xs text-fg">{reto.ejemploEntrada}</pre>
              </div>
            )}
            {reto.ejemploSalida && (
              <div className="rounded-xl border border-line bg-card px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Salida esperada</p>
                <pre className="whitespace-pre-wrap font-mono text-xs text-fg">{reto.ejemploSalida}</pre>
              </div>
            )}
            {reto.fechaLimite && (
              <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Clock className="h-3.5 w-3.5" /> Límite: {new Date(reto.fechaLimite).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            )}
          </div>
        )}

        {/* TRAZABILIDAD: de qué ejercicio del banco salió este reto. Si falla, es
            el material que debe repasar — no una explicación genérica. */}
        {reto.origen && <OrigenEjercicio origen={reto.origen} />}

        {entrega && entrega.estado !== 'sin_entregar' && (
          <div className={`mt-3 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
            entrega.estado === 'aprobado' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : entrega.estado === 'necesita_mejorar' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'bg-prexi-blue/10 text-prexi-blue-deep'}`}>
            {entrega.estado === 'aprobado' ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              : entrega.estado === 'necesita_mejorar' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              : <Clock className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <p className="font-semibold">
                {entrega.estado === 'aprobado' ? `¡Aprobado! +${entrega.xp_obtenido} XP`
                  : entrega.estado === 'necesita_mejorar' ? 'El docente pide mejoras — corrige y vuelve a entregar.'
                  : 'Entregado — esperando la revisión del docente.'}
              </p>
              {entrega.feedback && <p className="mt-0.5 opacity-90"><b>Feedback:</b> {entrega.feedback}</p>}
            </div>
          </div>
        )}
        {avisoEntrega && <p className="mt-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-prexi-red">{avisoEntrega}</p>}
      </div>

      {/* Escritorio amplio (xl): editor ancho + panel de ALVARO cómodo. Por debajo
          de xl, el panel de ALVARO se apila DEBAJO del editor, a todo el ancho. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        {/* Editor + consola */}
        <div className="flex min-h-[60vh] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#04162E] shadow-soft xl:min-h-[72vh]">
          <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-green-400" />
              <span className="ml-2 font-mono text-xs text-slate-400">main.py</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeEditor value={codigo} onChange={setCodigo} height="100%" className="h-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-700/80 px-4 py-3">
            <button onClick={ejecutar} disabled={ejecutando || cargandoPython} className="inline-flex items-center gap-2 rounded-xl bg-prexi-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 active:scale-[0.98] disabled:opacity-60">
              <Play className="h-4 w-4" /> {cargandoPython ? 'Preparando Python…' : ejecutando ? 'Ejecutando…' : 'Ejecutar'}
            </button>
            <button onClick={verTraza} disabled={trazando} title="Ejecuta paso a paso mostrando las variables"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60">
              <Layers className="h-4 w-4" /> {trazando ? 'Trazando…' : 'Ver traza'}
            </button>
            <button onClick={() => setCodigo(reto.codigoInicial || '# Escribe tu solución aquí\n')} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
              <RotateCcw className="h-4 w-4" /> Reiniciar
            </button>
            {/* Los retos DERIVADOS del banco (y los bug-hunt) se autocalifican
                comparando la salida; el resto va a revisión del docente. */}
            {reto.esBugHunt || reto.autoCalificable ? (
              <button onClick={verificarBug} disabled={verificando || est === 'aprobado'}
                title={est === 'aprobado' ? 'Ya resolviste este reto' : 'Comprobar tu solución contra la salida esperada'}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-prexi-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                <CheckCircle className="h-4 w-4" />
                {verificando ? 'Verificando…'
                  : est === 'aprobado' ? (reto.esBugHunt ? 'Bug corregido' : 'Resuelto')
                  : reto.esBugHunt ? 'Verificar corrección' : 'Comprobar solución'}
              </button>
            ) : (
              <button onClick={entregarReto} disabled={entregando || bloqueoEntrega}
                title={bloqueoEntrega ? 'Ya entregaste este reto' : 'Enviar tu solución al docente'}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-prexi-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
                <Upload className="h-4 w-4" /> {entregando ? 'Entregando…' : est === 'necesita_mejorar' ? 'Reenviar reto' : est === 'aprobado' ? 'Aprobado' : est === 'pendiente_revision' ? 'En revisión' : 'Entregar reto'}
              </button>
            )}
          </div>
          <div className="border-t border-slate-700/80 px-4 py-3">
            <p className="mb-1.5 font-mono text-xs text-slate-400">▸ Consola</p>
            <pre className={`max-h-44 overflow-auto whitespace-pre-wrap font-mono text-sm ${salida ? (salida.ok ? 'text-green-300' : 'text-red-300') : 'text-slate-500'}`}>
              {salida ? salida.texto : cargandoPython ? 'Preparando el entorno de Python… (solo la primera vez)' : 'Esperando ejecución…'}
            </pre>
          </div>
        </div>

        {/* Tutor ALVARO completo (chat con streaming + pistas + chips), igual que en ejercicios */}
        <AlvaroRetoPanel retoId={retoId} contextoTema={reto.contextoTema} enunciado={reto.enunciado} codigo={codigo} esBugHunt={reto.esBugHunt} />
      </div>

      {/* Resultado de la misión de depuración (bug‑hunt) */}
      {verif && (
        <div className={`mt-5 rounded-2xl p-4 ${verif.correcto ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
          {verif.correcto ? (
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-prexi-green" />
              <div>
                <p className="font-bold text-emerald-700 dark:text-emerald-300">Bug corregido {verif.xp > 0 ? `+${verif.xp} XP` : ''}</p>
                <p className="text-sm text-muted">La salida coincide con la esperada. ¡Misión superada!</p>
                {verif.emblemas.map((e) => (
                  <p key={e.clave} className="mt-1 text-sm font-semibold text-fg">Emblema desbloqueado: {e.nombre}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="font-bold text-amber-700 dark:text-amber-300">Todavía no. Revisa la lógica.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div><p className="text-[11px] font-bold uppercase tracking-wide text-muted">Tu salida</p><pre className="overflow-x-auto rounded-lg bg-card p-2 font-mono text-xs text-fg">{verif.salida || '(vacía)'}</pre></div>
                  <div><p className="text-[11px] font-bold uppercase tracking-wide text-muted">Esperada</p><pre className="overflow-x-auto rounded-lg bg-card p-2 font-mono text-xs text-fg">{verif.esperado}</pre></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visualizador de traza paso a paso */}
      {traza && (
        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-fg"><Layers className="h-4 w-4 text-prexi-blue-deep" /> Traza paso a paso</h3>
          <TraceViewer codigo={codigo} pasos={traza.pasos} error={traza.error} />
        </div>
      )}
    </div>
  );
}
