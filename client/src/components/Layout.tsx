import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Nivel } from '../lib/types';
import {
  LayoutDashboard, Code, TrendingUp, Trophy, User as UserIcon,
  Bell, Search, LogOut, BookOpen, Settings,
} from './icons';

const navEstudiante = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/ejercicios', label: 'Ejercicios', icon: Code },
  { to: '/progreso', label: 'Progreso', icon: TrendingUp },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
  { to: '/perfil', label: 'Perfil', icon: UserIcon },
];

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
          isActive ? 'bg-prexi-blue text-white shadow-sm shadow-blue-900/30' : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </NavLink>
  );
}

export function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const esStaff = usuario && usuario.rol !== 'estudiante';
  const [nivelActual, setNivelActual] = useState<number | null>(null);

  useEffect(() => {
    api.get<{ niveles: Nivel[] }>('/niveles')
      .then((r) => {
        const desbloqueados = r.niveles.filter((n) => n.desbloqueado);
        setNivelActual(desbloqueados.length ? Math.max(...desbloqueados.map((n) => n.numero)) : 1);
      })
      .catch(() => setNivelActual(null));
  }, []);

  const inicial = usuario?.nombre.charAt(0).toUpperCase() ?? '?';
  const nivelTexto = nivelActual ? `Nivel ${nivelActual}` : 'Estudiante';

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* ─── Sidebar ─────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-prexi-navy to-[#162d4a] p-4 text-white md:flex">
        <div className="mb-7 flex items-center gap-3 px-2 pt-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-prexi-blue text-lg font-extrabold">P</div>
          <div>
            <p className="text-lg font-extrabold leading-none tracking-tight">PREXI</p>
            <p className="text-[11px] text-blue-200/80">UPEA · Ing. Sistemas</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          <p className="px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300/60">Menú</p>
          {navEstudiante.map((item) => <NavItem key={item.to} {...item} />)}

          {esStaff && (
            <>
              <p className="mt-5 px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300/60">Gestión</p>
              <NavItem to="/docente" label="Reportes" icon={BookOpen} />
              {usuario?.rol === 'admin' && <NavItem to="/admin" label="Admin" icon={Settings} />}
            </>
          )}
        </nav>

        {/* Perfil */}
        <div className="mt-auto rounded-2xl bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-prexi-blue to-blue-400 font-bold">
              {inicial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{usuario?.nombre}</p>
              <p className="text-xs text-blue-200/70">{nivelTexto} · <span className="capitalize">{usuario?.rol}</span></p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="grid h-8 w-8 place-items-center rounded-lg text-blue-200/70 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Contenido ───────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Buscar ejercicios, temas…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-prexi-blue focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-prexi-amber ring-2 ring-white" />
            </button>
            <button
              onClick={() => navigate('/perfil')}
              className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2.5 transition hover:bg-slate-100"
            >
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-prexi-navy to-prexi-blue text-sm font-bold text-white">
                {inicial}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-semibold text-prexi-navy">{usuario?.nombre.split(' ')[0]}</p>
                <p className="text-[11px] text-slate-400">{nivelTexto}</p>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
