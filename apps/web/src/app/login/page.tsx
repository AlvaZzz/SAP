'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { ApiError } from '@/lib/api';
import { Marca } from '@/components/marca';
import { Eye, EyeOff, AlertCircle } from '@/components/icons';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('juan@upea.edu.bo');
  const [password, setPassword] = useState('Prexi123*');
  const [verPass, setVerPass] = useState(false);
  const [tocado, setTocado] = useState<{ email?: boolean; password?: boolean }>({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailError = !email ? 'Ingresa tu correo.' : !emailValido ? 'Formato de correo inválido.' : '';
  const passError = !password ? 'Ingresa tu contraseña.' : '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTocado({ email: true, password: true });
    if (emailError || passError) return;
    setError('');
    setCargando(true);
    try {
      const u = await login(email, password);
      if (u.rol === 'estudiante' && !u.pretestCompletado) router.replace('/pretest');
      else router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
      setCargando(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <Marca />
      <div className="grid place-items-center p-6">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm animate-fade-up">
          <h2 className="mb-1 text-2xl font-bold text-prexi-navy">Bienvenido de nuevo</h2>
          <p className="mb-6 text-sm text-slate-500">Ingresa para continuar tu ruta de aprendizaje.</p>

          {error && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Correo electrónico</span>
            <input type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, email: true }))}
              className={inputCls(!!tocado.email && !!emailError)} placeholder="tucorreo@gmail.com" />
            {tocado.email && emailError && <span className="mt-1 block text-xs text-red-500">{emailError}</span>}
          </label>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Contraseña</span>
            <div className="relative">
              <input type={verPass ? 'text' : 'password'} autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, password: true }))}
                className={inputCls(!!tocado.password && !!passError) + ' pr-11'} />
              <button type="button" onClick={() => setVerPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {verPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {tocado.password && passError && <span className="mt-1 block text-xs text-red-500">{passError}</span>}
          </label>

          <button className="btn-primary mt-2 w-full" disabled={cargando}>
            {cargando ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Ingresando…</> : 'Ingresar'}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            ¿No tienes cuenta? <Link href="/registro" className="font-semibold text-prexi-blue hover:underline">Regístrate</Link>
          </p>
          <p className="mt-6 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
            Demo: juan@upea.edu.bo · docente@upea.edu.bo · admin@upea.edu.bo — clave Prexi123*
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
