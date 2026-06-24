import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Config {
  xp_por_ejercicio: number;
  umbral_nivel: number;
  max_pistas_ia: number;
  modelo_ia: string;
}

interface UsoIA {
  nombre: string;
  email: string;
  llamadas_total: number;
  ultima_hora: number;
  ultimo_dia: number;
}

export default function AdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [uso, setUso] = useState<UsoIA[]>([]);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    api.get<{ config: Config }>('/admin/config').then((r) => setConfig(r.config));
    api.get<{ uso: UsoIA[] }>('/admin/ia/uso').then((r) => setUso(r.uso)).catch(() => setUso([]));
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!config) return;
    const r = await api.put<{ config: Config }>('/admin/config', config);
    setConfig(r.config);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }

  if (!config) return <p className="text-slate-400">Cargando configuración…</p>;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-extrabold text-prexi-navy">Panel de administración</h1>
      <p className="mb-6 text-slate-500">Configuración del sistema, IA y gamificación.</p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuración IA + gamificación */}
        <form onSubmit={guardar} className="card">
          <h2 className="mb-4 text-lg font-bold text-prexi-navy">⚙️ Configuración</h2>

          <Campo label="Modelo de IA (Gemini)">
            <select
              className="input"
              value={config.modelo_ia}
              onChange={(e) => setConfig({ ...config, modelo_ia: e.target.value })}
            >
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            </select>
          </Campo>

          <Campo label="Máx. nivel de pista por ejercicio (1-3)">
            <input
              type="number" min={0} max={3} className="input"
              value={config.max_pistas_ia}
              onChange={(e) => setConfig({ ...config, max_pistas_ia: Number(e.target.value) })}
            />
          </Campo>

          <Campo label="XP base por ejercicio">
            <input
              type="number" min={0} className="input"
              value={config.xp_por_ejercicio}
              onChange={(e) => setConfig({ ...config, xp_por_ejercicio: Number(e.target.value) })}
            />
          </Campo>

          <Campo label="Umbral de ejercicios para desbloquear nivel">
            <input
              type="number" min={1} className="input"
              value={config.umbral_nivel}
              onChange={(e) => setConfig({ ...config, umbral_nivel: Number(e.target.value) })}
            />
          </Campo>

          <button className="btn-primary mt-2 w-full">{guardado ? '✓ Guardado' : 'Guardar cambios'}</button>
        </form>

        {/* Auditoría de uso de IA */}
        <div className="card">
          <h2 className="mb-1 text-lg font-bold text-prexi-navy">🤖 Uso de IA (control de costos)</h2>
          <p className="mb-4 text-sm text-slate-500">Llamadas a Gemini por estudiante.</p>
          <div className="space-y-2">
            {uso.map((u) => (
              <div key={u.email} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{u.nombre}</span>
                <span className="text-slate-500">
                  <b className="text-prexi-navy">{u.ultima_hora}</b>/h · {u.llamadas_total} total
                </span>
              </div>
            ))}
            {uso.length === 0 && <p className="text-sm text-slate-400">Aún no hay uso registrado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
