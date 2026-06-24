import { useEffect, useState } from 'react';

import { api } from '../lib/api';

interface Comparativa {
  comparativa: { categoria: string; pretest: number | null; postest: number | null; mejora: number | null }[];
  pretest_total: number | null;
  postest_total: number | null;
  ganancia: number | null;
}

export default function ProgressPage() {
  const [data, setData] = useState<Comparativa | null>(null);

  useEffect(() => {
    api.get<Comparativa>('/pretest/comparativa').then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold text-prexi-navy">Mi progreso académico</h1>
      <p className="mb-6 text-slate-500">Comparativa entre tu evaluación inicial (pretest) y final (postest).</p>

      {/* Banner de ganancia */}
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-prexi-navy to-prexi-blue text-white">
        <div>
          <p className="text-sm uppercase text-blue-200">Reporte semestral</p>
          <h2 className="text-2xl font-bold">Crecimiento en lógica de programación</h2>
        </div>
        <div className="flex gap-8">
          <div>
            <p className="text-xs text-blue-200">PRETEST</p>
            <p className="text-2xl font-bold">{data?.pretest_total ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-blue-200">POSTEST</p>
            <p className="text-2xl font-bold">{data?.postest_total ?? '—'}</p>
          </div>
          <div className="rounded-xl bg-prexi-green px-4 py-2 text-center">
            <p className="text-xs">GANANCIA</p>
            <p className="text-2xl font-bold">
              {data?.ganancia != null ? `${data.ganancia > 0 ? '+' : ''}${data.ganancia}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Comparativa por tema */}
      <div className="card">
        <h2 className="mb-4 text-lg font-bold text-prexi-navy">Comparativa por tema</h2>
        {!data?.comparativa.length && <p className="text-sm text-slate-400">Aún no hay registros de pre/postest.</p>}
        <div className="space-y-5">
          {data?.comparativa.map((c) => (
            <div key={c.categoria}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-slate-700">{c.categoria}</span>
                {c.mejora != null && (
                  <span className="font-semibold text-prexi-green">+{c.mejora}% mejora</span>
                )}
              </div>
              {/* Pretest */}
              <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-prexi-blue" style={{ width: `${c.pretest ?? 0}%` }} />
              </div>
              {/* Postest */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-prexi-green" style={{ width: `${c.postest ?? 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-full bg-prexi-blue" /> Pretest</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-full bg-prexi-green" /> Postest</span>
        </div>
      </div>
    </div>
  );
}
