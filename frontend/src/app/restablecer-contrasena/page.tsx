'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Marca } from '@/components/marca';
import { Eye, EyeOff, AlertCircle, CheckCircle, Lock, ShieldCheck } from '@/components/icons';

/** Fuerza de la contraseña: 0 (vacía) … 4 (muy fuerte). Heurística simple. */
function fuerza(pass: string): number {
  let s = 0;
  if (pass.length >= 6) s++;
  if (pass.length >= 10) s++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) s++;
  if (/\d/.test(pass) && /[^A-Za-z0-9]/.test(pass)) s++;
  return Math.min(s, 4);
}
const NIVEL = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'];
const COLOR = ['bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-lime-500', 'bg-prexi-green'];

function Restablecer() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [estado, setEstado] = useState<'validando' | 'valido' | 'invalido' | 'listo'>('validando');
  const [pass, setPass] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [tocado, setTocado] = useState<{ pass?: boolean; confirmar?: boolean }>({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  // Al cargar, validar el token con el backend (válido, no expirado, no usado).
  useEffect(() => {
    if (!token) { setEstado('invalido'); return; }
    api.get<{ valido: boolean }>(`/auth/recuperar/validar?token=${encodeURIComponent(token)}`)
      .then((r) => setEstado(r.valido ? 'valido' : 'invalido'))
      .catch(() => setEstado('invalido'));
  }, [token]);

  const nivel = fuerza(pass);
  const passError = !pass ? 'Ingresa una contraseña.' : pass.length < 6 ? 'Mínimo 6 caracteres.' : '';
  const confirmarError = !confirmar ? 'Confirma la contraseña.' : confirmar !== pass ? 'Las contraseñas no coinciden.' : '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTocado({ pass: true, confirmar: true });
    if (passError || confirmarError) return;
    setError('');
    setCargando(true);
    try {
      await api.post('/auth/restablecer', { token, nueva: pass });
      setEstado('listo');
      setTimeout(() => router.replace('/login'), 2500);
    } catch (err) {
      // Token pudo expirar entre la validación y el envío.
      setError(err instanceof ApiError ? err.message : 'No se pudo restablecer la contraseña.');
      if (err instanceof ApiError && err.status === 400) setEstado('invalido');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <Marca />
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          {estado === 'validando' && (
            <div className="text-center text-slate-500">
              <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-prexi-blue" />
              Validando el enlace…
            </div>
          )}

          {estado === 'invalido' && (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-500">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-prexi-navy">Enlace no válido</h2>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
                Este enlace es incorrecto, ya se usó o expiró. Solicita uno nuevo para continuar.
              </p>
              <Link href="/recuperar-contrasena" className="btn-primary w-full">Solicitar un nuevo enlace</Link>
            </div>
          )}

          {estado === 'listo' && (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-prexi-green">
                <CheckCircle className="h-7 w-7" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-prexi-navy">¡Contraseña actualizada!</h2>
              <p className="mb-6 text-sm text-slate-500">Te llevamos al inicio de sesión…</p>
              <Link href="/login" className="btn-primary w-full">Ir a iniciar sesión</Link>
            </div>
          )}

          {estado === 'valido' && (
            <form onSubmit={onSubmit} noValidate>
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-prexi-blue-deep">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h2 className="mb-1 text-center text-2xl font-bold text-prexi-navy">Crea una nueva contraseña</h2>
              <p className="mb-6 text-center text-sm text-slate-500">Elige una contraseña segura que recuerdes.</p>

              {error && (
                <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <label className="mb-2 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Nueva contraseña</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={verPass ? 'text' : 'password'} autoComplete="new-password" value={pass}
                    onChange={(e) => setPass(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, pass: true }))}
                    className={inputCls(!!tocado.pass && !!passError) + ' pl-10 pr-11'} placeholder="Mínimo 6 caracteres"
                  />
                  <button type="button" onClick={() => setVerPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {verPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {tocado.pass && passError && <span className="mt-1 block text-xs text-red-500">{passError}</span>}
              </label>

              {/* Barra de fuerza de la contraseña */}
              {pass && (
                <div className="mb-4">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < nivel ? COLOR[nivel] : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500">Seguridad: <span className="text-slate-700">{NIVEL[nivel]}</span></p>
                </div>
              )}

              <label className="mb-4 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Confirmar contraseña</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={verPass ? 'text' : 'password'} autoComplete="new-password" value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, confirmar: true }))}
                    className={inputCls(!!tocado.confirmar && !!confirmarError) + ' pl-10'} placeholder="Repite la contraseña"
                  />
                </div>
                {tocado.confirmar && confirmarError && <span className="mt-1 block text-xs text-red-500">{confirmarError}</span>}
              </label>

              <button className="btn-primary mt-2 w-full" disabled={cargando}>
                {cargando
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Guardando…</>
                  : 'Restablecer contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RestablecerContrasenaPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-slate-500">Cargando…</div>}>
      <Restablecer />
    </Suspense>
  );
}

function inputCls(error: boolean) {
  return `w-full rounded-xl border px-4 py-2.5 outline-none transition focus:ring-2 ${
    error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-prexi-blue focus:ring-blue-100'
  }`;
}
