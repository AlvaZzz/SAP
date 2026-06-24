import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('juan@upea.bo');
  const [password, setPassword] = useState('Prexi123*');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      if (modo === 'login') await login(email, password);
      else await register(nombre, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Panel de marca */}
      <div className="hidden flex-col justify-between bg-prexi-navy p-12 text-white md:flex">
        <div>
          <h1 className="text-4xl font-extrabold">PREXI</h1>
          <p className="text-blue-200">UPEA · Ingeniería de Sistemas</p>
        </div>
        <div>
          <h2 className="mb-3 text-3xl font-bold leading-snug">
            Aprende programación con un tutor de IA y gamificación.
          </h2>
          <p className="text-blue-100">
            Sistema adaptativo que ajusta los retos a tu nivel, te da pistas con ALEX
            y te motiva con XP, rachas e insignias.
          </p>
        </div>
        <p className="text-xs text-blue-300">© {new Date().getFullYear()} PREXI · UPEA</p>
      </div>

      {/* Formulario */}
      <div className="grid place-items-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <h2 className="mb-1 text-2xl font-bold text-prexi-navy">
            {modo === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
          </h2>
          <p className="mb-6 text-sm text-slate-500">
            {modo === 'login' ? 'Ingresa para continuar tu ruta de aprendizaje.' : 'Empieza tu ruta como estudiante.'}
          </p>

          {modo === 'registro' && (
            <label className="mb-3 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Nombre completo</span>
              <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </label>
          )}

          <label className="mb-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Contraseña</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button className="btn-primary w-full" disabled={cargando}>
            {cargando ? 'Procesando…' : modo === 'login' ? 'Ingresar' : 'Registrarme'}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            {modo === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              type="button"
              className="font-semibold text-prexi-blue"
              onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
            >
              {modo === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>

          <p className="mt-6 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
            Demo: juan@upea.bo · docente@upea.bo · admin@upea.bo — contraseña Prexi123*
          </p>
        </form>
      </div>
    </div>
  );
}
