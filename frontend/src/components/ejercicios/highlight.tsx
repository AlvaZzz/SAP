import { Fragment, ReactNode } from 'react';

/**
 * Resaltado de sintaxis Python LIGERO y sin dependencias (tokenizado, sin
 * innerHTML), compartido por los componentes de ejercicio. Mismos colores que
 * `CodeViewer`/`CodeBlock` para que todo el sistema hable el mismo idioma visual.
 * Pensado para fondo OSCURO tipo editor (los ejercicios usan ese fondo).
 */

const KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'and', 'or', 'not',
  'break', 'continue', 'pass', 'import', 'from', 'as', 'class', 'try', 'except',
  'finally', 'with', 'lambda', 'global', 'nonlocal', 'yield', 'is', 'del', 'assert',
]);
const BUILTINS = new Set([
  'print', 'input', 'int', 'str', 'float', 'bool', 'len', 'range', 'sum', 'round',
  'type', 'set', 'list', 'dict', 'tuple', 'max', 'min', 'abs', 'sorted', 'enumerate',
  'append', 'pop', 'sort', 'get', 'items', 'keys', 'values', 'upper', 'lower',
]);
const CONST = new Set(['True', 'False', 'None']);

function clase(token: string): string {
  if (/^#/.test(token)) return 'text-slate-500 italic';
  if (/^(["']).*\1$/.test(token)) return 'text-emerald-300';
  if (/^\d+(\.\d+)?$/.test(token)) return 'text-amber-300';
  if (/^[A-Za-z_]\w*$/.test(token)) {
    if (KEYWORDS.has(token)) return 'text-violet-300 font-semibold';
    if (CONST.has(token)) return 'text-amber-300';
    if (BUILTINS.has(token)) return 'text-sky-300';
    return 'text-slate-100';
  }
  if (/^[%=+\-*/<>!&|]+$/.test(token)) return 'text-pink-300';
  return 'text-slate-400';
}

const RE = /("[^"]*"|'[^']*'|#.*$|[A-Za-zÁ-ÿ_][A-Za-zÁ-ÿ0-9_]*|\d+(?:\.\d+)?|\s+|[^\sA-Za-z0-9"']+)/g;

/** Resalta UNA línea de Python como nodos React (conserva los espacios). */
export function resaltarLinea(linea: string): ReactNode {
  const tokens = linea.match(RE) ?? [];
  if (tokens.length === 0) return ' ';
  return tokens.map((t, i) =>
    /^\s+$/.test(t) ? <Fragment key={i}>{t}</Fragment> : <span key={i} className={clase(t)}>{t}</span>,
  );
}

/** Bloque de código resaltado SIN cromo de ventana (para incrustar en paneles). */
export function CodigoResaltado({ code, className = '' }: { code: string; className?: string }) {
  const lineas = code.replace(/\s+$/, '').split('\n');
  return (
    <pre className={`overflow-x-auto font-mono text-sm leading-6 text-slate-100 ${className}`}>
      <code className="grid">
        {lineas.map((l, i) => (
          <span key={i} className="whitespace-pre">{resaltarLinea(l)}</span>
        ))}
      </code>
    </pre>
  );
}
