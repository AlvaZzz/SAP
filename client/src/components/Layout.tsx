import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '▣', end: true },
  { to: '/ejercicios', label: 'Ejercicios', icon: '⟨⟩' },
  { to: '/progreso', label: 'Progreso', icon: '📈' },
  { to: '/ranking', label: 'Ranking', icon: '🏆' },
];

export function Layout() {
  const { usuario, logout } = useAuth();
  const esStaff = usuario && usuario.rol !== 'estudiante';

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-prexi-navy p-5 text-white md:flex">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight">PREXI</h1>
          <p className="text-xs text-blue-200">UPEA · Ing. de Sistemas</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-prexi-blue text-white' : 'text-blue-100 hover:bg-white/10'
                }`
              }
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {esStaff && (
            <>
              <div className="mt-4 px-4 text-[10px] font-semibold uppercase text-blue-300">Gestión</div>
              <NavLink
                to="/docente"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-prexi-blue text-white' : 'text-blue-100 hover:bg-white/10'
                  }`
                }
              >
                <span className="w-5 text-center">📊</span> Reportes
              </NavLink>
              {usuario?.rol === 'admin' && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      isActive ? 'bg-prexi-blue text-white' : 'text-blue-100 hover:bg-white/10'
                    }`
                  }
                >
                  <span className="w-5 text-center">⚙️</span> Admin
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-prexi-blue font-bold">
              {usuario?.nombre.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{usuario?.nombre}</p>
              <p className="text-xs capitalize text-blue-200">{usuario?.rol}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full rounded-xl bg-white/10 py-2 text-sm hover:bg-white/20">
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-x-hidden p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
