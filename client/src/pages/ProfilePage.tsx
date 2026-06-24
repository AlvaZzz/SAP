import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { DashboardData, DiagnosticoResultado } from '../lib/types';
import { Award, Flame, Star, Trophy, Target } from '../components/icons';

export default function ProfilePage() {
  const { usuario } = useAuth();
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [diag, setDiag] = useState<DiagnosticoResultado | null>(null);

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then(setDash).catch(() => undefined);
    api.get<{ resultado: DiagnosticoResultado | null }>('/diagnostico/estado')
      .then((r) => setDiag(r.resultado)).catch(() => undefined);
  }, []);

  const inicial = usuario?.nombre.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="mx-auto max-w-4xl">
      {/* Cabecera de perfil */}
      <div className="card mb-6 overflow-hidden !p-0">
        <div className="h-24 bg-gradient-to-r from-prexi-navy to-prexi-blue" />
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-3 flex items-end gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-white bg-gradient-to-br from-prexi-blue to-blue-400 text-2xl font-extrabold text-white shadow">
              {inicial}
            </div>
            <div className="mb-1">
              <h1 className="text-xl font-extrabold text-prexi-navy">{usuario?.nombre}</h1>
              <p className="text-sm text-slate-500">{usuario?.email}</p>
            </div>
            {diag && (
              <span className="mb-2 ml-auto rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-prexi-blue">
                Nivel {diag.nivel}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-500">
            <span className="rounded-lg bg-slate-100 px-3 py-1 capitalize">{usuario?.rol}</span>
            {usuario?.carrera && <span className="rounded-lg bg-slate-100 px-3 py-1">{usuario.carrera}</span>}
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={<Star className="h-5 w-5" />} label="Puntos XP" value={dash?.puntos ?? '—'} tone="text-prexi-blue bg-blue-50" />
        <Metric icon={<Trophy className="h-5 w-5" />} label="Posición" value={dash?.posicion ? `#${dash.posicion}` : '—'} tone="text-prexi-amber bg-amber-50" />
        <Metric icon={<Target className="h-5 w-5" />} label="Ejercicios" value={dash ? `${dash.ejercicios.completados}/${dash.ejercicios.total}` : '—'} tone="text-prexi-green bg-green-50" />
        <Metric icon={<Flame className="h-5 w-5" />} label="Racha" value={dash ? `${dash.racha_dias} días` : '—'} tone="text-orange-500 bg-orange-50" />
      </div>

      {/* Insignias */}
      <div className="card">
        <div className="mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-prexi-amber" />
          <h2 className="text-lg font-bold text-prexi-navy">Insignias</h2>
        </div>
        {!dash?.logros.length && <p className="text-sm text-slate-400">Aún sin insignias. ¡Acierta tu primer ejercicio!</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {dash?.logros.map((l) => (
            <div key={l.clave} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <span className="text-2xl">{l.icono}</span>
              <span className="text-sm font-medium text-slate-700">{l.nombre}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) {
  return (
    <div className="card flex items-center gap-3 !p-4">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-lg font-bold text-prexi-navy">{value}</p>
      </div>
    </div>
  );
}
