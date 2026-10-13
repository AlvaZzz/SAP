import { Fragment } from 'react';

/**
 * Visor de código de SOLO LECTURA con estética de IDE: barra de ventana con los
 * 3 puntos de colores, números de línea y resaltado de sintaxis Python real
 * (tokenizado, sin innerHTML). Fondo oscuro fijo (independiente del tema), como
 * un editor. Para el editor EDITABLE de la práctica, usar CodeEditor (CodeMirror).
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

export function CodeViewer({ code, titulo = 'ejercicio.py' }: { code: string; titulo?: string }) {
  const lineas = code.replace(/\s+$/, '').split('\n');
  const anchoNum = String(lineas.length).length;

  return (
    <div className="overflow-hidden rounded-xl border border-[#0E3F7E] bg-[#04162E] shadow-lift">
      {/* Barra de ventana estilo editor */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#0A121F] px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#FF5F56]" />
        <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
        <span className="h-3 w-3 rounded-full bg-[#27C93F]" />
        <span className="ml-2 font-mono text-xs text-slate-400">{titulo}</span>
      </div>
      {/* Código con números de línea */}
      <div className="overflow-x-auto">
        <pre className="min-w-full p-0 font-mono text-sm leading-6">
          <code className="grid">
            {lineas.map((linea, li) => {
              const tokens = linea.match(/("[^"]*"|'[^']*'|#.*$|[A-Za-zÁ-ÿ_][A-Za-zÁ-ÿ0-9_]*|\d+(?:\.\d+)?|\s+|[^\sA-Za-z0-9"']+)/g) ?? [];
              return (
                <div key={li} className="flex hover:bg-white/[0.03]">
                  <span className="select-none border-r border-white/10 px-3 text-right text-slate-600" style={{ minWidth: `${anchoNum + 2}ch` }}>{li + 1}</span>
                  <span className="whitespace-pre px-4">
                    {tokens.length === 0 ? ' ' : tokens.map((t, ti) =>
                      /^\s+$/.test(t) ? <Fragment key={ti}>{t}</Fragment> : <span key={ti} className={clase(t)}>{t}</span>,
                    )}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
