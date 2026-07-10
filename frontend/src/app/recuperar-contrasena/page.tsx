'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Marca } from '@/components/marca';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from '@/components/icons';

/**
 * Paso 1 de la recuperación: el usuario ingresa su correo institucional.
 * Por privacidad, la respuesta es SIEMPRE genérica (el backend nunca revela si
 * el correo está registrado). Disponible para todos los roles.
 */
export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState('');
  const [tocado, setTocado] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailError = !email ? 'Ingresa tu correo.' : !emailValido ? 'Formato de correo inválido.' : '';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTocado(true);
    if (emailError) return;
    setError('');
    setCargando(true);
    try {
      await api.post('/auth/recuperar', { email });
      setEnviado(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo procesar la solicitud. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <Marca />
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          {enviado ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-prexi-green">
                <CheckCircle className="h-7 w-7" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-prexi-navy">Revisa tu correo</h2>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
                Si <span className="font-semibold text-slate-700">{email}</span> está registrado, te enviamos
                un enlace para restablecer tu contraseña. El enlace expira en 45 minutos.
              </p>
              <Link href="/login" className="btn-primary w-full">Volver a iniciar sesión</Link>
              <button
                onClick={() => { setEnviado(false); setEmail(''); setTocado(false); }}
                className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Usar otro correo
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-prexi-blue-deep">
                <Mail className="h-7 w-7" />
              </div>
              <h2 className="mb-1 text-center text-2xl font-bold text-prexi-navy">¿Olvidaste tu contraseña?</h2>
              <p className="mb-6 text-center text-sm text-slate-500">
                Ingresa tu correo y te enviaremos un enlace para crear una nueva.
              </p>

              {error && (
                <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </p>
              )}

              <label className="mb-4 block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Correo electrónico</span>
                <input
                  type="email" autoComplete="email" value={email}
                  onChange={(e) => setEmail(e.target.value)} onBlur={() => setTocado(true)}
                  className={inputCls(tocado && !!emailError)} placeholder="tucorreo@gmail.com"
                />
                {tocado && emailError && <span className="mt-1 block text-xs text-red-500">{emailError}</span>}
              </label>

              <button className="btn-primary mt-2 w-full" disabled={cargando}>
                {cargando
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Enviando…</>
                  : 'Enviar enlace de recuperación'}
              </button>

              <Link href="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
                <ArrowLeft className="h-4 w-4" /> Volver a iniciar sesión
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function inputCls(error: boolean) {
  return `w-full rounded-xl border px-4 py-2.5 outline-none transition focus:ring-2 ${
    error ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-prexi-blue focus:ring-blue-100'
  }`;
}
