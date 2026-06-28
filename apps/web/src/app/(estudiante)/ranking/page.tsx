'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Trophy, TrendingUp } from '@/components/icons';

interface Fila { posicion: number | null; usuario_id: number; nombre: string; xp_total: number; racha_dias: number }
interface Yo { posicion: number | null; nombre: string; xp_total: number; racha_dias: number }

export default function RankingPage() {
  const { usuario } = useAuth();
  const [ranking, setRanking] = useState<Fila[]>([]);
  const [yo, setYo] = useState<Yo | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ ranking: Fila[]; yo: Yo | null }>('/ranking')
      .then((r) => { setRanking(r.ranking); setYo(r.yo); })
      .catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const arriba = yo?.posicion ? ranking.find((r) => r.posicion === yo.posicion! - 1) : undefined;
  const xpParaSubir = arriba && yo ? Math.max(0, arriba.xp_total - yo.xp_total + 1) : null;
  const podio = ranking.slice(0, 3);
  const medalla = (p: number | null) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : `#${p ?? '—'}`);

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <h1 className="text-3xl font-extrabold text-prexi-navy">Ranking en vivo</h1>
      <p className="mb-6 text-slate-500">Compite con tu grupo acumulando XP.</p>

      {/* Podio */}
      {podio.length === 3 && (
        <div className="mb-6 grid grid-cols-3 items-end gap-3">
          {[podio[1], podio[0], podio[2]].map((r, i) => {
            const real = [2, 1, 3][i];
            const alturas = ['h-24', 'h-32', 'h-20'][i];
            const colores = ['from-slate-300 to-slate-400', 'from-amber-300 to-amber-500', 'from-orange-300 to-orange-400'][i];
            return (
              <div key={r.usuario_id} className="flex flex-col items-center">
                <div className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-prexi-navy to-prexi-blue text-lg font-bold text-white">{r.nombre.charAt(0)}</div>
                <p className="text-center text-sm font-semibold text-prexi-navy">{r.nombre.split(' ')[0]}</p>
                <p className="mb-1 text-xs text-prexi-blue">{r.xp_total.toLocaleString()} XP</p>
                <div className={`flex w-full ${alturas} items-start justify-center rounded-t-xl bg-gradient-to-b ${colores} pt-2 text-2xl font-extrabold text-white`}>{medalla(real)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tu posición */}
      {yo && (
        <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-prexi-navy to-prexi-blue text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/15"><Trophy className="h-6 w-6" /></div>
            <div><p className="text-sm text-blue-200">Tu posición</p><p className="text-2xl font-extrabold">{yo.posicion ? `#${yo.posicion}` : '—'} · {yo.xp_total.toLocaleString()} XP</p></div>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-2 text-sm">
            {xpParaSubir != null && arriba ? <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-green-300" /> Te faltan <b>{xpParaSubir} XP</b> para el puesto #{arriba.posicion}</span>
              : <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-amber-300" /> ¡Estás en lo más alto! 🎉</span>}
          </div>
        </div>
      )}

      <div className="card !p-0">
        {cargando && <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>}
        {!cargando && ranking.map((r, i) => {
          const eres = r.usuario_id === usuario?.id;
          return (
            <div key={r.usuario_id} className={`flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 last:border-0 ${eres ? 'bg-blue-50' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="w-8 text-center text-lg font-bold text-prexi-navy">{medalla(r.posicion ?? i + 1)}</span>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-prexi-navy font-bold text-white">{r.nombre.charAt(0)}</div>
                <div><p className="font-semibold text-slate-800">{r.nombre} {eres && <span className="text-xs text-prexi-blue">(Tú)</span>}</p><p className="text-xs text-slate-400">🔥 {r.racha_dias} días de racha</p></div>
              </div>
              <span className="font-bold text-prexi-blue">{r.xp_total.toLocaleString()} XP</span>
            </div>
          );
        })}
        {!cargando && ranking.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Sin datos de ranking aún.</p>}
      </div>
    </div>
  );
}
