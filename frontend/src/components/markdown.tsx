import { Fragment, ReactNode } from 'react';
import { CodeBlock } from './code-block';

/**
 * Renderizador de Markdown MÍNIMO y seguro (sin dangerouslySetInnerHTML). Soporta
 * el subconjunto usado por las introducciones didácticas: encabezados (##, ###),
 * negrita (**), código en línea (`), bloques de código (``` → CodeBlock) y listas
 * (- / •). Suficiente para contenido educativo; no pretende ser un parser completo.
 */

// Formatea negrita e inline-code dentro de una línea de texto.
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Divide por **negrita** y `código`, conservando los delimitadores.
  const partes = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  partes.forEach((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) out.push(<strong key={`${keyBase}-b${i}`} className="font-semibold text-prexi-navy">{p.slice(2, -2)}</strong>);
    else if (/^`[^`]+`$/.test(p)) out.push(<code key={`${keyBase}-c${i}`} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-prexi-blue-deep">{p.slice(1, -1)}</code>);
    else out.push(<Fragment key={`${keyBase}-t${i}`}>{p}</Fragment>);
  });
  return out;
}

export function Markdown({ content }: { content: string }) {
  const lineas = content.split('\n');
  const bloques: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lineas.length) {
    const linea = lineas[i];

    // Bloque de código ``` ... ```
    if (linea.trim().startsWith('```')) {
      const buff: string[] = [];
      i++;
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) { buff.push(lineas[i]); i++; }
      i++; // cierra ```
      bloques.push(<div key={key++} className="my-3"><CodeBlock code={buff.join('\n')} /></div>);
      continue;
    }

    // Encabezados
    if (linea.startsWith('### ')) { bloques.push(<h4 key={key++} className="mb-1 mt-4 text-sm font-bold text-prexi-navy">{inline(linea.slice(4), `h${key}`)}</h4>); i++; continue; }
    if (linea.startsWith('## ')) { bloques.push(<h3 key={key++} className="mb-2 mt-5 flex items-center gap-2 text-base font-extrabold text-prexi-blue-deep">{inline(linea.slice(3), `h${key}`)}</h3>); i++; continue; }

    // Listas (bloque contiguo de - o •)
    if (/^\s*[-•]\s+/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*[-•]\s+/.test(lineas[i])) { items.push(lineas[i].replace(/^\s*[-•]\s+/, '')); i++; }
      bloques.push(
        <ul key={key++} className="my-2 space-y-1.5 pl-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2 text-sm leading-relaxed text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-prexi-blue" />{<span>{inline(it, `li${key}-${ii}`)}</span>}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Línea en blanco
    if (linea.trim() === '') { i++; continue; }

    // Párrafo (une líneas contiguas de texto)
    const buff: string[] = [];
    while (i < lineas.length && lineas[i].trim() !== '' && !lineas[i].startsWith('#') && !/^\s*[-•]\s+/.test(lineas[i]) && !lineas[i].trim().startsWith('```')) { buff.push(lineas[i]); i++; }
    bloques.push(<p key={key++} className="my-2 text-sm leading-relaxed text-slate-600">{inline(buff.join(' '), `p${key}`)}</p>);
  }

  return <div>{bloques}</div>;
}
