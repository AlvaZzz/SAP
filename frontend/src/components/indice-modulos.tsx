'use client';

/**
 * ÍNDICE DE MÓDULOS DE UN ROL, AGRUPADO POR SECCIONES.
 *
 * Idea de fondo: que recorrer el rol de arriba abajo sea recorrer el documento.
 * En el rol INVESTIGADOR los módulos siguen el orden de un capítulo de
 * resultados, así que el tribunal encuentra cada respuesta donde la espera y el
 * tesista puede navegar mientras habla. En el rol DOCENTE siguen el orden de la
 * evidencia de fidelidad de la intervención.
 *
 * Ese orden se comunica con la POSICIÓN y con los encabezados de sección —los
 * mismos que la barra lateral, para que ambas vistas cuenten la misma historia—,
 * no con un número delante de cada tarjeta.
 *
 * Cada tarjeta lleva, además del destino, POR QUÉ existe ese módulo: es la
 * respuesta anticipada a "¿y esto para qué me sirve?".
 */

import Link from 'next/link';
import { ComponentType } from 'react';
import { Card, PageHeader, SectionTitle } from '@/components/ui';

export interface Modulo {
  titulo: string;
  /** Qué contiene el módulo, en una línea. */
  resumen: string;
  /** Por qué existe: lo que responde ante un tribunal o en el aula. */
  porQue: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

/** Sección del índice: el mismo encabezado que usa la barra lateral. */
export interface GrupoModulos {
  titulo: string;
  modulos: Modulo[];
}

export function IndiceModulos({
  titulo, subtitulo, grupos, nota,
}: {
  titulo: string;
  subtitulo: string;
  grupos: GrupoModulos[];
  nota?: string;
}) {
  return (
    <div className="animate-fade-up">
      <PageHeader title={titulo} subtitle={subtitulo} />

      <div className="flex flex-col gap-8">
        {grupos.map((grupo) => (
          <section key={grupo.titulo}>
            <h2 className="mb-3 border-b border-line pb-2 text-[11px] font-bold uppercase tracking-widest text-muted">
              {grupo.titulo}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {grupo.modulos.map((m) => (
                <Card key={m.href} hover as={Link} href={m.href} className="group block !p-0">
                  <div className="flex gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-prexi-blue/10">
                      <m.icon className="h-5 w-5 text-prexi-blue-deep" />
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 font-display font-bold text-fg group-hover:text-prexi-blue-deep">
                        {m.titulo}
                      </p>
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
          </section>
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
