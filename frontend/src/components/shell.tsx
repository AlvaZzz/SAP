'use client';

import { useEffect, useState, ReactNode, ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import { ThemeToggle } from './theme-toggle';
import { SonidoToggle } from './sonido-toggle';
import { NotificacionesBell } from './notificaciones-bell';
import { BuscadorNav } from './buscador-nav';
import {
  LayoutDashboard, Code, BookOpen, Target, TrendingUp, Trophy, User as UserIcon,
  LogOut, Menu, X, Users, BarChart3, FileText, GraduationCap, ClipboardList, Activity, Download, Settings, FlaskConical,
  Layers, Bot, Inbox, Sparkles, ShieldCheck,
} from './icons';

type Area = 'estudiante' | 'docente' | 'investigador' | 'admin';
type Rol = 'estudiante' | 'docente' | 'admin' | 'investigador';
interface NavItem { href: string; label: string; icon: ComponentType<{ className?: string }> }

// Home por rol (adónde llega/redirige cada rol).
const HOME_ROL: Record<Rol, string> = {
  estudiante: '/dashboard',
  docente: '/docente/dashboard',
  admin: '/admin/dashboard',
  investigador: '/investigador/panel',
};
// ¿El rol puede ver esta área? El admin (máximo privilegio) puede ver todas.
function areaPermite(area: Area, rol: Rol): boolean {
  if (rol === 'admin') return true;
  if (area === 'estudiante') return rol === 'estudiante';
  if (area === 'docente') return rol === 'docente';
  if (area === 'investigador') return rol === 'investigador';
  return false; // área admin y rol no admin
}

const NAV_ESTUDIANTE: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ejercicios', label: 'Ejercicios', icon: Code },
  // El editor de código vive dentro de un reto (ya no hay "Práctica" suelta).
  { href: '/retos', label: 'Retos', icon: Target },
  // Repaso libre con flashcards (apoyo; no puntúa ni afecta al θ).
  { href: '/flashcards', label: 'Repaso', icon: Sparkles },
  { href: '/documentos', label: 'Documentos', icon: BookOpen },
  { href: '/progreso', label: 'Progreso', icon: TrendingUp },
  { href: '/ranking', label: 'Ranking', icon: Trophy },
  { href: '/perfil', label: 'Perfil', icon: UserIcon },
  // La evaluación final va SIEMPRE al final; se bloquea hasta que el docente la habilite.
  { href: '/postest', label: 'Evaluación final', icon: GraduationCap },
];

const NAV_DOCENTE: NavItem[] = [
  { href: '/docente/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/docente/pendientes', label: 'Pendientes', icon: Inbox },
  { href: '/docente/unidades', label: 'Unidades y temas', icon: Layers },
  { href: '/docente/ejercicios', label: 'Ejercicios', icon: Code },
  { href: '/docente/preguntas-ia', label: 'Preguntas IA', icon: Bot },
  { href: '/docente/retos', label: 'Retos', icon: Target },
  { href: '/docente/documentos', label: 'Documentos', icon: FileText },
  { href: '/docente/estudiantes', label: 'Estudiantes', icon: Users },
  { href: '/docente/revisiones', label: 'Revisiones', icon: ClipboardList },
  { href: '/docente/postest', label: 'Evaluación final', icon: GraduationCap },
  { href: '/docente/reportes', label: 'Reportes', icon: BarChart3 },
];

/**
 * Navegación del rol INVESTIGADOR, en el orden real de un capítulo de tesis:
 * recorrerla de arriba abajo es recorrer el capítulo de resultados.
 */
const NAV_INVESTIGADOR: NavItem[] = [
  { href: '/investigador/panel', label: 'Muestra y diseño', icon: LayoutDashboard },
  { href: '/investigador/fiabilidad', label: 'Fiabilidad', icon: FlaskConical },
  { href: '/investigador/equivalencia', label: 'Equivalencia inicial', icon: Users },
  { href: '/investigador/resultados', label: 'Resultados', icon: BarChart3 },
  { href: '/investigador/clasificacion', label: 'Clasificación', icon: Layers },
  { href: '/investigador/validez', label: 'Validez interna', icon: ShieldCheck },
  { href: '/investigador/datos', label: 'Evidencia complementaria', icon: Activity },
  { href: '/investigador/exportacion', label: 'Exportación', icon: Download },
];

const NAV_ADMIN: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { href: '/admin/grupos', label: 'Grupos de investigación', icon: FlaskConical },
  { href: '/admin/sistema', label: 'Sistema', icon: Settings },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ClipboardList },
];

// Gradiente del sidebar resuelto vía tokens del tema (claro → navy, oscuro → #0A121F).
const SIDEBAR_BG = 'bg-gradient-to-b from-[rgb(var(--sidebar-from))] to-[rgb(var(--sidebar-to))]';

