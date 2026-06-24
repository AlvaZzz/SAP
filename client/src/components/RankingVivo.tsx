import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { RankingFila } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Trophy } from './icons';

export function RankingVivo() {
  const { usuario } = useAuth();
  const [filas, setFilas] = useState<RankingFila[]>([]);

  useEffect(() => {
    api.get<{ ranking: RankingFila[] }>('/ranking?limite=5').then((r) => setFilas(r.ranking)).catch(() => undefined);
  }, []);

  return (
    <div className="card !p-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-prexi-amber" />
          <h3 className="font-bold text-prexi-navy">Ranking en Vivo</h3>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Gpo. 1A</span>
      </div>

      <div className="divide-y divide-slate-50">
        {filas.map((r, i) => {
          const eres = r.usuario_id === usuario?.id;
          const pos = r.posicion ?? i + 1;
          return (
            <div key={r.usuario_id} className={`flex items-center gap-3 px-5 py-2.5 ${eres ? 'bg-blue-50' : ''}`}>
              <span className={`w-5 text-center text-sm font-bold ${pos <= 3 ? 'text-prexi-amber' : 'text-slate-400'}`}>{pos}</span>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-prexi-navy to-prexi-blue text-xs font-bold text-white">
                {r.nombre.charAt(0)}
              </div>
              <span className="flex-1 truncate text-sm font-medium text-slate-700">
                {eres ? `Tú (${r.nombre.split(' ')[0]} ${r.nombre.split(' ')[1]?.charAt(0) ?? ''}.)` : r.nombre}
              </span>
              <span className="text-sm font-bold text-prexi-blue">{r.xp_total.toLocaleString()} XP</span>
            </div>
          );
        })}
        {filas.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-400">Sin datos de ranking.</p>}
      </div>

      <Link to="/ranking" className="block border-t border-slate-100 py-2.5 text-center text-sm font-semibold text-prexi-blue hover:underline">
        Ver tabla completa
      </Link>
    </div>
  );
}
