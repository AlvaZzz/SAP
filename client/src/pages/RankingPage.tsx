import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { RankingFila } from '../lib/types';
import { useAuth } from '../context/AuthContext';

export default function RankingPage() {
  const { usuario } = useAuth();
  const [ranking, setRanking] = useState<RankingFila[]>([]);

  useEffect(() => {
    api.get<{ ranking: RankingFila[] }>('/ranking').then((r) => setRanking(r.ranking));
  }, []);

  const medalla = (pos: number | null) =>
    pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos ?? '—'}`;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold text-prexi-navy">Ranking en vivo</h1>
      <p className="mb-6 text-slate-500">Compite con tu grupo acumulando XP.</p>

      <div className="card !p-0">
        {ranking.map((r, i) => {
          const eres = r.usuario_id === usuario?.id;
          return (
            <div
              key={r.usuario_id}
              className={`flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 last:border-0 ${
                eres ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-lg font-bold text-prexi-navy">
                  {medalla(r.posicion ?? i + 1)}
                </span>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-prexi-navy font-bold text-white">
                  {r.nombre.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">
                    {r.nombre} {eres && <span className="text-xs text-prexi-blue">(Tú)</span>}
                  </p>
                  <p className="text-xs text-slate-400">🔥 {r.racha_dias} días de racha</p>
                </div>
              </div>
              <span className="font-bold text-prexi-blue">{r.xp_total.toLocaleString()} XP</span>
            </div>
          );
        })}
        {ranking.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Sin datos de ranking aún.</p>}
      </div>
    </div>
  );
}
