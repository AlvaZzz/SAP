import { Fragment } from 'react';

// Palabras clave (pseudocódigo en español + algo de C++).
const KEYWORDS = new Set([
  'INICIO', 'FIN', 'SI', 'SINO', 'ENTONCES', 'VAR', 'PARA', 'DESDE', 'HASTA',
  'HACER', 'MIENTRAS', 'ESCRIBIR', 'LEER', 'ALGORITMO', 'DEFINIR', 'DEVOLVER',
  'INT', 'COUT', 'CIN', 'FOR', 'WHILE', 'IF', 'ELSE', 'RETURN', 'FLOAT', 'BOOL',
]);

function clase(token: string): string {
  if (/^".*"$/.test(token)) return 'text-emerald-300';           // strings
  if (/^\d+(\.\d+)?$/.test(token)) return 'text-amber-300';        // números
  if (/^[A-Za-zÁ-ÿ_][A-Za-zÁ-ÿ0-9_]*$/.test(token)) {
    return KEYWORDS.has(token.toUpperCase()) ? 'text-blue-300 font-semibold' : 'text-slate-100';
  }
  if (/^[%=+\-*/<>!&|]+$/.test(token)) return 'text-pink-300';     // operadores
  return 'text-slate-400';                                         // puntuación
}

/** Resalta pseudocódigo de forma ligera (tokenizado, sin innerHTML). */
export function CodeBlock({ code }: { code: string }) {
  const lineas = code.split('\n');
  return (
    <pre className="overflow-x-auto rounded-xl bg-[#0f1f38] p-4 font-mono text-[13px] leading-relaxed">
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
