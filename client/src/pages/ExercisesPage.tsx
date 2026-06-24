import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { EjercicioPublico, Nivel } from '../lib/types';

export default function ExercisesPage() {
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [ejercicios, setEjercicios] = useState<EjercicioPublico[]>([]);

  useEffect(() => {
    api.get<{ niveles: Nivel[] }>('/niveles').then((r) => setNiveles(r.niveles));
    api.get<{ ejercicios: EjercicioPublico[] }>('/ejercicios').then((r) => setEjercicios(r.ejercicios));
  }, []);

  const porNivel = (nivelId: number) => ejercicios.filter((e) => e.nivel_id === nivelId);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold text-prexi-navy">Módulos de aprendizaje</h1>
      <p className="mb-6 text-slate-500">Avanza por los niveles para desbloquear nuevos desafíos.</p>

      <div className="space-y-4">
        {niveles.map((n) => {
          const pct = n.total_ejercicios ? Math.round((n.ejercicios_completados / n.umbral) * 100) : 0;
          const completo = n.ejercicios_completados >= n.umbral;
          return (
            <div
              key={n.id}
              className={`card border-l-4 ${
                completo ? 'border-l-prexi-green' : n.desbloqueado ? 'border-l-prexi-blue' : 'border-l-slate-300 opacity-70'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-11 w-11 place-items-center rounded-full text-lg ${
                      completo ? 'bg-green-100 text-prexi-green' : n.desbloqueado ? 'bg-blue-100 text-prexi-blue' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {completo ? '✓' : n.desbloqueado ? '▶' : '🔒'}
                  </div>
                  <div>
                    {completo && (
                      <span className="mb-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-prexi-green">
                        Completado
                      </span>
                    )}
                    <h2 className="text-lg font-bold text-prexi-navy">
                      Nivel {n.numero}: {n.titulo}
                    </h2>
                    <p className="text-sm text-slate-500">{n.descripcion}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    {n.ejercicios_completados} / {n.umbral} completados
                  </p>
                  <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-prexi-blue"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              </div>

              {n.desbloqueado && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {porNivel(n.id).map((e) => (
                    <Link
                      key={e.id}
                      to={`/ejercicios/${e.id}`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-prexi-blue hover:text-prexi-blue"
                    >
                      {e.titulo} · +{e.xp} XP
                    </Link>
                  ))}
                  {porNivel(n.id).length === 0 && (
                    <span className="text-sm text-slate-400">Sin ejercicios cargados en este nivel.</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
