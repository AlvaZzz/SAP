'use client';

import { Fragment, useMemo } from 'react';

/**
 * FlowDiagram — pinta un diagrama de flujo VERTICAL con nodos estilizados
 * (cápsulas para inicio/fin, rectángulos redondeados para pasos, rombos para
 * decisiones) conectados por flechas, en lugar del `<pre>` de arte ASCII que
 * llegaba antes desde el backend.
 *
 * El contenido de estos flujos viene como TEXTO libre (`Ejemplo.diagrama`), a
 * veces con arte de líneas (│ ┌ ╱ ▶ …). El parser es TOLERANTE: descarta las
 * líneas que son sólo conectores, parte las secuencias en línea por sus flechas,
 * clasifica cada fragmento y arma una lista ordenada de nodos. No pretende
 * reconstruir bifurcaciones complejas píxel a píxel: prioriza legibilidad.
 *
 * Colores: el borde/flecha usan el color de la unidad (tinte translúcido para el
 * fondo del nodo → se ve bien en claro y en oscuro); el texto es de alto contraste
 * (`text-fg`). Sin dependencias externas (SVG propio para las flechas).
 */

type Kind = 'start' | 'end' | 'process' | 'decision';
interface Node { kind: Kind; text: string }

// Caracteres de "arte de líneas"/conectores que no aportan texto.
const CONNECTORS = /[│┃|┌┐└┘├┤┬┴┼─━╌╍╱╲╳◀◆●◇○▲▼△▽→←↑↓]/g;
// Etiqueta de rama suelta (Sí/No). Coincidencia exacta case-insensitive: no se usa
// `\b` porque el límite de palabra ASCII no reconoce la "í" acentuada.
const isRama = (w: string) => /^(sí|si|no)$/i.test(w);

function parse(source: string): Node[] {
  // Partimos por saltos de línea y por flechas "▶"/"►" (secuencias en una línea).
  const segments = source.split(/\n|▶|►/);
  const nodes: Node[] = [];

  for (const raw of segments) {
    const s = raw.replace(CONNECTORS, ' ').replace(/\s+/g, ' ').trim();
    if (!s) continue;
    // Descarta fragmentos sin ningún carácter "de contenido" (sólo símbolos).
    if (!/[a-zA-Z0-9¿?áéíóúÁÉÍÓÚñÑ]/.test(s)) continue;
    // Sin las etiquetas de rama (Sí/No), ¿queda algo? Si no, es sólo una etiqueta.
    const palabras = s.split(' ');
    const util = palabras.filter((w) => !isRama(w));
    if (util.length === 0) continue;

    const lower = s.toLowerCase();
    let kind: Kind = 'process';
    let text = s;

    if (/\binicio\b/.test(lower) && s.length <= 20) { kind = 'start'; text = 'Inicio'; }
    else if (/\bfin\b/.test(lower) && s.length <= 16) { kind = 'end'; text = 'Fin'; }
    else if (s.includes('?') || s.includes('¿')) {
      kind = 'decision';
      // Quita las etiquetas Sí/No que suelen quedar pegadas a la condición.
      text = util.join(' ').trim() || s;
    }

    // Colapsa duplicados consecutivos (p. ej. líneas repetidas por el arte).
    const prev = nodes[nodes.length - 1];
    if (prev && prev.kind === kind && prev.text === text) continue;
    nodes.push({ kind, text });
  }

  return nodes;
}

export function FlowDiagram({ source, color }: { source: string; color: string }) {
  const nodes = useMemo(() => parse(source), [source]);

  // Si no se pudo extraer una secuencia útil, degradamos con elegancia al texto
  // monoespaciado (nunca peor que antes).
  if (nodes.length < 2) {
    return (
      <pre className="overflow-x-auto rounded-xl border border-line bg-subtle p-3.5 font-mono text-xs leading-relaxed text-muted">{source}</pre>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-subtle/60 p-4">
      <div className="flex min-w-full flex-col items-center">
        {nodes.map((n, i) => (
          <Fragment key={i}>
            <NodeBox node={n} color={color} />
            {i < nodes.length - 1 && <Arrow color={color} />}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function NodeBox({ node, color }: { node: Node; color: string }) {
  const tint = `${color}1A`;     // ~10% → funciona en claro y oscuro
  const line = `${color}66`;     // ~40% borde

  if (node.kind === 'start' || node.kind === 'end') {
    return (
      <div
        className="max-w-[90%] rounded-full px-5 py-1.5 text-center text-[13px] font-bold uppercase tracking-wide text-fg"
        style={{ backgroundColor: tint, border: `1.5px solid ${color}` }}
      >
        {node.text}
      </div>
    );
  }

  if (node.kind === 'decision') {
    return (
      <div
        className="flex max-w-[92%] items-center gap-2 rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-fg"
        style={{ backgroundColor: tint, border: `1.5px dashed ${color}` }}
      >
        {/* Mini rombo: pista visual de "decisión" sin romper el texto. */}
        <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rotate-45 rounded-[2px]" style={{ backgroundColor: color }} />
        <span className="whitespace-pre-wrap break-words">{node.text}</span>
      </div>
    );
  }

  return (
    <div
      className="max-w-[92%] rounded-xl px-4 py-2.5 text-center font-mono text-[13px] text-fg"
      style={{ backgroundColor: tint, border: `1px solid ${line}` }}
    >
      <span className="whitespace-pre-wrap break-words">{node.text}</span>
    </div>
  );
}

function Arrow({ color }: { color: string }) {
  return (
    <svg width="16" height="24" viewBox="0 0 16 24" fill="none" aria-hidden className="my-0.5 shrink-0">
      <line x1="8" y1="0" x2="8" y2="17" stroke={color} strokeWidth="2" />
      <path d="M3.5 15 L8 22 L12.5 15" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
