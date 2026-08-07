'use client';

import { FormEvent, ReactNode, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/providers/auth-provider';
import { ApiError } from '@/lib/api';
import { LoginHero } from '@/components/login/login-hero';
import { PrexiLogo } from '@/components/login/prexi-logo';
import { inputAuthCls } from '@/components/fondo-auth';
import {
  User, Mail, Lock, KeyRound, ShieldCheck, GraduationCap, Users,
  Eye, EyeOff, AlertCircle, CheckCircle,
} from '@/components/icons';

/**
 * PANTALLA DE REGISTRO (módulo auth) — PÁGINA propia a 2 columnas, coherente con
 * el login (NO un modal sobre otra vista): panel visual izquierdo reutilizando
 * <LoginHero> + tarjeta de formulario a la derecha con los campos en REJILLA de
 * 2 columnas. Auth real: `register()`. Solo estructura/estilo; validación intacta.
 * Registro público = solo Estudiante (Docente/Admin visibles pero deshabilitados).
 */

const CARRERAS = [
  'Ingeniería de Sistemas', 'Ingeniería de Software', 'Ingeniería Informática',
  'Ingeniería Electrónica', 'Ingeniería Industrial', 'Otra',
];

/** Fuerza de contraseña → semánticos del sistema (rojo/ámbar/verde). */
function fuerza(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[0-9]/.test(p) && /[a-zA-Z]/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  const score = Math.min(3, s);
  const labels = ['Muy débil', 'Débil', 'Media', 'Fuerte'];
  const colors = ['#EF4444', '#EF4444', '#F59E0B', '#10B981'];
  return { score, label: labels[score], color: colors[score] };
}

export default function RegistroPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ nombre: '', email: '', cedula: '', carrera: '', paralelo: '', password: '', confirmar: '' });
  const [rol, setRol] = useState('estudiante');
  const [acepta, setAcepta] = useState(false);
  const [verPass, setVerPass] = useState(false);
  const [verConf, setVerConf] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [tocado, setTocado] = useState<Partial<Record<keyof typeof f | 'terminos', boolean>>>({});
  const [ondas, setOndas] = useState<{ id: number; x: number; y: number }[]>([]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const toca = (k: keyof typeof f) => () => setTocado((t) => ({ ...t, [k]: true }));

  const fz = fuerza(f.password);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email);
  const errores = {
    nombre: f.nombre.trim().length < 2 ? 'Ingresa tu nombre y apellidos.' : '',
    email: !emailOk ? 'Escribe un correo válido, por ejemplo nombre@gmail.com.' : '',
    cedula: !/^\d{4,12}$/.test(f.cedula.trim()) ? 'Escribe solo los números de tu cédula (4 a 12 dígitos).' : '',
    carrera: !f.carrera ? 'Selecciona tu carrera de la lista.' : '',
    paralelo: !/^[A-Za-z0-9]{1,10}$/.test(f.paralelo.trim()) ? 'Escribe tu paralelo, por ejemplo A, B o C.' : '',
    // Coincide con la regla real del backend (RegisterDto.password): 8
    // caracteres, con al menos una letra y un número.
    password: f.password.length < 8
      ? 'La contraseña debe tener al menos 8 caracteres.'
      : !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)
        ? 'Incluye al menos una letra y un número.'
        : '',
    confirmar: !f.confirmar ? 'Vuelve a escribir tu contraseña.' : f.confirmar !== f.password ? 'Las contraseñas no coinciden.' : '',
  };
  const formOk = Object.values(errores).every((e) => !e) && acepta;
  const passMatch = !!f.password && !!f.confirmar && f.password === f.confirmar;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTocado({ nombre: true, email: true, cedula: true, carrera: true, paralelo: true, password: true, confirmar: true, terminos: true });
    if (cargando) return;      // bloqueo de doble envío
    if (!formOk) return;       // no envía hasta que todo (incl. coincidencia y términos) sea válido
    setError('');
    setCargando(true);
    try {
      const u = await register({ nombre: f.nombre, email: f.email, password: f.password, cedula: f.cedula, carrera: f.carrera, paralelo: f.paralelo.trim().toUpperCase(), aceptaTerminos: acepta });
      router.replace(!u.introduccionCompletada ? '/introduccion' : !u.pretestCompletado ? '/pretest' : '/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
      setCargando(false);
    }
  }

  // Ripple del botón "Crear cuenta" (mismo efecto que "Ingresar").
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setOndas((o) => [...o, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setOndas((o) => o.filter((w) => w.id !== id)), 620);
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-app text-fg">
      {/* Fondo: halo azul + blob morado (esta pantalla es SIEMPRE oscura, coherente con el login) */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(74,144,226,0.16),transparent_70%)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.16),transparent_70%)] blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-6 sm:px-8 lg:flex-row lg:px-12">
        {/* Panel visual izquierdo — MISMA ESTRUCTURA QUE EL LOGIN a propósito.
            `LoginHero` coloca la mascota y la lista de beneficios con posiciones
            absolutas en PORCENTAJE, afinadas para el panel del login. Antes este
            contenedor usaba `h-screen` + `sticky` + `self-start`: con un alto fijo
            de 100vh (y sin estirarse con la fila) esos porcentajes caían en otro
            sitio y el título, la mascota y los beneficios se superponían.
            Al reproducir el contenedor del login, vuelven a caer donde deben. */}
        <div className="relative z-20 hidden lg:sticky lg:top-0 lg:block lg:h-[100svh] lg:w-[57%] lg:self-start lg:z-auto lg:pl-10 xl:pl-14 2xl:pl-16">
          <LoginHero />
        </div>

        {/* Tarjeta de registro (derecha). El panel toma algo más de ancho entre
            1024 y 1536px: ahí es donde los campos se quedaban sin espacio. */}
        <div className="flex items-center justify-center py-8 lg:w-[43%] lg:py-10">
          <form onSubmit={onSubmit} noValidate
            className="w-full max-w-[600px] 2xl:max-w-[700px] rounded-3xl border border-line bg-card/80 p-6 shadow-lift backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 sm:p-8">

            {/* Logo (centrado en móvil; en desktop el hero ya lo muestra) */}
            <div className="mb-5 flex justify-center lg:hidden"><PrexiLogo subtitle /></div>

            <h1 className="font-display text-2xl font-extrabold text-fg">Crear cuenta</h1>
            <p className="mb-5 mt-1 text-sm text-muted">Empieza tu ruta de aprendizaje como estudiante.</p>

            {error && (
              <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-500">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            {/* Dos columnas SOLO cuando el panel es de verdad ancho (2xl). Entre
                1024 y 1536px la tarjeta ocupa ~44% del viewport: partirla en dos
                dejaba los inputs en ~113px, imposibles de leer al escribir un
                correo. Una columna cómoda vale más que dos columnas apretadas. */}
            <div className="grid grid-cols-1 gap-x-5 gap-y-3 2xl:grid-cols-2">
              {/* Tipo de cuenta (full-width) */}
              <div className="2xl:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-fg">Tipo de cuenta</span>
                <div role="radiogroup" aria-label="Tipo de cuenta" className="grid grid-cols-3 gap-2">
                  {['estudiante', 'docente', 'admin'].map((r) => {
                    const dis = r !== 'estudiante';
                    const activo = rol === r;
                    return (
                      <button key={r} type="button" role="radio" aria-checked={activo} disabled={dis} onClick={() => setRol(r)}
                        title={dis ? 'Se crea desde el panel de administración' : undefined}
                        className={`rounded-xl border px-2 py-2.5 text-sm font-semibold capitalize transition ${
                          activo ? 'border-prexi-blue bg-prexi-blue text-accent-on shadow-glow'
                          : dis ? 'cursor-not-allowed border-line bg-subtle text-faint'
                          : 'border-line text-muted hover:border-prexi-blue/50 hover:bg-subtle'}`}>
                        {r}
                      </button>
                    );
                  })}
                </div>
                <span className="mt-1 block text-xs text-muted">Docente y Admin se crean desde el panel de administración.</span>
              </div>

              <Campo label="Nombre completo" icon={User} hint="Como figura en tu documento; se mostrará en el ranking." error={tocado.nombre ? errores.nombre : ''}>
                <input value={f.nombre} onChange={set('nombre')} onBlur={toca('nombre')} autoComplete="name"
                  placeholder="Ej.: Ana Quispe Mamani" className={inputAuthCls(!!tocado.nombre && !!errores.nombre) + ' pl-11'} />
              </Campo>

              <Campo label="Correo electrónico" icon={Mail} hint="Lo usarás para iniciar sesión." error={tocado.email ? errores.email : ''}>
                <input type="email" value={f.email} onChange={set('email')} onBlur={toca('email')} autoComplete="email"
                  placeholder="Ej.: ana.quispe@gmail.com" className={inputAuthCls(!!tocado.email && !!errores.email) + ' pl-11 pr-11'} />
                {emailOk && <CheckCircle className="absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-prexi-green" aria-label="Correo válido" />}
              </Campo>

              <Campo label="Cédula de identidad" icon={ShieldCheck} hint="Solo números, sin extensión ni puntos." error={tocado.cedula ? errores.cedula : ''}>
                <input value={f.cedula} onChange={set('cedula')} onBlur={toca('cedula')} inputMode="numeric"
                  placeholder="Ej.: 9876543" className={inputAuthCls(!!tocado.cedula && !!errores.cedula) + ' pl-11'} />
              </Campo>

              <Campo label="Paralelo" icon={Users} hint="El paralelo de la materia (ej.: A, B, C)." error={tocado.paralelo ? errores.paralelo : ''}>
                <input value={f.paralelo} onChange={set('paralelo')} onBlur={toca('paralelo')} maxLength={10}
                  placeholder="Ej.: A" className={inputAuthCls(!!tocado.paralelo && !!errores.paralelo) + ' pl-11'} />
              </Campo>

              <Campo className="2xl:col-span-2" label="Carrera" icon={GraduationCap} error={tocado.carrera ? errores.carrera : ''}>
                <select value={f.carrera} onChange={set('carrera')} onBlur={toca('carrera')}
                  className={inputAuthCls(!!tocado.carrera && !!errores.carrera) + ' max-w-full pl-11'}>
                  <option value="">Selecciona tu carrera…</option>
                  {CARRERAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>

              {/* Contraseña + medidor de fuerza (en su propia celda) */}
              <Campo label="Contraseña" icon={Lock} error={tocado.password ? errores.password : ''}
                hint={f.password ? undefined : 'Mínimo 8 caracteres; combina letras y números.'}
                footer={f.password ? (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => <div key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ backgroundColor: i < fz.score ? fz.color : 'rgb(var(--line))' }} />)}
                    </div>
                    <span className="mt-1 block text-xs font-medium" style={{ color: fz.color }}>Seguridad: {fz.label}</span>
                  </div>
                ) : undefined}>
                <input type={verPass ? 'text' : 'password'} value={f.password} onChange={set('password')} onBlur={toca('password')}
                  autoComplete="new-password" placeholder="Crea una contraseña segura"
                  className={inputAuthCls(!!tocado.password && !!errores.password) + ' pl-11 pr-11'} />
                <BotonOjo ver={verPass} onClick={() => setVerPass((v) => !v)} />
              </Campo>

              {/* Confirmar contraseña + indicador de coincidencia */}
              <Campo label="Confirmar contraseña" icon={KeyRound} error={tocado.confirmar ? errores.confirmar : ''}
                hint={!f.confirmar ? 'Vuelve a escribir la misma contraseña.' : undefined}
                footer={passMatch ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-prexi-green"><CheckCircle className="h-3.5 w-3.5" /> Las contraseñas coinciden</p>
                ) : undefined}>
                <input type={verConf ? 'text' : 'password'} value={f.confirmar} onChange={set('confirmar')} onBlur={toca('confirmar')}
                  autoComplete="new-password" placeholder="Repite tu contraseña"
                  className={inputAuthCls(!!tocado.confirmar && !!errores.confirmar) + ' pl-11 pr-11'} />
                <BotonOjo ver={verConf} onClick={() => setVerConf((v) => !v)} />
              </Campo>

              {/* Consentimiento (full-width) */}
              <div className="2xl:col-span-2">
                <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm text-muted">
                  <input type="checkbox" checked={acepta}
                    onChange={(e) => { setAcepta(e.target.checked); setTocado((t) => ({ ...t, terminos: true })); }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-prexi-blue focus:ring-prexi-blue" />
                  <span>Acepto los <span className="font-semibold text-prexi-blue-deep">Términos de uso</span> y la <span className="font-semibold text-prexi-blue-deep">Política de privacidad</span> de PREXI.</span>
                </label>
                {tocado.terminos && !acepta && <span className="mt-1 block text-xs font-medium text-red-500">Debes aceptar los términos para crear tu cuenta.</span>}
              </div>

              {/* Botón "Crear cuenta" (full-width, ripple + loading) */}
              <button type="submit" disabled={cargando} aria-busy={cargando} onPointerDown={onDown}
                className="btn-primary relative col-span-1 mt-1 h-[52px] w-full overflow-hidden 2xl:col-span-2">
                {ondas.map((w) => (
                  <motion.span key={w.id} initial={{ scale: 0, opacity: 0.5 }} animate={{ scale: 4, opacity: 0 }} transition={{ duration: 0.6 }}
                    className="pointer-events-none absolute h-24 w-24 rounded-full bg-white/40" style={{ left: w.x - 48, top: w.y - 48 }} />
                ))}
                {cargando
                  ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Creando…</>
                  : 'Crear cuenta'}
              </button>

              <p className="mt-1 text-center text-sm text-muted 2xl:col-span-2">
                ¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-prexi-blue-deep hover:underline">Inicia sesión</Link>
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Footer a sangre completa — solo desktop */}
      <footer className="relative z-10 hidden shrink-0 border-t border-line/60 px-8 py-4 lg:block lg:px-12">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between text-xs text-muted">
          <span>© {new Date().getFullYear()} PREXI. Todos los derechos reservados.</span>
          <span className="flex items-center gap-5">
            <span className="cursor-default transition hover:text-fg">Términos de uso</span>
            <span className="cursor-default transition hover:text-fg">Privacidad</span>
            <span className="cursor-default transition hover:text-fg">Soporte</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Campo con label, ícono a la izquierda, ayuda/errores y un `footer` opcional
 *  (medidor de fuerza / coincidencia). `className` permite col-span en la rejilla. */
function Campo({ label, icon: Icon, hint, error, footer, className = '', children }: {
  label: string; icon?: ComponentType<{ className?: string }>; hint?: string; error?: string;
  footer?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />}
        {children}
      </div>
      {error
        ? <span className="mt-1 block text-xs font-medium text-red-500">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
      {footer}
    </label>
  );
}

function BotonOjo({ ver, onClick }: { ver: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-fg"
      aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
      {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}
