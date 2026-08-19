'use client';

/**
 * MÓDULO 5 — COBERTURA DEL BANCO DE EJERCICIOS.
 *
 * Si un tema publicado no tiene ejercicios del nivel de un estudiante, la
 * adaptatividad deja de operar para él sin que la pantalla dé error. Los huecos
 * conviene cerrarlos ANTES de la recolección de datos.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import { AlertTriangle, CheckCircle, Code } from '@/components/icons';

interface PorNivel { nivel: string; ejercicios: number }
interface Tema {
  id: number; numero: string; titulo: string; publicado: boolean;
  por_nivel: PorNivel[]; total_practica: number; examen: number; completo: boolean;
}
interface Unidad {
  id: number; numero: number; titulo: string; temas: Tema[];
  temas_publicados: number; temas_completos: number; total_practica: number;
}
interface Hueco { unidad: number; tema: string; tipo: string; detalle: string; gravedad: 'alta' | 'media' }
interface Datos {
  unidades: Unidad[];
  huecos: Hueco[];
  resumen: { temas_publicados: number; temas_completos: number; huecos_altos: number; huecos_medios: number };
  que_significa: string;
  por_que_importa: string;
}

const ETIQUETA: Record<string, string> = { basico: 'Básico', intermedio: 'Interm.', avanzado: 'Avanz.' };

export default function CoberturaPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<Datos>('/docente/ejercicios/cobertura')
      .then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  if (!d) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Cobertura del banco"
        subtitle="Ejercicios por unidad, tema y nivel, con los huecos que impiden que la adaptatividad funcione."
      />

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Temas publicados', String(d.resumen.temas_publicados)],
            ['Temas completos', String(d.resumen.temas_completos)],
            ['Huecos graves', String(d.resumen.huecos_altos)],
            ['Huecos menores', String(d.resumen.huecos_medios)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-lg bg-subtle px-2 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted">{l}</p>
              <p className="text-sm font-semibold text-fg">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">{d.que_significa}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">{d.por_que_importa}</p>
      </Card>

      {/* Huecos primero: es lo accionable */}
      {d.huecos.length > 0 ? (
        <Card className="mb-6 border-prexi-amber/40">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-prexi-amber" />
            <SectionTitle>Huecos detectados ({d.huecos.length})</SectionTitle>
          </div>
          <div className="space-y-2">
            {d.huecos.map((h, i) => (
              <div key={`${h.tema}-${h.tipo}-${i}`} className="rounded-xl border border-line p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge tone={h.gravedad === 'alta' ? 'red' : 'amber'}>U{h.unidad}</Badge>
                  <span className="text-sm font-medium text-fg">{h.tema}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted">{h.detalle}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="mb-6">
          <EmptyState
            icon={<CheckCircle className="h-7 w-7" />}
            title="Sin huecos: todos los temas publicados tienen material completo"
            hint="Cada tema publicado tiene ejercicios en los tres niveles y al menos una pregunta de examen."
          />
        </div>
      )}

      {/* Detalle por unidad */}
      {d.unidades.map((u) => (
        <Card key={u.id} className="mb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Unidad {u.numero} — {u.titulo}</SectionTitle>
            <div className="flex gap-1.5">
              <Badge tone="slate">{u.total_practica} ejercicios</Badge>
              <Badge tone={u.temas_completos === u.temas_publicados ? 'green' : 'amber'}>
                {u.temas_completos}/{u.temas_publicados} completos
              </Badge>
            </div>
          </div>

          <div className="space-y-1.5">
            {u.temas.map((t) => (
              <div key={t.id} className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${t.publicado ? 'bg-subtle' : 'opacity-50'}`}>
                {t.completo
                  ? <CheckCircle className="h-3.5 w-3.5 shrink-0 text-prexi-green" />
                  : <Code className="h-3.5 w-3.5 shrink-0 text-muted" />}
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  {t.numero} {t.titulo}
                  {!t.publicado && <span className="ml-2 text-xs text-muted">(sin publicar)</span>}
                </span>
                <div className="flex gap-1">
                  {t.por_nivel.map((p) => (
                    <span
                      key={p.nivel}
                      title={`${ETIQUETA[p.nivel]}: ${p.ejercicios} ejercicios`}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        p.ejercicios === 0 && t.publicado
                          ? 'bg-prexi-red/15 text-prexi-red'
                          : 'bg-card text-muted'}`}
                    >
                      {ETIQUETA[p.nivel]} {p.ejercicios}
                    </span>
                  ))}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    t.examen === 0 && t.publicado ? 'bg-prexi-amber/20 text-prexi-amber' : 'bg-card text-muted'}`}>
                    Examen {t.examen}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
