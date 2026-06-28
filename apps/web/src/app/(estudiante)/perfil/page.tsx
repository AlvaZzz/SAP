'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Award, Star, Trophy, Target, Flame, User as UserIcon, Lock } from '@/components/icons';

const CARRERAS = ['Ingeniería de Sistemas', 'Ingeniería de Software', 'Ingeniería Informática', 'Ingeniería Electrónica', 'Ingeniería Industrial', 'Otra'];

interface Resumen { puntos: number; posicion: number | null; racha_dias: number; ejercicios: { completados: number; total: number } }
interface Logro { id: number; clave: string; nombre: string; condicion: string; icono: string; obtenido: boolean }

export default function PerfilPage() {
  const { usuario, refrescar } = useAuth();
  const [res, setRes] = useState<Resumen | null>(null);
  const [logros, setLogros] = useState<Logro[]>([]);
  const [nivel, setNivel] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nombre: '', carrera: '' });
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<Resumen>('/gamificacion/resumen').then(setRes).catch(() => undefined);
    api.get<{ logros: Logro[] }>('/gamificacion/logros').then((r) => setLogros(r.logros)).catch(() => undefined);
    api.get<{ resultado: { nivel: string } | null }>('/pretest/estado').then((r) => setNivel(r.resultado?.nivel ?? null)).catch(() => undefined);
  }, []);

  function abrir() { setForm({ nombre: usuario?.nombre ?? '', carrera: usuario?.carrera ?? '' }); setMsg(''); setEditando(true); }
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (form.nombre.trim().length < 2 || form.carrera.trim().length < 2) { setMsg('Completa nombre y carrera.'); return; }
    setGuardando(true);
    try { await api.put('/auth/perfil', form); await refrescar(); setEditando(false); }
    catch (err) { setMsg(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  const inicial = usuario?.nombre.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <div className="card mb-6 overflow-hidden !p-0">
        <div className="h-24 bg-gradient-to-r from-prexi-navy to-prexi-blue" />
        <div className="px-6 pb-6">
          <div className="-mt-10 mb-3 flex items-end gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-2xl border-4 border-white bg-gradient-to-br from-prexi-blue to-blue-400 text-2xl font-extrabold text-white shadow">{inicial}</div>
            <div className="mb-1"><h1 className="text-xl font-extrabold text-prexi-navy">{usuario?.nombre}</h1><p className="text-sm text-slate-500">{usuario?.email}</p></div>
            <div className="mb-1 ml-auto flex items-center gap-2">
              {nivel && <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-prexi-blue">Nivel {nivel}</span>}
              {!editando && <button onClick={abrir} className="btn-ghost !py-1.5 !px-3 text-sm"><UserIcon className="h-4 w-4" /> Editar</button>}
            </div>
          </div>
          {editando ? (
            <form onSubmit={guardar} className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Nombre completo</span><input className="input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></label>
              <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Carrera</span><select className="input" value={form.carrera} onChange={(e) => setForm((f) => ({ ...f, carrera: e.target.value }))}><option value="">Selecciona…</option>{CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
              {msg && <p className="text-sm text-red-500 sm:col-span-2">{msg}</p>}
              <div className="flex gap-2 sm:col-span-2"><button className="btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button><button type="button" onClick={() => setEditando(false)} className="btn-ghost">Cancelar</button></div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2 text-sm text-slate-500"><span className="rounded-lg bg-slate-100 px-3 py-1 capitalize">{usuario?.rol}</span>{usuario?.carrera && <span className="rounded-lg bg-slate-100 px-3 py-1">{usuario.carrera}</span>}</div>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={<Star className="h-5 w-5" />} label="Puntos XP" value={res?.puntos ?? '—'} tone="text-prexi-blue bg-blue-50" />
        <Metric icon={<Trophy className="h-5 w-5" />} label="Posición" value={res?.posicion ? `#${res.posicion}` : '—'} tone="text-prexi-amber bg-amber-50" />
        <Metric icon={<Target className="h-5 w-5" />} label="Ejercicios" value={res ? `${res.ejercicios.completados}/${res.ejercicios.total}` : '—'} tone="text-prexi-green bg-green-50" />
        <Metric icon={<Flame className="h-5 w-5" />} label="Racha" value={res ? `${res.racha_dias} días` : '—'} tone="text-orange-500 bg-orange-50" />
      </div>

      <div className="card">
        <div className="mb-4 flex items-center gap-2"><Award className="h-5 w-5 text-prexi-amber" /><h2 className="text-lg font-bold text-prexi-navy">Insignias</h2></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {logros.map((l) => (
            <div key={l.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${l.obtenido ? 'border-slate-100 bg-slate-50' : 'border-dashed border-slate-200 opacity-60'}`} title={l.condicion}>
              <span className={`text-2xl ${l.obtenido ? '' : 'grayscale'}`}>{l.obtenido ? l.icono : <Lock className="h-5 w-5 text-slate-300" />}</span>
              <div><p className="text-sm font-medium text-slate-700">{l.nombre}</p>{!l.obtenido && <p className="text-[11px] text-slate-400">{l.condicion}</p>}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: string }) {
  return (
    <div className="card card-hover flex items-center gap-3 !p-4">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>{icon}</div>
      <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="text-lg font-bold text-prexi-navy">{value}</p></div>
    </div>
  );
}
