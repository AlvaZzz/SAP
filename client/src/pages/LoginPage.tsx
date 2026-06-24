import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { GraduationCap, Eye, EyeOff, AlertCircle } from '../components/icons';

const DOMINIO = '@upea.edu.bo';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('juan@upea.edu.bo');
  const [password, setPassword] = useState('Prexi123*');
  const [verPass, setVerPass] = useState(false);
  const [tocado, setTocado] = useState<{ email?: boolean; password?: boolean }>({});
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailDominio = email.toLowerCase().endsWith(DOMINIO);
  const emailError = !email ? 'Ingresa tu correo.'
    : !emailValido ? 'Formato de correo inválido.'
    : !emailDominio ? `Usa tu correo institucional (${DOMINIO}).` : '';
  const passError = !password ? 'Ingresa tu contraseña.' : '';
  const formOk = !emailError && !passError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTocado({ email: true, password: true });
    if (!formOk) return;
    setError('');
    setCargando(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-[#f8fafc] md:grid-cols-2">
      <Marca />
      <div className="grid place-items-center p-6">
        <form onSubmit={onSubmit} noValidate className="w-full max-w-sm">
          <h2 className="mb-1 text-2xl font-bold text-prexi-navy">Bienvenido de nuevo</h2>
          <p className="mb-6 text-sm text-slate-500">Ingresa para continuar tu ruta de aprendizaje.</p>

          {error && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <Campo label="Correo institucional" error={tocado.email ? emailError : ''}>
            <input
              type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, email: true }))}
              className={inputCls(!!tocado.email && !!emailError)} placeholder={`tucorreo${DOMINIO}`}
            />
          </Campo>

          <Campo label="Contraseña" error={tocado.password ? passError : ''}>
            <div className="relative">
              <input
                type={verPass ? 'text' : 'password'} autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} onBlur={() => setTocado((t) => ({ ...t, password: true }))}
                className={inputCls(!!tocado.password && !!passError) + ' pr-11'}
              />
              <button type="button" onClick={() => setVerPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label={verPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {verPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Campo>

          <button className="btn-primary mt-2 w-full" disabled={cargando}>
            {cargando ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Ingresando…</>
            ) : 'Ingresar'}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="font-semibold text-prexi-blue hover:underline">Regístrate</Link>
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

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  );
}

export function Marca() {
  return (
    <div className="hidden flex-col justify-between bg-gradient-to-br from-prexi-navy to-prexi-blue p-12 text-white md:flex">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><GraduationCap className="h-7 w-7" /></div>
        <div><h1 className="text-3xl font-extrabold leading-none">PREXI</h1><p className="text-blue-200">UPEA · Ingeniería de Sistemas</p></div>
      </div>
      <div>
        <h2 className="mb-3 text-3xl font-bold leading-snug">Aprende Python con un tutor de IA y gamificación.</h2>
        <p className="text-blue-100">Sistema adaptativo que mide tu nivel, ajusta los retos y te guía con ALEX mientras acumulas XP, rachas e insignias.</p>
      </div>
      <p className="text-xs text-blue-300">© {new Date().getFullYear()} PREXI · UPEA</p>
    </div>
  );
}
