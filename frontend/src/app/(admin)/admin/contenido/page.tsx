'use client';

/**
 * CONTENIDO DEL CURSO (administrador). Por unidad: cuántos ejercicios de
 * práctica tiene cada tema y subtema en Básico, Intermedio y Avanzado, cuántas
 * preguntas tiene el examen y cuántos retos hay. Lo que no llega a la meta de
 * 10 se marca, para pedírselo al docente (lo completa desde Unidades).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { NIVEL_COLOR } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton, StatGrid, StatCard } from '@/components/ui';
import { Layers, CheckCircle, AlertTriangle, Target, Code, GraduationCap, ArrowRight } from '@/components/icons';

interface Tema {
  id: number; numero: string; titulo: string; es_subtema: boolean; publicado: boolean;
  basico: number; intermedio: number; avanzado: number; retos_bug: number; retos_codigo: number; faltan: number;
}
interface Unidad { id: number; numero: number; titulo: string; examen: number; examen_faltan: number; temas: Tema[]; temas_completos: number }
interface Respuesta {
  meta: number; unidades: Unidad[];
  totales: { temas: number; temas_completos: number; ejercicios: number; faltan: number; retos: number; unidades_sin_examen_completo: number };
}

export default function AdminContenidoPage() {
  const [d, setD] = useState<Respuesta | null>(null);
  const [soloFaltantes, setSoloFaltantes] = useState(false);
  useEffect(() => { api.get<Respuesta>('/admin/contenido').then(setD).catch(() => undefined); }, []);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Contenido del curso"
        subtitle={`Cada tema necesita ${d?.meta ?? 10} ejercicios por nivel y cada examen de unidad ${d?.meta ?? 10} preguntas. Los docentes lo completan desde Unidades.`}
        action={<Link href="/docente/unidades" className="btn-ghost">Ir a Unidades (docente) <ArrowRight className="h-4 w-4" /></Link>} />

      <StatGrid className="mb-5">
        {!d ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <StatCard icon={<Layers className="h-7 w-7" />} accent="blue" label="Temas completos" value={`${d.totales.temas_completos} de ${d.totales.temas}`} />
            <StatCard icon={<Code className="h-7 w-7" />} accent="navy" label="Ejercicios de práctica" value={d.totales.ejercicios} />
            <StatCard icon={<AlertTriangle className="h-7 w-7" />} accent="amber" label="Ejercicios que faltan" value={d.totales.faltan} />
            <StatCard icon={<Target className="h-7 w-7" />} accent="green" label="Retos" value={d.totales.retos} />
          </>
        )}
      </StatGrid>

      {d && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {d.totales.faltan === 0 && d.totales.unidades_sin_examen_completo === 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-prexi-green"><CheckCircle className="h-5 w-5" /> Todo el contenido está completo.</p>
          ) : <p className="text-sm text-muted">Lo marcado en ámbar no llega a la meta.</p>}
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={soloFaltantes} onChange={(e) => setSoloFaltantes(e.target.checked)} className="h-4 w-4 accent-prexi-blue" /> Mostrar solo lo que falta
          </label>
        </div>
      )}

      {!d ? <Skeleton className="h-64" /> : (
        <div className="space-y-5">
          {d.unidades.map((u) => {
            const temas = u.temas.filter((t) => !soloFaltantes || (t.publicado && t.faltan > 0));
            if (soloFaltantes && temas.length === 0 && u.examen_faltan === 0) return null;
            return (
              <Card key={u.id} className="!p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">Unidad {u.numero}</p>
                    <h2 className="font-display text-lg font-bold text-fg">{u.titulo}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={u.temas_completos === u.temas.filter((t) => t.publicado).length ? 'green' : 'amber'}>{u.temas_completos} de {u.temas.filter((t) => t.publicado).length} temas completos</Badge>
                    <Badge tone={u.examen_faltan ? 'amber' : 'green'}><GraduationCap className="h-3 w-3" /> Examen: {u.examen} de {d.meta}</Badge>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted">
                      <tr className="border-b border-line">
                        <th className="px-5 py-2.5">Tema</th>
                        <th className="px-2 py-2.5 text-center" style={{ color: NIVEL_COLOR.basico }}>Básico</th>
                        <th className="px-2 py-2.5 text-center" style={{ color: NIVEL_COLOR.intermedio }}>Intermedio</th>
                        <th className="px-2 py-2.5 text-center" style={{ color: NIVEL_COLOR.avanzado }}>Avanzado</th>
                        <th className="px-2 py-2.5 text-center">Retos</th>
                        <th className="px-5 py-2.5 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {temas.map((t) => (
                        <tr key={t.id} className={`border-b border-line last:border-0 ${t.publicado ? '' : 'opacity-50'}`}>
                          <td className={`py-2.5 pr-2 ${t.es_subtema ? 'pl-10' : 'pl-5'}`}>
                            <span className={t.es_subtema ? 'text-muted' : 'font-medium text-fg'}>{t.es_subtema ? '└ ' : ''}{t.numero} {t.titulo}</span>
                            {!t.publicado && <span className="ml-2 text-xs text-muted">(sin publicar)</span>}
                          </td>
                          {(['basico', 'intermedio', 'avanzado'] as const).map((n) => <td key={n} className="px-2 py-2.5 text-center"><Cuenta n={t[n]} meta={d.meta} /></td>)}
                          <td className="px-2 py-2.5 text-center text-muted" title={`${t.retos_bug} de «Encuentra el bug» y ${t.retos_codigo} de «Escribe tu código»`}>
                            {t.retos_bug + t.retos_codigo || '—'}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            {t.faltan === 0 ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-prexi-green"><CheckCircle className="h-4 w-4" /> Completo</span>
                              : <span className="text-xs font-semibold text-prexi-amber">Faltan {t.faltan}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cuenta({ n, meta }: { n: number; meta: number }) {
  const ok = n >= meta;
  return (
    <span className={`inline-block min-w-[2.5rem] rounded-md px-2 py-0.5 text-sm font-bold ${ok ? 'bg-prexi-green/10 text-prexi-green' : 'bg-prexi-amber/15 text-prexi-amber'}`}>
      {n}<span className="font-normal text-muted">/{meta}</span>
    </span>
  );
}
