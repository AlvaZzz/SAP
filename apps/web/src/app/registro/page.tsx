'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { ApiError } from '@/lib/api';
import { Marca } from '@/components/marca';
import { Eye, EyeOff, AlertCircle } from '@/components/icons';

const CARRERAS = [
  'Ingeniería de Sistemas', 'Ingeniería de Software', 'Ingeniería Informática',
  'Ingeniería Electrónica', 'Ingeniería Industrial', 'Otra',
];

function fuerza(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[0-9]/.test(p) && /[a-zA-Z]/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  const score = Math.min(3, s);
  const labels = ['Muy débil', 'Débil', 'Media', 'Fuerte'];
  const colors = ['#ef4444', '#ef4444', '#f59e0b', '#16a34a'];
  return { score, label: labels[score], color: colors[score] };
}

export default function RegistroPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ nombre: '', email: '', cedula: '', carrera: '', password: '' });
  const [rol, setRol] = useState('estudiante');
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [tocado, setTocado] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const fz = fuerza(f.password);
  const errores = {
    nombre: f.nombre.trim().length < 2 ? 'Ingresa tu nombre completo.' : '',
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) ? 'Correo inválido.' : '',
    cedula: f.cedula.trim().length < 4 ? 'Cédula inválida.' : '',
    carrera: !f.carrera ? 'Selecciona tu carrera.' : '',
    password: f.password.length < 6 ? 'Mínimo 6 caracteres.' : '',
  };
  const formOk = Object.values(errores).every((e) => !e);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTocado(true);
    if (!formOk) return;
    setError('');
    setCargando(true);
    try {
      const u = await register({ nombre: f.nombre, email: f.email, password: f.password, cedula: f.cedula, carrera: f.carrera });
      router.replace(u.pretestCompletado ? '/dashboard' : '/pretest');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
      setCargando(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <Marca />
      <div className="grid place-items-center overflow-y-auto p-6">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm animate-fade-up py-6">
          <h2 className="mb-1 text-2xl font-bold text-prexi-navy">Crea tu cuenta</h2>
          <p className="mb-5 text-sm text-slate-500">Empieza tu ruta como estudiante.</p>

          {error && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <div className="mb-4">
            <span className="mb-1 block text-sm font-medium text-slate-700">Tipo de cuenta</span>
            <div className="grid grid-cols-3 gap-2">
              {['estudiante', 'docente', 'admin'].map((r) => {
                const dis = r !== 'estudiante';
                return (
                  <button key={r} type="button" disabled={dis} onClick={() => setRol(r)}
                    title={dis ? 'Contacta al administrador' : undefined}
                    className={`rounded-xl border px-2 py-2 text-sm font-medium capitalize transition ${
                      rol === r ? 'border-prexi-blue bg-blue-50 text-prexi-blue'
                      : dis ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    {r}
                  </button>
                );
              })}
            </div>
            <span className="mt-1 block text-xs text-slate-400">Docente/Admin se crean desde el panel de administración.</span>
          </div>

          <Campo label="Nombre completo" error={tocado ? errores.nombre : ''}>
            <input value={f.nombre} onChange={set('nombre')} className={inputCls(tocado && !!errores.nombre)} />
          </Campo>
          <Campo label="Correo electrónico" error={tocado ? errores.email : ''}>
            <input type="email" value={f.email} onChange={set('email')} placeholder="tucorreo@gmail.com" className={inputCls(tocado && !!errores.email)} />
          </Campo>
          <Campo label="Cédula de identidad" error={tocado ? errores.cedula : ''}>
            <input value={f.cedula} onChange={set('cedula')} className={inputCls(tocado && !!errores.cedula)} />
          </Campo>
          <Campo label="Carrera" error={tocado ? errores.carrera : ''}>
            <select value={f.carrera} onChange={set('carrera')} className={inputCls(tocado && !!errores.carrera)}>
              <option value="">Selecciona…</option>
              {CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>

          <Campo label="Contraseña" error={tocado ? errores.password : ''}>
            <div className="relative">
              <input type={verPass ? 'text' : 'password'} value={f.password} onChange={set('password')}
                className={inputCls(tocado && !!errores.password) + ' pr-11'} />
              <button type="button" onClick={() => setVerPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {verPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {f.password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => <div key={i} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i < fz.score ? fz.color : '#e2e8f0' }} />)}
                </div>
                <span className="mt-1 block text-xs" style={{ color: fz.color }}>Seguridad: {fz.label}</span>
              </div>
            )}
          </Campo>

          <button className="btn-primary mt-2 w-full" disabled={cargando}>
            {cargando ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Creando…</> : 'Registrarme'}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-prexi-blue hover:underline">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function inputCls(error: boolean) {
  return `w-full rounded-xl border px-4 py-2.5 outline-none transition focus:ring-2 ${
    error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-prexi-blue focus:ring-blue-100'
  }`;
}
function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  );
}
