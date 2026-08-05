'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, GraduationCap, Clock } from '@/components/icons';
import { PrexiLogo } from './prexi-logo';
import { useLogin } from './use-login';
import { loginSchema, validarLogin, type LoginErrores } from '@/lib/validation';

const RECUERDO_KEY = 'prexi_login_email';

/** Botón primario con efecto ripple (Framer Motion) + estado de carga. */
function BotonIngresar({ loading, bloqueado }: { loading: boolean; bloqueado?: boolean }) {
  const [ondas, setOndas] = useState<{ id: number; x: number; y: number }[]>([]);
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setOndas((o) => [...o, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setOndas((o) => o.filter((w) => w.id !== id)), 620);
  };
  return (
    <button type="submit" disabled={loading || bloqueado} aria-busy={loading} onPointerDown={onDown}
      className="btn-primary relative h-[58px] w-full overflow-hidden rounded-2xl text-base">
      {ondas.map((w) => (
        <motion.span key={w.id} initial={{ scale: 0, opacity: 0.5 }} animate={{ scale: 4, opacity: 0 }} transition={{ duration: 0.6 }}
          className="pointer-events-none absolute h-24 w-24 rounded-full bg-white/40"
          style={{ left: w.x - 48, top: w.y - 48 }} />
      ))}
      {loading
        ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Ingresando…</>
        : <>Ingresar <ArrowRight className="hidden h-5 w-5 lg:inline" /></>}
    </button>
  );
}

