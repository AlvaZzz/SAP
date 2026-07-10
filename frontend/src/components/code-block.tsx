import { Fragment } from 'react';

// Palabras clave de Python.
const KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'and', 'or', 'not',
  'break', 'continue', 'pass', 'import', 'from', 'as', 'class', 'try', 'except',
  'finally', 'with', 'lambda', 'global', 'nonlocal', 'yield', 'is', 'del', 'assert',
]);
// Constantes y funciones integradas frecuentes.
const BUILTINS = new Set([
  'print', 'input', 'int', 'str', 'float', 'bool', 'len', 'range', 'sum', 'round',
  'type', 'set', 'list', 'dict', 'tuple', 'max', 'min', 'abs', 'sorted', 'enumerate',
  'append', 'pop', 'sort', 'get', 'items', 'keys', 'values', 'upper', 'lower',
]);
const CONST = new Set(['True', 'False', 'None']);

function clase(token: string): string {
  if (/^(["']).*\1$/.test(token)) return 'text-emerald-300';       // strings
  if (/^\d+(\.\d+)?$/.test(token)) return 'text-amber-300';        // números
  if (/^[A-Za-z_]\w*$/.test(token)) {
    if (KEYWORDS.has(token)) return 'text-violet-300 font-semibold';
    if (CONST.has(token)) return 'text-amber-300';
    if (BUILTINS.has(token)) return 'text-sky-300';
    return 'text-slate-100';
  }
  if (/^#/.test(token)) return 'text-slate-500 italic';            // comentarios
  if (/^[%=+\-*/<>!&|]+$/.test(token)) return 'text-pink-300';     // operadores
  return 'text-slate-400';                                         // puntuación
}

/** Resalta pseudocódigo de forma ligera (tokenizado, sin innerHTML). */
export function CodeBlock({ code }: { code: string }) {
  const lineas = code.split('\n');
  return (
    <pre className="overflow-x-auto rounded-xl bg-[#0F1B2D] p-4 font-mono text-[13px] leading-relaxed">
      <code>
        {lineas.map((linea, li) => {
          const tokens = linea.match(/("[^"]*"|[A-Za-zÁ-ÿ_][A-Za-zÁ-ÿ0-9_]*|\d+(?:\.\d+)?|\s+|[^\sA-Za-z0-9"]+)/g) ?? [];
          return (
            <Fragment key={li}>
              {tokens.map((t, ti) =>
                /^\s+$/.test(t) ? <span key={ti}>{t}</span> : <span key={ti} className={clase(t)}>{t}</span>,
              )}
              {'\n'}
            </Fragment>
          );
        })}
      </code>
    </pre>
  );
}