export function Shell({ children, area = 'estudiante' }: { children: ReactNode; area?: Area }) {
  const { usuario, cargando, sesionExpirada, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [nivelActual, setNivelActual] = useState<number | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  const nav = area === 'docente'
    ? NAV_DOCENTE
    : area === 'investigador'
      ? NAV_INVESTIGADOR
      : area === 'admin'
        ? NAV_ADMIN
        : NAV_ESTUDIANTE;
  const homeHref = HOME_ROL[(usuario?.rol as Rol) ?? 'estudiante'] ?? '/dashboard';

  // Control de acceso en la UI (el backend lo refuerza con guard de rol).
  useEffect(() => {
    if (cargando) return;
    // Si había sesión y el refresh silencioso ya no pudo renovarla, es un caso
    // distinto de "nunca inició sesión": se lo decimos explícitamente en /login.
    if (!usuario) { router.replace(sesionExpirada ? '/login?motivo=expirada' : '/login'); return; }
    const rol = usuario.rol as Rol;
    if (!areaPermite(area, rol)) { router.replace(HOME_ROL[rol]); return; }
    if (area === 'estudiante' && !usuario.introduccionCompletada) router.replace('/introduccion');
    else if (area === 'estudiante' && !usuario.pretestCompletado) router.replace('/pretest');
  }, [usuario, cargando, sesionExpirada, router, area]);

  useEffect(() => {
    if (!usuario || area !== 'estudiante' || usuario.rol !== 'estudiante') return;
    api.get<{ niveles: { numero: number; desbloqueado: boolean }[] }>('/niveles')
      .then((r) => { const d = r.niveles.filter((n) => n.desbloqueado); setNivelActual(d.length ? Math.max(...d.map((n) => n.numero)) : 1); })
      .catch(() => undefined);
  }, [usuario, area]);

  // Cierra el drawer al navegar (móvil).
  useEffect(() => { setMenuAbierto(false); }, [pathname]);

  // Evita parpadeo de contenido de un área que no corresponde al rol.
  const rolIncompatible = usuario && !areaPermite(area, usuario.rol as Rol);
  if (cargando || !usuario || rolIncompatible) return <div className="grid h-screen place-items-center bg-app text-muted">Cargando…</div>;

  const inicial = usuario.nombre.charAt(0).toUpperCase();
  const rolTexto = area === 'docente' ? 'Docente' : area === 'investigador' ? 'Investigador' : area === 'admin' ? 'Administrador' : nivelActual ? `Nivel ${nivelActual}` : 'Estudiante';
  async function salir() { await logout(); router.replace('/login'); }

  const sidebar = (
    <>
      <div className="mb-8 flex items-center justify-between gap-3 px-2 pt-2">
        <Link href={homeHref} className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-prexi-blue text-xl font-extrabold text-white shadow-lg shadow-blue-900/40">P</div>
          <div>
            <p className="font-display text-xl font-extrabold leading-none text-white">PREXI</p>
            <p className="text-[11px] text-blue-200/70">{area === 'docente' ? 'Panel docente' : area === 'investigador' ? 'Panel de investigación' : area === 'admin' ? 'Administración' : 'UPEA · Ing. Sistemas'}</p>
          </div>
        </Link>
        <button onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="grid h-8 w-8 place-items-center rounded-lg text-blue-200/70 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
      </div>
      {/* En móvil el buscador del header está oculto (sm:block); aquí, dentro del
          drawer, es donde el usuario de celular puede filtrar el menú. */}
      <div className="mb-3 px-1 lg:hidden">
        <BuscadorNav items={nav} onNavegar={() => setMenuAbierto(false)} />
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <p className="px-3.5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-[rgb(var(--sidebar-ink))]/60">Menú</p>
        {nav.map(({ href, label, icon: Icon }) => {
          const activo = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} aria-current={activo ? 'page' : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-medium transition ${activo
                ? 'bg-[rgb(var(--sidebar-active))] text-[rgb(var(--sidebar-active-ink))] shadow-[0_0_22px_-6px_rgb(var(--sidebar-bar)/0.7)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-[rgb(var(--sidebar-bar))] before:content-[""]'
                : 'text-[rgb(var(--sidebar-ink))] hover:bg-white/[0.06] hover:text-[rgb(var(--sidebar-active-ink))]'}`}>
              <Icon className={`h-[22px] w-[22px] transition-transform group-hover:scale-110 ${activo ? 'text-[rgb(var(--sidebar-bar))]' : 'group-hover:text-[rgb(var(--sidebar-active-ink))]'}`} /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl bg-white/5 p-3 ring-1 ring-white/5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-prexi-blue to-blue-400 font-bold text-white">{inicial}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{usuario.nombre}</p><p className="text-xs text-blue-200/60">{rolTexto} · <span className="capitalize">{usuario.rol}</span></p></div>
          <button onClick={salir} title="Cerrar sesión" className="grid h-8 w-8 place-items-center rounded-lg text-blue-200/70 transition hover:bg-white/10 hover:text-white"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-app">
      {/* Sidebar fija en escritorio */}
      <aside className={`sticky top-0 hidden h-screen w-64 shrink-0 flex-col p-4 text-white lg:flex ${SIDEBAR_BG}`}>{sidebar}</aside>

      {/* Drawer en móvil/tablet */}
      {menuAbierto && <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={() => setMenuAbierto(false)} aria-hidden="true" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col p-4 text-white transition-transform duration-300 lg:hidden ${SIDEBAR_BG} ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}`}>{sidebar}</aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-card/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
          <button onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" className="grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-subtle lg:hidden"><Menu className="h-5 w-5" /></button>
          {/* Buscador de secciones del rol activo (ver components/buscador-nav). */}
          <BuscadorNav items={nav} className="hidden max-w-md flex-1 sm:block" />
          <div className="ml-auto flex items-center gap-1.5">
            <SonidoToggle />
            <ThemeToggle />
            {(area === 'estudiante' || area === 'docente') && <NotificacionesBell />}
            <Link href={homeHref} className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2.5 transition hover:bg-subtle">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-prexi-navy to-prexi-blue text-sm font-bold text-white">{inicial}</div>
              <div className="hidden text-left leading-tight sm:block"><p className="text-sm font-semibold text-fg">{usuario.nombre.split(' ')[0]}</p><p className="text-[11px] text-muted">{rolTexto}</p></div>
            </Link>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
