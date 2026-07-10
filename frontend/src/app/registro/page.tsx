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
  const colors = ['#B04A44', '#B04A44', '#B5822E', '#2E7D5B'];
  return { score, label: labels[score], color: colors[score] };
}

export default function RegistroPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ nombre: '', email: '', cedula: '', carrera: '', paralelo: '', password: '' });
  const [rol, setRol] = useState('estudiante');
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [tocado, setTocado] = useState<Partial<Record<keyof typeof f, boolean>>>({});

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const toca = (k: keyof typeof f) => () => setTocado((t) => ({ ...t, [k]: true }));

  const fz = fuerza(f.password);
  const errores = {
    nombre: f.nombre.trim().length < 2 ? 'Ingresa tu nombre y apellidos.' : '',
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) ? 'Escribe un correo válido, por ejemplo nombre@gmail.com.' : '',
    cedula: !/^\d{4,12}$/.test(f.cedula.trim()) ? 'Escribe solo los números de tu cédula (4 a 12 dígitos).' : '',
    carrera: !f.carrera ? 'Selecciona tu carrera de la lista.' : '',
    paralelo: !/^[A-Za-z0-9]{1,10}$/.test(f.paralelo.trim()) ? 'Escribe tu paralelo, por ejemplo A, B o C.' : '',
    password: f.password.length < 6 ? 'La contraseña debe tener al menos 6 caracteres.' : '',
  };
  const formOk = Object.values(errores).every((e) => !e);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTocado({ nombre: true, email: true, cedula: true, carrera: true, paralelo: true, password: true });
    if (cargando) return; // bloqueo de doble envío
    if (!formOk) return;
    setError('');
    setCargando(true);
    try {
      const u = await register({ nombre: f.nombre, email: f.email, password: f.password, cedula: f.cedula, carrera: f.carrera, paralelo: f.paralelo.trim().toUpperCase() });
      router.replace(!u.introduccionCompletada ? '/introduccion' : !u.pretestCompletado ? '/pretest' : '/dashboard');
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
                      rol === r ? 'border-prexi-blue bg-blue-50 text-prexi-blue-deep'
                      : dis ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    {r}
                  </button>
                );
              })}
            </div>
            <span className="mt-1 block text-xs text-slate-400">Docente/Admin se crean desde el panel de administración.</span>
          </div>

          <Campo label="Nombre completo" ayuda="Como figura en tu documento; se mostrará en el ranking." error={tocado.nombre ? errores.nombre : ''}>
            <input value={f.nombre} onChange={set('nombre')} onBlur={toca('nombre')} autoComplete="name"
              placeholder="Ej.: Ana Quispe Mamani" className={inputCls(!!tocado.nombre && !!errores.nombre)} />
          </Campo>
          <Campo label="Correo electrónico" ayuda="Lo usarás para iniciar sesión." error={tocado.email ? errores.email : ''}>
            <input type="email" value={f.email} onChange={set('email')} onBlur={toca('email')} autoComplete="email"
              placeholder="Ej.: ana.quispe@gmail.com" className={inputCls(!!tocado.email && !!errores.email)} />
          </Campo>
          <Campo label="Cédula de identidad" ayuda="Solo números, sin extensión ni puntos." error={tocado.cedula ? errores.cedula : ''}>
            <input value={f.cedula} onChange={set('cedula')} onBlur={toca('cedula')} inputMode="numeric"
              placeholder="Ej.: 9876543" className={inputCls(!!tocado.cedula && !!errores.cedula)} />
          </Campo>
          <Campo label="Carrera" error={tocado.carrera ? errores.carrera : ''}>
            <select value={f.carrera} onChange={set('carrera')} onBlur={toca('carrera')} className={inputCls(!!tocado.carrera && !!errores.carrera)}>
              <option value="">Selecciona tu carrera…</option>
              {CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo label="Paralelo" ayuda="El paralelo en el que cursas la materia (ej.: A, B, C)." error={tocado.paralelo ? errores.paralelo : ''}>
            <input value={f.paralelo} onChange={set('paralelo')} onBlur={toca('paralelo')} maxLength={10}
              placeholder="Ej.: A" className={inputCls(!!tocado.paralelo && !!errores.paralelo)} />
          </Campo>

          <Campo label="Contraseña" ayuda="Mínimo 6 caracteres; combina letras, números y símbolos para mayor seguridad." error={tocado.password ? errores.password : ''}>
            <div className="relative">
              <input type={verPass ? 'text' : 'password'} value={f.password} onChange={set('password')} onBlur={toca('password')}
                autoComplete="new-password" placeholder="Mínimo 6 caracteres"
                className={inputCls(!!tocado.password && !!errores.password) + ' pr-11'} />
              <button type="button" onClick={() => setVerPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {verPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {f.password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => <div key={i} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: i < fz.score ? fz.color : '#E3E8EF' }} />)}
                </div>
                <span className="mt-1 block text-xs" style={{ color: fz.color }}>Seguridad: {fz.label}</span>
              </div>
            )}
          </Campo>

          <button className="btn-primary mt-2 w-full" disabled={cargando}>
            {cargando ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Creando…</> : 'Registrarme'}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-prexi-blue-deep hover:underline">Inicia sesión</Link>
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
function Campo({ label, ayuda, error, children }: { label: string; ayuda?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error
        ? <span className="mt-1 block text-xs text-red-500">{error}</span>
        : ayuda && <span className="mt-1 block text-xs text-slate-400">{ayuda}</span>}
    </label>
  );
}
