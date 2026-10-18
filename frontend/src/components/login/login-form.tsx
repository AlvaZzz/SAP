'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  GraduationCap,
  Clock,
  User,
  UserPlus,
  Briefcase,
} from '@/components/icons';
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
    <button
      type="submit"
      disabled={loading || bloqueado}
      aria-busy={loading}
      onPointerDown={onDown}
      className="btn-primary relative h-[54px] w-full overflow-hidden rounded-2xl text-base sm:h-[58px]"
    >
      {ondas.map((w) => (
        <motion.span
          key={w.id}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none absolute h-24 w-24 rounded-full bg-white/40"
          style={{ left: w.x - 48, top: w.y - 48 }}
        />
      ))}
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{' '}
          Ingresando…
        </>
      ) : (
        <>
          Ingresar <ArrowRight className="hidden h-5 w-5 lg:inline" />
        </>
      )}
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
  // Quién entra: solo cambia la ayuda y el ejemplo del primer campo.
  const [perfil, setPerfil] = useState<'estudiante' | 'docente'>('estudiante');
  const esEstudiante = perfil === 'estudiante';
  // "Tu sesión expiró": llega por ?motivo=expirada (lo pone Shell al redirigir
  // tras un refresh silencioso fallido). Se lee del URL directamente (sin
  // useSearchParams) para no exigir un límite de Suspense en esta página.
  const [sesionExpirada, setSesionExpirada] = useState(false);

  // "Recordarme" NO persiste nada en el navegador (ni correo ni contraseña ni
  // tokens): solo alarga la vida del refresh token en el backend. Se limpia el
  // valor que versiones anteriores hubieran dejado guardado.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(RECUERDO_KEY);
    } catch {
      /* sin acceso a storage */
    }
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
      onSubmit={onSubmit}
      noValidate
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }}
      className="w-full max-w-[440px] rounded-3xl border border-prexi-blue/35 bg-card/85 p-6 pt-16 shadow-lift backdrop-blur-xl supports-[backdrop-filter]:bg-[#07142b]/85 sm:p-8 sm:pt-20 lg:max-w-[560px] lg:p-9 lg:pt-10 xl:max-w-[600px] xl:p-10"
    >
      <motion.div variants={item} className="mb-5 flex justify-center sm:mb-6">
        <div className="lg:hidden">
          <PrexiLogo />
        </div>
        <div className="hidden h-[70px] w-[70px] place-items-center rounded-[22px] bg-prexi-blue text-accent-on shadow-glow lg:grid">
          <GraduationCap className="h-9 w-9" />
        </div>
      </motion.div>

      {/* Móvil lleva signos de admiración (¡…!); desktop va sin ellos (según la referencia). */}
      <motion.h2 variants={item} className="text-center font-display text-2xl font-extrabold leading-tight text-fg lg:text-3xl">
        <span className="lg:hidden">¡</span>Bienvenido a PRE
        <span
          style={{
            backgroundImage: 'linear-gradient(90deg,#4A90E2,#8FBEF0)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          XI
        </span>
        <span className="lg:hidden">!</span>
      </motion.h2>
      <motion.p variants={item} className="mb-5 mt-1.5 text-center text-sm leading-relaxed text-muted sm:mb-6">
        Inicia sesión para continuar tu aprendizaje personalizado.
      </motion.p>

      {/* Aviso NEUTRO (no es un error): había sesión y venció, distinto de un
          visitante que simplemente aún no inició sesión. */}
      {!error && sesionExpirada && (
        <motion.p
          variants={item}
          role="status"
          className="mb-4 flex items-start gap-2 rounded-xl border border-prexi-blue/30 bg-prexi-blue/10 px-3 py-2.5 text-sm font-medium text-prexi-blue-deep"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0" /> Tu sesión expiró. Ingresa nuevamente.
        </motion.p>
      )}

      {error && (
        <motion.p
          variants={item}
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-500"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </motion.p>
      )}

      {/* ¿Quién entra? Cambia solo la ayuda y el ejemplo: el backend acepta usuario o correo en ambos casos. */}
      <motion.div variants={item} role="tablist" aria-label="¿Quién eres?" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-app/60 p-1">
        {([['estudiante', 'Estudiante', GraduationCap], ['docente', 'Docente', Briefcase]] as const).map(([clave, texto, Icono]) => (
          <button key={clave} type="button" role="tab" aria-selected={perfil === clave}
            onClick={() => { setPerfil(clave); setErrores({}); setTocado({}); }}
            className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-2 py-2.5 text-sm font-semibold transition ${perfil === clave ? 'bg-prexi-blue text-accent-on shadow-soft' : 'text-muted hover:bg-subtle hover:text-fg'}`}>
            <Icono className="h-4 w-4 shrink-0" /> {texto}
          </button>
        ))}
      </motion.div>

      {/* Usuario (PrimerNombre_CI) o correo: los estudiantes entran con su usuario; docentes y admin, con su correo. */}
      <motion.label variants={item} className="mb-4 block sm:mb-5">
        <span className="mb-1.5 block text-sm font-medium text-fg">{esEstudiante ? 'Tu usuario' : 'Correo electrónico'}</span>
        <div className="relative">
          {esEstudiante
            ? <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            : <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />}
          <input
            type="text"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (tocado.email) revalidar();
            }}
            onBlur={() => {
              setTocado((t) => ({ ...t, email: true }));
              revalidar();
            }}
            aria-invalid={!!tocado.email && !!errores.email}
            aria-label={esEstudiante ? 'Tu usuario' : 'Correo electrónico'}
            autoCapitalize="none"
            spellCheck={false}
            className={campo(!!tocado.email && !!errores.email) + ' pr-12'}
            placeholder={esEstudiante ? 'Alvaro_12929098' : 'docente@upea.edu.bo'}
          />
          {emailValido && (
            <CheckCircle
              className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-prexi-green"
              aria-label="Dato válido"
            />
          )}
        </div>
        {tocado.email && errores.email ? (
          <span className="mt-1 block text-xs font-medium text-red-500">{errores.email}</span>
        ) : esEstudiante ? (
          // Cómo se arma el usuario, a la vista y con un ejemplo.
          <span className="mt-2 block rounded-xl border border-prexi-blue/25 bg-prexi-blue/10 px-3 py-2 text-xs leading-relaxed text-muted">
            Tu usuario es <b className="text-fg">tu primer nombre</b>, un guion bajo <b className="text-fg">_</b> y <b className="text-fg">tu CI</b>.
            <span className="mt-0.5 block">Ejemplo: Álvaro, CI 12929098 → <b className="font-mono text-fg">Alvaro_12929098</b></span>
          </span>
        ) : (
          <span className="mt-1 block text-xs text-muted">El correo con el que te dio de alta el administrador.</span>
        )}
      </motion.label>

      {/* Contraseña */}
      <motion.label variants={item} className="mb-4 block sm:mb-5">
        <span className="mb-1.5 block text-sm font-medium text-fg">Contraseña</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            type={verPass ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (tocado.password) revalidar();
            }}
            onBlur={() => {
              setTocado((t) => ({ ...t, password: true }));
              revalidar();
            }}
            aria-invalid={!!tocado.password && !!errores.password}
            aria-label="Contraseña"
            className={campo(!!tocado.password && !!errores.password)}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setVerPass((v) => !v)}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-fg"
            aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {verPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {tocado.password && errores.password ? (
          <span className="mt-1 block text-xs font-medium text-red-500">{errores.password}</span>
        ) : esEstudiante ? (
          <span className="mt-1 block text-xs text-muted">La primera vez es tu <b className="text-fg">CI</b>; luego, la que tú elijas.</span>
        ) : null}
      </motion.label>

      {/* Recordarme + olvidaste */}
      <motion.div variants={item} className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-2">
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={recordar}
            onChange={(e) => setRecordar(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-prexi-blue focus:ring-prexi-blue"
          />
          Recordarme
        </label>
        <Link href="/recuperar-contrasena" className="text-sm font-semibold text-prexi-blue-deep hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </motion.div>

      <motion.div variants={item}>
        <BotonIngresar loading={isLoading} bloqueado={bloqueoSeg > 0} />
      </motion.div>

      {/* Crear cuenta: solo para estudiantes que su docente aún no registró. */}
      {esEstudiante && (
        <motion.div variants={item} className="mt-6 border-t border-line/70 pt-5 sm:mt-7 sm:pt-6">
          <p className="mb-2.5 text-center text-sm text-muted">¿Es tu primera vez y tu docente aún no te registró?</p>
          <Link href="/registro" className="btn-ghost h-12 w-full justify-center rounded-2xl text-base">
            <UserPlus className="h-5 w-5" /> Crear mi cuenta de estudiante
          </Link>
        </motion.div>
      )}
    </motion.form>
  );
}

/** Input 58px translúcido con glow de acento en hover/focus (tokens del sistema). */
function campo(error: boolean) {
  return `h-[52px] w-full rounded-2xl border bg-app/70 pl-12 pr-12 text-base text-fg outline-none transition placeholder:text-muted sm:h-[56px] lg:h-[58px]
    hover:border-prexi-blue/50 hover:shadow-[0_0_0_3px_rgb(var(--accent)/0.10)]
    focus:ring-2 ${
      error
        ? 'border-red-400 focus:border-red-400 focus:ring-red-500/25'
        : 'border-line focus:border-prexi-blue focus:ring-prexi-blue/25'
    }`;
}
