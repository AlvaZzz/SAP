'use client';

/**
 * RUNTIME DE PYTHON EN EL NAVEGADOR (Pyodide) — reemplaza al sandbox Piston.
 *
 * El código del estudiante NUNCA sale de su navegador: ya no viaja al backend
 * para ejecutarse. Eso quita del despliegue el contenedor privilegiado de Piston
 * (incompatible con Render Free) sin perder la ejecución real de Python.
 *
 * Cómo encaja:
 *  · Un ÚNICO Web Worker por pestaña, creado en la primera ejecución (perezoso) y
 *    reutilizado después: el runtime (~10 MB) se descarga una sola vez por sesión.
 *  · El worker aísla la ejecución: un `while True` del alumno bloquea al worker,
 *    no a la interfaz.
 *  · TIMEOUT: si se pasa del límite, se mata el worker (`terminate()`) y se crea
 *    uno nuevo, porque un worker bloqueado no puede volver a atender mensajes.
 *
 * La forma del resultado imita la del backend anterior (`ok`, `stdout`, `stderr`,
 * `timeout`, `sandboxError`) para que las pantallas no cambien.
 */

export interface ResultadoEjecucion {
  ok: boolean;
  stdout: string;
  stderr: string;
  timeout: boolean;
  /** Fallo del ENTORNO (no del código del alumno): se muestra como reintentable. */
  sandboxError: string | null;
}

export interface PasoTraza { linea: number; locals: Record<string, string> }

/** Tiempo máximo por ejecución. Igual que el que aplicaba Piston (3 s). */
const TIMEOUT_MS = 3000;

let worker: Worker | null = null;
let listo = false;
let cargando: Promise<void> | null = null;
let siguienteId = 1;

/** Suscriptores del estado de carga (para el indicador de la UI). */
const oyentes = new Set<(cargando: boolean) => void>();
export function onCargaRuntime(cb: (cargando: boolean) => void): () => void {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}
function avisar(v: boolean) { oyentes.forEach((cb) => cb(v)); }

function crearWorker(): Worker {
  const w = new Worker('/pyodide-worker.js');
  listo = false;
  return w;
}

/** Arranca el worker y espera a que Pyodide termine de cargar (una sola vez). */
function asegurarRuntime(): Promise<void> {
  if (listo && worker) return Promise.resolve();
  if (cargando) return cargando;

  avisar(true);
  cargando = new Promise<void>((resolve, reject) => {
    worker = crearWorker();
    const alMensaje = (ev: MessageEvent) => {
      const m = ev.data;
      if (m?.tipo === 'listo') {
        listo = true;
        worker?.removeEventListener('message', alMensaje);
        avisar(false);
        resolve();
      } else if (m?.tipo === 'error-carga') {
        worker?.removeEventListener('message', alMensaje);
        avisar(false);
        reject(new Error(m.error || 'No se pudo cargar el entorno de Python.'));
      }
    };
    worker.addEventListener('message', alMensaje);
    worker.addEventListener('error', (e) => {
      avisar(false);
      reject(new Error(e.message || 'No se pudo cargar el entorno de Python.'));
    });
  }).finally(() => { cargando = null; });

  return cargando;
}

/** Precarga el runtime sin ejecutar nada (para que el primer "Ejecutar" sea rápido). */
export function precargarPython(): void {
  void asegurarRuntime().catch(() => undefined);
}

/** ¿El runtime ya está descargado y listo en esta pestaña? */

/**
 * Ejecuta código Python y devuelve stdout/stderr. Nunca lanza por culpa del
 * código del alumno: los errores de Python vienen en `stderr`.
 */