export function LoginForm() {
  const { login, isLoading, error, bloqueoSeg } = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPass, setVerPass] = useState(false);
  const [recordar, setRecordar] = useState(true);
  const [tocado, setTocado] = useState<{ email?: boolean; password?: boolean }>({});
  const [errores, setErrores] = useState<LoginErrores>({});
  // "Tu sesión expiró": llega por ?motivo=expirada (lo pone Shell al redirigir
  // tras un refresh silencioso fallido). Se lee del URL directamente (sin
  // useSearchParams) para no exigir un límite de Suspense en esta página.
  const [sesionExpirada, setSesionExpirada] = useState(false);

  // "Recordarme" NO persiste nada en el navegador (ni correo ni contraseña ni
  // tokens): solo alarga la vida del refresh token en el backend. Se limpia el
  // valor que versiones anteriores hubieran dejado guardado.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(RECUERDO_KEY); } catch { /* sin acceso a storage */ }
    if (new URLSearchParams(window.location.search).get('motivo') === 'expirada') {
      setSesionExpirada(true);
      // Limpia el parámetro para que un refresh de la página no repita el aviso.
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const emailValido = loginSchema.shape.email.safeParse(email).success;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTocado({ email: true, password: true });
    const errs = validarLogin({ email, password });
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;
    await login(email, password, recordar);
  }

  // Revalida en vivo el campo tocado (mensaje bajo cada input).
  const revalidar = () => setErrores(validarLogin({ email, password }));

  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  // El padding interno baja en laptop: con la escala del root al 135%, `p-12`
  // computa 64.8px por lado y dejaba los inputs en 284px dentro de una card de
  // 416px. El aire lo da el espacio entre bloques, no el marco.
  return (
    <motion.form
      onSubmit={onSubmit} noValidate
      initial="hidden" animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}
      className="w-full max-w-[440px] rounded-3xl border border-prexi-blue/35 bg-card/85 p-8 pt-20 shadow-lift backdrop-blur-xl supports-[backdrop-filter]:bg-[#07142b]/85 lg:max-w-none lg:min-h-[720px] lg:p-8 xl:p-10 2xl:p-12">

      <motion.div variants={item} className="mb-6 flex justify-center">
        <div className="lg:hidden"><PrexiLogo /></div>
        <div className="hidden h-[70px] w-[70px] place-items-center rounded-[22px] bg-prexi-blue text-accent-on shadow-glow lg:grid"><GraduationCap className="h-9 w-9" /></div>
      </motion.div>

      {/* Móvil lleva signos de admiración (¡…!); desktop va sin ellos (según la referencia). */}
      <motion.h2 variants={item} className="text-center font-display text-2xl font-extrabold text-fg lg:text-3xl">
        <span className="lg:hidden">¡</span>Bienvenido a PRE<span style={{ backgroundImage: 'linear-gradient(90deg,#4A90E2,#8FBEF0)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>XI</span><span className="lg:hidden">!</span>
      </motion.h2>
      <motion.p variants={item} className="mb-6 mt-1 text-center text-sm text-muted">
        Inicia sesión para continuar tu aprendizaje personalizado.
      </motion.p>

      {/* Aviso NEUTRO (no es un error): había sesión y venció, distinto de un
          visitante que simplemente aún no inició sesión. */}
      {!error && sesionExpirada && (
        <motion.p variants={item} role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-prexi-blue/30 bg-prexi-blue/10 px-3 py-2.5 text-sm font-medium text-prexi-blue-deep">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" /> Tu sesión expiró. Ingresa nuevamente.
        </motion.p>
      )}

      {error && (
        <motion.p variants={item} role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-500">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </motion.p>
      )}

      {/* Correo electrónico — cualquier dominio (es el canal de contacto). */}
      <motion.label variants={item} className="mb-4 block">
        <span className="mb-1.5 block text-sm font-medium text-fg">Correo electrónico</span>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input type="email" autoComplete="email" inputMode="email" value={email}
            onChange={(e) => { setEmail(e.target.value); if (tocado.email) revalidar(); }}
            onBlur={() => { setTocado((t) => ({ ...t, email: true })); revalidar(); }}
            aria-invalid={!!tocado.email && !!errores.email} aria-label="Correo electrónico"
            className={campo(!!tocado.email && !!errores.email) + ' pr-12'} placeholder="tucorreo@ejemplo.com" />
          {emailValido && <CheckCircle className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-prexi-green" aria-label="Correo válido" />}
        </div>
        {tocado.email && errores.email
          ? <span className="mt-1 block text-xs font-medium text-red-500">{errores.email}</span>
          : <span className="mt-1 block text-xs text-muted">Usaremos este correo para contactarte.</span>}
      </motion.label>

      {/* Contraseña */}
      <motion.label variants={item} className="mb-4 block">
        <span className="mb-1.5 block text-sm font-medium text-fg">Contraseña</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input type={verPass ? 'text' : 'password'} autoComplete="current-password" value={password}
            onChange={(e) => { setPassword(e.target.value); if (tocado.password) revalidar(); }}
            onBlur={() => { setTocado((t) => ({ ...t, password: true })); revalidar(); }}
            aria-invalid={!!tocado.password && !!errores.password} aria-label="Contraseña"
            className={campo(!!tocado.password && !!errores.password)} placeholder="••••••••" />
          <button type="button" onClick={() => setVerPass((v) => !v)}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-fg"
            aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            {verPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {tocado.password && errores.password && <span className="mt-1 block text-xs font-medium text-red-500">{errores.password}</span>}
      </motion.label>

      {/* Recordarme + olvidaste */}
      <motion.div variants={item} className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-prexi-blue focus:ring-prexi-blue" />
          Recordarme
        </label>
        <Link href="/recuperar-contrasena" className="text-sm font-semibold text-prexi-blue-deep hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </motion.div>

      <motion.div variants={item}><BotonIngresar loading={isLoading} bloqueado={bloqueoSeg > 0} /></motion.div>

      <motion.p variants={item} className="mt-8 border-t border-line/70 pt-6 text-center text-sm text-muted">
        ¿No tienes cuenta? <Link href="/registro" className="font-semibold text-prexi-blue-deep hover:underline">Regístrate</Link>
      </motion.p>
    </motion.form>
  );
}

/** Input 58px translúcido con glow de acento en hover/focus (tokens del sistema). */
function campo(error: boolean) {
  return `h-[58px] w-full rounded-2xl border bg-app/70 pl-12 pr-12 text-fg outline-none transition placeholder:text-muted
    hover:border-prexi-blue/50 hover:shadow-[0_0_0_3px_rgb(var(--accent)/0.10)]
    focus:ring-2 ${error
      ? 'border-red-400 focus:border-red-400 focus:ring-red-500/25'
      : 'border-line focus:border-prexi-blue focus:ring-prexi-blue/25'}`;
}
