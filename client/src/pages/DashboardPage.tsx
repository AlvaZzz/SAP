import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { DashboardData } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/StatCard';
import { ProgressBar } from '../components/ProgressBar';

export default function DashboardPage() {
  const { usuario } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>('/dashboard').then(setData).catch(() => setData(null));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-extrabold text-prexi-navy">
        ¡Bienvenido de nuevo, {usuario?.nombre.split(' ')[0]}!
      </h1>
      <p className="mb-6 text-slate-500">Continúa tu ruta de aprendizaje en programación.</p>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="⭐" label="Puntos XP" value={data?.puntos ?? '—'} accent="blue" />
        <StatCard icon="🏆" label="Posición" value={data?.posicion ? `#${data.posicion}` : '—'} accent="amber" />
        <StatCard
          icon="✓"
          label="Ejercicios"
          value={data ? `${data.ejercicios.completados}/${data.ejercicios.total}` : '—'}
          accent="green"
        />
        <StatCard icon="🔥" label="Racha" value={data ? `${data.racha_dias} días` : '—'} accent="navy" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Desempeño por categoría */}
        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-prexi-navy">Desempeño por categoría</h2>
          {!data?.desempeno_categorias.length && (
            <p className="text-sm text-slate-400">Aún no tienes intentos registrados. ¡Empieza a practicar!</p>
          )}
          <div className="space-y-4">
            {data?.desempeno_categorias.map((c) => (
              <div key={c.categoria}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{c.categoria}</span>
                  <span className="font-semibold text-prexi-navy">{c.porcentaje}%</span>
                </div>
                <ProgressBar
                  value={c.porcentaje}
                  color={c.porcentaje >= 80 ? '#16a34a' : c.porcentaje >= 60 ? '#2563eb' : '#f59e0b'}
                />
              </div>
            ))}
          </div>

          <Link to="/ejercicios" className="btn-primary mt-6">
            Continuar aprendiendo →
          </Link>
        </div>

        {/* Insignias */}
        <div className="card bg-prexi-navy text-white">
          <h2 className="mb-1 text-lg font-bold">Tus insignias</h2>
          <p className="mb-4 text-sm text-blue-200">Logros desbloqueados por tu progreso.</p>
          {!data?.logros.length && <p className="text-sm text-blue-200">Aún sin insignias. ¡Acierta tu primer ejercicio!</p>}
          <div className="space-y-3">
            {data?.logros.map((l) => (
              <div key={l.clave} className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2">
                <span className="text-2xl">{l.icono}</span>
                <span className="text-sm font-medium">{l.nombre}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
