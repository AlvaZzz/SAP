'use client';

/**
 * ÍNDICE DE MÓDULOS NUMERADOS.
 *
 * Idea de fondo: que recorrer el rol de arriba abajo sea recorrer el documento.
 * En el rol INVESTIGADOR los ocho módulos siguen el orden de un capítulo de
 * resultados, así que el tribunal encuentra cada respuesta donde la espera y el
 * tesista puede navegar mientras habla. En el rol DOCENTE los seis módulos
 * siguen el orden de la evidencia de fidelidad de la intervención.
 *
 * Cada botón lleva, además del destino, POR QUÉ existe ese módulo: es la
 * respuesta anticipada a "¿y esto para qué me sirve?".
 */

import Link from 'next/link';
import { ComponentType } from 'react';
import { Card, PageHeader, SectionTitle } from '@/components/ui';

export interface Modulo {
  n: number;
  titulo: string;
  /** Qué contiene el módulo, en una línea. */
  resumen: string;
  /** Por qué existe: lo que responde ante un tribunal o en el aula. */
  porQue: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export function IndiceModulos({
  titulo, subtitulo, modulos, nota,
}: {
  titulo: string;
  subtitulo: string;
  modulos: Modulo[];
  nota?: string;
}) {
  return (
    <div className="animate-fade-up">
      <PageHeader title={titulo} subtitle={subtitulo} />

      <div className="grid gap-4 md:grid-cols-2">
        {modulos.map((m) => (
          <Card key={m.n} hover as={Link} href={m.href} className="group block !p-0">
            <div className="flex gap-4 p-5">
              {/* El número es lo primero que se ve: marca el orden del recorrido. */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-prexi-blue/10">
                <span className="font-display text-xl font-bold text-prexi-blue-deep">{m.n}</span>
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <m.icon className="h-4 w-4 shrink-0 text-prexi-blue-deep" />
                  <p className="font-display font-bold text-fg group-hover:text-prexi-blue-deep">
                    {m.titulo}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-fg">{m.resumen}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  <span className="font-semibold uppercase tracking-wide">Para qué: </span>
                  {m.porQue}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {nota && (
        <Card className="mt-6">
          <SectionTitle className="mb-2">Cómo usar este rol</SectionTitle>
          <p className="text-sm leading-relaxed text-muted">{nota}</p>
        </Card>
      )}
    </div>
  );
}
