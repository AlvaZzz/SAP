'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Card, SectionTitle, Skeleton, Badge, EmptyState, PageHeader, ResponsiveTable } from '@/components/ui';
import { Activity, ScatterChart } from '@/components/icons';

interface Punto { id_anonimo: string; grupo: 'control' | 'experimental'; ganancia: number; xp_total: number; ejercicios_resueltos: number; consultas_ia: number; pistas_usadas: number }
interface PromGrupo { grupo: 'control' | 'experimental'; n: number; ganancia: number | null; xp_total: number | null; ejercicios_resueltos: number | null; consultas_ia: number | null; pistas_usadas: number | null }
interface Tercil { nivel: string; rango: string; ganancia_media: number | null; n: number }
interface Datos { hay_datos: boolean; puntos: Punto[]; promedios_por_grupo: PromGrupo[]; ganancia_por_uso: Tercil[] }

type EjeX = 'xp_total' | 'ejercicios_resueltos' | 'consultas_ia' | 'pistas_usadas';
const EJES: { key: EjeX; label: string }[] = [
  { key: 'xp_total', label: 'XP acumulado' },
  { key: 'ejercicios_resueltos', label: 'Ejercicios resueltos' },
  { key: 'consultas_ia', label: 'Consultas a ALVARO' },
  { key: 'pistas_usadas', label: 'Pistas usadas' },
];

export default function DatosPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [eje, setEje] = useState<EjeX>('xp_total');

  useEffect(() => {
    api.get<Datos>('/investigador/datos').then(setD).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-80" /></div>;
  if (!d || !d.hay_datos) return (
    <div className="animate-fade-up">
      <Encabezado />
      <EmptyState icon={<Activity className="h-7 w-7" />} title="Aún no hay datos suficientes para mostrar resultados" hint="Se necesitan estudiantes con pretest y postest para relacionar el uso del sistema con la mejora." />
    </div>
  );

  return (
    <div className="animate-fade-up">
      <Encabezado />

      {/* Dispersión ganancia ↔ uso */}
      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><ScatterChart className="h-5 w-5 text-prexi-blue-deep" /><SectionTitle>Relación uso ↔ ganancia</SectionTitle></div>
          <div className="flex flex-wrap gap-1.5">
            {EJES.map((e) => (
              <button key={e.key} onClick={() => setEje(e.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${eje === e.key ? 'bg-prexi-blue text-white' : 'border border-line text-muted hover:bg-subtle'}`}>
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <Dispersion puntos={d.puntos} eje={eje} etiqueta={EJES.find((e) => e.key === eje)!.label} />
        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-navy" /> Control</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-prexi-green" /> Experimental</span>
          <span className="ml-auto">Eje Y: ganancia (postest − pretest) · Eje X: {EJES.find((e) => e.key === eje)!.label}</span>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ganancia media según nivel de uso */}
        <Card>
          <SectionTitle className="mb-1">Ganancia media según práctica</SectionTitle>
          <p className="mb-4 text-sm text-muted">Estudiantes agrupados por tercios de ejercicios resueltos.</p>
          <div className="space-y-3">
            {d.ganancia_por_uso.map((t) => {
              const max = Math.max(1, ...d.ganancia_por_uso.map((x) => Math.abs(x.ganancia_media ?? 0)));
              return (
                <div key={t.nivel}>
                  <div className="mb-1 flex items-center justify-between text-sm"><span className="font-medium text-fg">{t.nivel}</span><span className="text-xs text-muted">{t.rango} · n={t.n}</span></div>
                  <div className="flex items-center gap-2">
                    <div className="h-5 flex-1 overflow-hidden rounded bg-subtle"><div className="h-full rounded bg-gradient-to-r from-prexi-blue to-prexi-green transition-all duration-700" style={{ width: `${(Math.abs(t.ganancia_media ?? 0) / max) * 100}%` }} /></div>
                    <span className="w-12 shrink-0 text-right text-sm font-semibold text-fg">{t.ganancia_media != null ? `${t.ganancia_media > 0 ? '+' : ''}${t.ganancia_media}` : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Promedios por grupo */}
        <div>
          <SectionTitle className="mb-3">Promedios por grupo</SectionTitle>
          <ResponsiveTable
            rows={d.promedios_por_grupo}
            rowKey={(g) => g.grupo}
            cols={[
              { header: 'Grupo', cell: (g) => <Badge tone={g.grupo === 'experimental' ? 'green' : 'slate'}>{g.grupo}</Badge> },
              { header: 'Ganancia', cell: (g) => <span className="font-semibold text-fg">{g.ganancia ?? '—'}</span> },
              { header: 'XP', cell: (g) => <span className="text-muted">{g.xp_total ?? '—'}</span> },
              { header: 'Ejerc.', cell: (g) => <span className="text-muted">{g.ejercicios_resueltos ?? '—'}</span> },
              { header: 'IA', cell: (g) => <span className="text-muted">{g.consultas_ia ?? '—'}</span> },
              { header: 'Pistas', cell: (g) => <span className="text-muted">{g.pistas_usadas ?? '—'}</span> },
            ]}
            footer={<p className="px-5 py-4 text-xs text-muted">Evidencia descriptiva de apoyo: relaciona adaptatividad y gamificación con el aprendizaje. No implica causalidad ni prueba estadística.</p>}
          />
        </div>
      </div>
    </div>
  );
}

function Encabezado() {
  return <PageHeader title="Datos complementarios" subtitle="Relación entre el uso del sistema y la mejora obtenida (evidencia descriptiva de apoyo)." />;
}

function Dispersion({ puntos, eje, etiqueta }: { puntos: Punto[]; eje: EjeX; etiqueta: string }) {
  const W = 640, H = 300, padL = 40, padB = 34, padT = 10, padR = 12;
  const { maxX, minY, maxY } = useMemo(() => {
    const xs = puntos.map((p) => p[eje]); const ys = puntos.map((p) => p.ganancia);
    return { maxX: Math.max(1, ...xs), minY: Math.min(0, ...ys), maxY: Math.max(1, ...ys) };
  }, [puntos, eje]);

  const innerW = W - padL - padR, innerH = H - padB - padT;
  const x = (v: number) => padL + (v / maxX) * innerW;
  const y = (v: number) => padT + innerH - ((v - minY) / (maxY - minY || 1)) * innerH;

  const yTicks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const val = minY + ((maxY - minY) / yTicks) * i;
        return <g key={i}><line x1={padL} x2={W - padR} y1={y(val)} y2={y(val)} stroke="rgb(var(--line))" /><text x={4} y={y(val) + 3} fontSize={9} fill="rgb(var(--muted))">{Math.round(val)}</text></g>;
      })}
      {/* eje X base */}
      <line x1={padL} x2={W - padR} y1={y(minY)} y2={y(minY)} stroke="rgb(var(--muted))" strokeOpacity="0.4" />
      {puntos.map((p) => (
        <circle key={p.id_anonimo} cx={x(p[eje])} cy={y(p.ganancia)} r={5}
          fill={p.grupo === 'experimental' ? '#2E7D5B' : '#1B2B44'} fillOpacity="0.75">
          <title>{p.id_anonimo} · {etiqueta}: {p[eje]} · ganancia: {p.ganancia}</title>
        </circle>
      ))}
      <text x={padL + innerW / 2} y={H - 4} fontSize={10} fill="rgb(var(--muted))" textAnchor="middle">{etiqueta} →</text>
    </svg>
  );
}