export async function ejecutarPython(codigo: string, stdin = ''): Promise<ResultadoEjecucion> {
  try {
    await asegurarRuntime();
  } catch (e) {
    return {
      ok: false, stdout: '', stderr: '', timeout: false,
      sandboxError: e instanceof Error ? e.message : 'No se pudo cargar el entorno de Python.',
    };
  }

  const w = worker;
  if (!w) {
    return { ok: false, stdout: '', stderr: '', timeout: false, sandboxError: 'El entorno de Python no está disponible.' };
  }

  const id = siguienteId++;
  return new Promise<ResultadoEjecucion>((resolve) => {
    let terminado = false;

    const limpiar = () => { w.removeEventListener('message', alMensaje); clearTimeout(reloj); };

    const alMensaje = (ev: MessageEvent) => {
      const m = ev.data;
      if (m?.tipo !== 'resultado' || m.id !== id) return;
      terminado = true;
      limpiar();
      resolve({ ok: !!m.ok, stdout: m.stdout ?? '', stderr: m.stderr ?? '', timeout: false, sandboxError: null });
    };

    // Un worker bloqueado por un bucle infinito ya no responde: hay que matarlo y
    // reemplazarlo, o la siguiente ejecución se quedaría esperando para siempre.
    const reloj = setTimeout(() => {
      if (terminado) return;
      limpiar();
      w.terminate();
      worker = null;
      listo = false;
      resolve({ ok: false, stdout: '', stderr: '', timeout: true, sandboxError: null });
    }, TIMEOUT_MS);

    w.addEventListener('message', alMensaje);
    w.postMessage({ tipo: 'ejecutar', id, codigo, stdin });
  });
}

/* ─────────────── Visualizador de traza (paso a paso) ─────────────── */

// Mismo harness que usaba el backend: instrumenta con sys.settrace y emite una
// línea centinela con JSON. Se mantiene idéntico para que la traza no cambie.
const TRAZA_PREFIJO = [
  'import sys, json, io',
  '_pasos = []',
  '_MAX = 300',
  'def _main():',
  '',
].join('\n');

const TRAZA_SUFIJO = [
  '',
  'def _t(f, e, a):',
  "    if e == 'line' and f.f_code.co_name == '_main':",
  '        if len(_pasos) < _MAX:',
  '            _l = {}',
  '            for _k, _v in list(f.f_locals.items()):',
  "                if _k.startswith('__'): continue",
  '                try: _l[_k] = repr(_v)[:80]',
  "                except Exception: _l[_k] = '<?>'",
  "            _pasos.append({'linea': f.f_lineno, 'locals': _l})",
  '    return _t',
  '_buf = io.StringIO()',
  '_out = sys.stdout',
  'sys.stdout = _buf',
  '_err = None',
  'sys.settrace(_t)',
  'try:',
  '    _main()',
  'except Exception:',
  '    import traceback; _err = traceback.format_exc()',
  'finally:',
  '    sys.settrace(None)',
  '    sys.stdout = _out',
  'print("PREXI_TRACE::" + json.dumps({"stdout": _buf.getvalue(), "pasos": _pasos, "error": _err}))',
].join('\n');

const TRAZA_MARCA = 'PREXI_TRACE::';

export interface ResultadoTraza {
  ok: boolean;
  stdout: string;
  error: string | null;
  reintentable?: boolean;
  pasos: PasoTraza[];
}

export async function trazarPython(codigo: string, stdin = ''): Promise<ResultadoTraza> {
  const nLineas = codigo.split('\n').length;
  const indentado = codigo.split('\n').map((l) => '    ' + l).join('\n');
  const offset = TRAZA_PREFIJO.split('\n').length - 1; // líneas del harness antes del código

  const r = await ejecutarPython(TRAZA_PREFIJO + indentado + TRAZA_SUFIJO, stdin);

  if (r.sandboxError) return { ok: false, stdout: '', error: r.sandboxError, reintentable: true, pasos: [] };
  if (r.timeout) {
    return { ok: false, stdout: '', error: 'Tu código tardó demasiado (posible bucle infinito). Revisa la condición de corte e inténtalo de nuevo.', pasos: [] };
  }

  const idx = r.stdout.lastIndexOf(TRAZA_MARCA);
  if (idx === -1) {
    // Sin centinela → ni siquiera compiló (p. ej. error de sintaxis).
    return { ok: false, stdout: '', error: (r.stderr || r.stdout || 'No se pudo generar la traza.').trim(), pasos: [] };
  }

  let data: { stdout?: string; pasos?: PasoTraza[]; error?: string | null };
  try {
    data = JSON.parse(r.stdout.slice(idx + TRAZA_MARCA.length));
  } catch {
    return { ok: false, stdout: '', error: 'No se pudo leer la traza.', pasos: [] };
  }

  const pasos = (data.pasos ?? [])
    .map((p) => ({ linea: p.linea - offset, locals: p.locals }))
    .filter((p) => p.linea >= 1 && p.linea <= nLineas);

  return { ok: !data.error, stdout: data.stdout ?? '', error: data.error ?? null, pasos };
}
