/* eslint-disable no-undef */
/**
 * WORKER DE EJECUCIÓN PYTHON (Pyodide) — sustituye al sandbox Piston.
 *
 * Corre en un Web Worker para que un bucle infinito del estudiante NO congele la
 * interfaz: el hilo principal sigue respondiendo y puede matar este worker
 * (`terminate()`) cuando se agota el tiempo.
 *
 * Va en /public como archivo plano (no pasa por el bundler): `importScripts` de
 * Pyodide necesita un script clásico, no un módulo ES.
 *
 * Protocolo:
 *   ← { tipo: 'listo' }                        runtime cargado
 *   ← { tipo: 'error-carga', error }           no se pudo cargar Pyodide
 *   → { tipo: 'ejecutar', id, codigo, stdin }
 *   ← { tipo: 'resultado', id, ok, stdout, stderr }
 */

// Versión FIJADA a propósito: `latest` cambiaría el runtime bajo los pies del
// estudiante sin aviso y rompería la reproducibilidad de la tesis.
const PYODIDE_VERSION = '0.26.4';
const CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodide = null;

async function cargar() {
  try {
    importScripts(`${CDN}pyodide.js`);
    pyodide = await loadPyodide({ indexURL: CDN });
    postMessage({ tipo: 'listo' });
  } catch (e) {
    postMessage({ tipo: 'error-carga', error: String(e && e.message ? e.message : e) });
  }
}
cargar();

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || msg.tipo !== 'ejecutar') return;
  const { id, codigo, stdin } = msg;

  if (!pyodide) {
    postMessage({ tipo: 'resultado', id, ok: false, stdout: '', stderr: 'El entorno de Python aún se está cargando. Espera un momento.' });
    return;
  }

  let stdout = '';
  let stderr = '';
  try {
    // stdout/stderr se capturan por callback (no por redirección global), para
    // que la salida llegue completa aunque el programa termine con excepción.
    pyodide.setStdout({ batched: (s) => { stdout += s + '\n'; } });
    pyodide.setStderr({ batched: (s) => { stderr += s + '\n'; } });

    // `input()` lee del stdin que mande la UI, línea a línea. Sin esto, cualquier
    // programa con input() lanzaría una excepción distinta a la de Piston.
    const lineas = String(stdin ?? '').split('\n');
    pyodide.globals.set('__prexi_stdin__', lineas);
    await pyodide.runPythonAsync(`
import builtins as __b
__prexi_lineas = list(__prexi_stdin__)
def __prexi_input(prompt=''):
    if prompt:
        print(prompt, end='')
    return __prexi_lineas.pop(0) if __prexi_lineas else ''
__b.input = __prexi_input
`);

    await pyodide.runPythonAsync(codigo);
    postMessage({ tipo: 'resultado', id, ok: true, stdout, stderr });
  } catch (e) {
    // El texto de PythonError ya viene con el traceback, igual que el stderr de
    // Piston: la UI lo muestra sin cambios.
    const texto = String(e && e.message ? e.message : e);
    postMessage({ tipo: 'resultado', id, ok: false, stdout, stderr: stderr || texto });
  }
};
