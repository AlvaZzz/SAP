'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { CountUp } from '@/components/count-up';
import { Award, Star, Trophy, Target, Flame, User as UserIcon, Lock, CheckCircle, Play, Medal, Edit, X } from '@/components/icons';

const CARRERAS = ['Ingeniería de Sistemas', 'Ingeniería de Software', 'Ingeniería Informática', 'Ingeniería Electrónica', 'Ingeniería Industrial', 'Otra'];

interface Resumen { puntos: number; posicion: number | null; racha_dias: number; ejercicios: { completados: number; total: number } }
interface Logro { id: number; clave: string; nombre: string; condicion: string; icono: string; obtenido: boolean }
interface NivelP { id: number; numero: number; titulo: string; umbral: number; ejercicios_completados: number; desbloqueado: boolean }

export default function PerfilPage() {
  const { usuario, refrescar } = useAuth();
  const [res, setRes] = useState<Resumen | null>(null);
  const [logros, setLogros] = useState<Logro[]>([]);
  const [niveles, setNiveles] = useState<NivelP[]>([]);
  const [nivelLabel, setNivelLabel] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nombre: '', carrera: '' });
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<Resumen>('/gamificacion/resumen').then(setRes).catch(() => undefined);
    api.get<{ logros: Logro[] }>('/gamificacion/logros').then((r) => setLogros(r.logros)).catch(() => undefined);
    api.get<{ niveles: NivelP[] }>('/niveles').then((r) => setNiveles(r.niveles)).catch(() => undefined);
    api.get<{ resultado: { nivel: string } | null }>('/pretest/estado').then((r) => setNivelLabel(r.resultado?.nivel ?? null)).catch(() => undefined);
  }, []);

  const inicial = usuario?.nombre.charAt(0).toUpperCase() ?? '?';
  const idCodigo = usuario ? `2024-CS-${String(usuario.id).padStart(4, '0')}` : '—';
  const desbloqueadas = logros.filter((l) => l.obtenido).length;

  // Nivel actual y progreso hacia el siguiente (datos reales de /niveles).
  const { nivelActual, faltan, progresoNivel } = useMemo(() => {
    const orden = [...niveles].sort((a, b) => a.numero - b.numero);
    const actual = orden.find((n) => n.desbloqueado && n.ejercicios_completados < n.umbral) ?? orden.filter((n) => n.desbloqueado).pop();
    const num = actual?.numero ?? 1;
    const falt = actual ? Math.max(0, actual.umbral - actual.ejercicios_completados) : 0;
    const pct = actual && actual.umbral ? Math.min(100, Math.round((actual.ejercicios_completados / actual.umbral) * 100)) : 0;
    return { nivelActual: num, faltan: falt, progresoNivel: pct };
  }, [niveles]);

  function abrir() { setForm({ nombre: usuario?.nombre ?? '', carrera: usuario?.carrera ?? '' }); setMsg(''); setEditando(true); }
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (form.nombre.trim().length < 2 || form.carrera.trim().length < 2) { setMsg('Completa nombre y carrera.'); return; }
    setGuardando(true);
    try { await api.put('/auth/perfil', form); await refrescar(); setEditando(false); }
    catch (err) { setMsg(err instanceof ApiError ? err.message : 'No se pudo guardar'); }
    finally { setGuardando(false); }
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <h1 className="mb-4 text-2xl font-extrabold text-prexi-navy">Perfil</h1>

      <div className="grid gap-5 lg:grid-cols-[34%_1fr]">
        {/* ── Columna izquierda ── */}
        <div className="space-y-5">
          {/* Tarjeta de identidad */}
          <div className="card card-hover overflow-hidden !p-0 text-center">
            <div className="h-16 bg-gradient-to-r from-prexi-navy to-prexi-blue" />
            <div className="-mt-11 px-4 pb-5">
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-prexi-navy text-2xl font-extrabold text-white shadow">{inicial}</div>
              <p className="mt-2.5 text-lg font-extrabold text-prexi-navy">{usuario?.nombre}</p>
              <p className="text-xs text-slate-500">ID: {idCodigo}</p>
              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-prexi-blue-soft px-3 py-1 text-xs font-semibold text-prexi-navy">
                <Medal className="h-3.5 w-3.5" /> Nivel {nivelActual}{nivelLabel ? ` — ${nivelLabel}` : ''}
              </span>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-500">{usuario?.carrera ?? 'Ingeniería de Sistemas'}<br />Primer semestre</p>

              <div className="mt-3 flex border-t border-slate-200 pt-3 text-center">
                <div className="flex-1"><p className="text-sm font-bold text-prexi-navy"><CountUp value={res?.puntos ?? 0} /></p><p className="text-[11px] text-slate-500">XP</p></div>
                <div className="flex-1 border-l border-slate-200"><p className="flex items-center justify-center gap-1 text-sm font-bold text-prexi-amber"><Flame className="h-3.5 w-3.5" /> {res?.racha_dias ?? 0}</p><p className="text-[11px] text-slate-500">Racha</p></div>
                <div className="flex-1 border-l border-slate-200"><p className="text-sm font-bold text-prexi-navy">{res?.posicion ? `#${res.posicion}` : '—'}</p><p className="text-[11px] text-slate-500">Posición</p></div>
              </div>

              <button onClick={abrir} className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-prexi-navy py-2.5 text-sm font-semibold text-white transition hover:bg-[#16335a] active:scale-[0.98]">
                <Edit className="h-4 w-4" /> Editar perfil
              </button>
            </div>
          </div>

          {/* Tu nivel */}
          <div className="card card-hover">
            <p className="mb-2.5 text-sm font-semibold text-prexi-navy">Tu nivel</p>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-prexi-blue to-blue-400 transition-all duration-700" style={{ width: `${progresoNivel}%` }} /></div>
            <div className="mt-2 flex justify-between text-[11px] text-slate-500">
              <span>Nivel {nivelActual}</span>
              <span className="font-semibold text-prexi-blue">{faltan > 0 ? `${faltan} ejercicio${faltan > 1 ? 's' : ''} para Nivel ${nivelActual + 1}` : '¡Nivel completo!'}</span>
            </div>
          </div>
        </div>

        {/* ── Columna derecha ── */}
        <div className="space-y-5">
          {/* Resumen de actividad */}
          <div className="card card-hover">
            <p className="mb-3 text-sm font-semibold text-prexi-navy">Resumen de actividad</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat icon={<Star className="h-4 w-4" />} tone="text-prexi-blue" label="XP Total"><CountUp value={res?.puntos ?? 0} /></MiniStat>
              <MiniStat icon={<CheckCircle className="h-4 w-4" />} tone="text-prexi-green" label="Ejercicios"><CountUp value={res?.ejercicios.completados ?? 0} />/{res?.ejercicios.total ?? 69}</MiniStat>
              <MiniStat icon={<Flame className="h-4 w-4" />} tone="text-prexi-amber" label="Racha"><CountUp value={res?.racha_dias ?? 0} /> días</MiniStat>
              <MiniStat icon={<Trophy className="h-4 w-4" />} tone="text-prexi-amber" label="Mejor pos.">{res?.posicion ? `#${res.posicion}` : '—'}</MiniStat>
            </div>
          </div>

          {/* Logros e insignias */}
          <div className="card card-hover">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2"><Award className="h-5 w-5 text-prexi-amber" /><p className="text-sm font-semibold text-prexi-navy">Logros e insignias</p></div>
              <p className="text-xs text-slate-500"><b className="font-semibold text-prexi-blue">{desbloqueadas}</b> de {logros.length} desbloqueados</p>
            </div>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-prexi-amber transition-all duration-700" style={{ width: `${logros.length ? (desbloqueadas / logros.length) * 100 : 0}%` }} /></div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4">
              {logros.map((l) => (
                <div key={l.id} title={l.obtenido ? `${l.nombre} — ¡desbloqueado!` : `${l.nombre} — ${l.condicion}`}
                  className={`flex cursor-default flex-col items-center gap-1.5 transition hover:-translate-y-0.5 ${l.obtenido ? '' : 'opacity-40'}`}>
                  <div className={`relative grid h-11 w-11 place-items-center rounded-full text-xl ${l.obtenido ? 'bg-amber-50' : 'bg-slate-100'} ${l.obtenido && (l.clave === 'racha_7' || l.clave === 'sin_pistas') ? 'ring-4 ring-amber-100 animate-pulse-soft' : ''}`}>
                    {l.obtenido ? <span>{l.icono}</span> : <Lock className="h-5 w-5 text-slate-300" />}
                  </div>
                  <span className={`text-center text-[10px] leading-tight ${l.obtenido ? 'text-prexi-navy' : 'text-slate-400'}`}>{l.nombre}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progreso por nivel */}
          <div className="card card-hover">
            <p className="mb-3 text-sm font-semibold text-prexi-navy">Progreso por nivel</p>
            <div className="space-y-3">
              {[...niveles].sort((a, b) => a.numero - b.numero).map((n) => {
                const completo = n.ejercicios_completados >= n.umbral;
                const enProg = n.desbloqueado && !completo;
                const pct = n.umbral ? Math.min(100, Math.round((n.ejercicios_completados / n.umbral) * 100)) : 0;
                const color = completo ? '#16a34a' : enProg ? '#2563eb' : '#94a3b8';
                return (
                  <div key={n.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-prexi-navy">Nivel {n.numero} · {n.titulo}</span>
                      <span className="text-slate-500">{Math.min(n.ejercicios_completados, n.umbral)}/{n.umbral} · <span className="font-semibold" style={{ color }}>{completo ? 'Completado' : enProg ? 'En progreso' : 'Bloqueado'}</span></span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal editar perfil ── */}
      {editando && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={() => setEditando(false)}>
          <div className="w-full max-w-md animate-fade-up overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <p className="font-semibold text-prexi-navy">Editar perfil</p>
              <button onClick={() => setEditando(false)} aria-label="Cerrar" className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={guardar} className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-prexi-navy text-xl font-extrabold text-white">{inicial}</div>
                <p className="text-xs text-slate-500">Tu avatar usa tus iniciales.<br />La carga de foto llegará pronto.</p>
              </div>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-prexi-navy">Nombre completo</span>
                <input className="input" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
              </label>
              <label className="mb-3 block">
                <span className="mb-1 block text-xs font-semibold text-prexi-navy">Correo electrónico</span>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400">{usuario?.email} <Lock className="h-4 w-4" /></div>
                <span className="text-[11px] text-slate-500">El correo no se puede modificar.</span>
              </label>
              <label className="mb-1 block">
                <span className="mb-1 block text-xs font-semibold text-prexi-navy">Carrera</span>
                <select className="input" value={form.carrera} onChange={(e) => setForm((f) => ({ ...f, carrera: e.target.value }))}>
                  <option value="">Selecciona…</option>
                  {CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              {msg && <p className="mt-2 text-sm text-red-500">{msg}</p>}
              <div className="mt-5 flex gap-2.5">
                <button type="button" onClick={() => setEditando(false)} className="btn-ghost flex-1">Cancelar</button>
                <button className="flex-1 rounded-xl bg-prexi-navy py-2.5 font-semibold text-white transition hover:bg-[#16335a] active:scale-[0.98] disabled:opacity-60" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon, tone, label, children }: { icon: React.ReactNode; tone: string; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5">
      <div className={tone}>{icon}</div>
      <p className="mt-1 text-base font-bold text-prexi-navy">{children}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
