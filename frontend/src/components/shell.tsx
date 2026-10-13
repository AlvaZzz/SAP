'use client';

import { IconoFlashcard } from '@/components/flashcards/boton-flashcards';
import { useEffect, useId, useMemo, useState, ReactNode, ComponentType } from 'react';
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
  LogOut, Menu, X, Users, BarChart3, FileText, GraduationCap, ClipboardList, Download, Settings, FlaskConical,
  Layers, Bot, Inbox, Sparkles, ShieldCheck, UserCheck,
} from './icons';

type Area = 'estudiante' | 'docente' | 'investigador' | 'admin';
type Rol = 'estudiante' | 'docente' | 'admin' | 'investigador';
interface NavItem { href: string; label: string; icon: ComponentType<{ className?: string }> }
/**
 * La navegación se agrupa por SECCIONES (como la documentación de Angular): un
 * encabezado corto y sus ítems debajo. Los grupos NO se pliegan —cada rol tiene
 * entre 8 y 14 ítems y caben enteros—, así que todo sigue a un clic.
 */
interface NavGrupo { titulo: string; items: NavItem[] }

// Home por rol (adónde llega/redirige cada rol).
const HOME_ROL: Record<Rol, string> = {
  estudiante: '/dashboard',
  // El docente entra directo a sus paralelos; el investigador, a su índice.
  docente: '/docente/dashboard',
  admin: '/admin/dashboard',
  investigador: '/investigador/indice',
};
// ¿El rol puede ver esta área? El admin (máximo privilegio) puede ver todas.
function areaPermite(area: Area, rol: Rol): boolean {
  if (rol === 'admin') return true;
  if (area === 'estudiante') return rol === 'estudiante';
  if (area === 'docente') return rol === 'docente';
  if (area === 'investigador') return rol === 'investigador';
  return false; // área admin y rol no admin
}

const NAV_ESTUDIANTE: NavGrupo[] = [
  {
    titulo: 'Aprendizaje',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/ejercicios', label: 'Ejercicios', icon: Code },
      // El editor de código vive dentro de un reto (ya no hay "Práctica" suelta).
      { href: '/retos', label: 'Retos', icon: Target },
      // Repaso libre con flashcards (apoyo; no puntúa ni afecta al θ).
      { href: '/flashcards', label: 'Flashcards', icon: IconoFlashcard },
    ],
  },
  {
    titulo: 'Recursos',
    items: [
      { href: '/documentos', label: 'Documentos', icon: BookOpen },
    ],
  },
  {
    titulo: 'Mi progreso',
    items: [
      { href: '/progreso', label: 'Progreso', icon: TrendingUp },
      { href: '/ranking', label: 'Ranking', icon: Trophy },
      { href: '/perfil', label: 'Perfil', icon: UserIcon },
    ],
  },
];

/**
 * Navegación del rol DOCENTE, en el orden en que se usa: primero sus
 * paralelos, luego sus estudiantes, el contenido y la evaluación.
 */
const NAV_DOCENTE: NavGrupo[] = [
  {
    titulo: 'Inicio',
    items: [
      { href: '/docente/dashboard', label: 'Mis paralelos', icon: LayoutDashboard },
    ],
  },
  {
    titulo: 'Estudiantes',
    items: [
      { href: '/docente/estudiantes/registro', label: 'Registro', icon: UserCheck },
      { href: '/docente/estudiantes', label: 'Seguimiento', icon: Users },
    ],
  },
  {
    titulo: 'Contenido',
    items: [
      { href: '/docente/unidades', label: 'Unidades', icon: Layers },
      { href: '/docente/retos', label: 'Retos', icon: Target },
      { href: '/docente/documentos', label: 'Documentos', icon: FileText },
    ],
  },
  {
    titulo: 'Evaluación',
    items: [
      { href: '/docente/revisiones', label: 'Revisar retos', icon: Inbox },
      { href: '/docente/examenes', label: 'Exámenes', icon: GraduationCap },
      { href: '/docente/reportes', label: 'Reportes', icon: BarChart3 },
      { href: '/docente/evaluar-prexi', label: 'Evaluar PREXI', icon: ClipboardList },
    ],
  },
];

/**
 * Navegación del rol INVESTIGADOR (diseño no experimental transversal): el
 * estudio, los instrumentos y la entrega de datos.
 */
const NAV_INVESTIGADOR: NavGrupo[] = [
  {
    titulo: 'El estudio',
    items: [
      { href: '/investigador/indice', label: 'Índice', icon: LayoutDashboard },
      { href: '/investigador/panel', label: 'Diseño y muestra', icon: ClipboardList },
      { href: '/investigador/validez', label: 'Participantes y uso', icon: Users },
    ],
  },
  {
    titulo: 'Resultados',
    items: [
      { href: '/investigador/validacion', label: 'Validación del sistema', icon: BarChart3 },
    ],
  },
  {
    titulo: 'Instrumentos',
    items: [
      { href: '/investigador/fiabilidad', label: 'Fiabilidad del diagnóstico', icon: FlaskConical },
      { href: '/investigador/clasificacion', label: 'Mecanismo adaptativo', icon: Layers },
    ],
  },
  {
    titulo: 'Entrega',
    items: [
      { href: '/investigador/exportacion', label: 'Exportación y reproducibilidad', icon: Download },
    ],
  },
];

const NAV_ADMIN: NavGrupo[] = [
  {
    titulo: 'Gestión',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
    ],
  },
  {
    titulo: 'Sistema',
    items: [
      { href: '/admin/sistema', label: 'Configuración', icon: Settings },
      { href: '/admin/auditoria', label: 'Auditoría', icon: ClipboardList },
    ],
  },
];

// Gradiente del sidebar resuelto vía tokens del tema (claro → navy, oscuro → #0A121F).
const SIDEBAR_BG = 'bg-gradient-to-b from-[rgb(var(--sidebar-from))] to-[rgb(var(--sidebar-to))]';

export function Shell({ children, area = 'estudiante' }: { children: ReactNode; area?: Area }) {
  const { usuario, cargando, sesionExpirada, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [nivelActual, setNivelActual] = useState<number | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navId = useId();

  const grupos = area === 'docente'
    ? NAV_DOCENTE
    : area === 'investigador'
      ? NAV_INVESTIGADOR
      : area === 'admin'
        ? NAV_ADMIN
        : NAV_ESTUDIANTE;
  // El buscador trabaja sobre la lista plana de destinos del rol activo.
  const nav = useMemo(() => grupos.flatMap((g) => g.items), [grupos]);
  // Ítem activo = el de ruta MÁS específica que coincide: así "Registro de
  // estudiantes" (/docente/estudiantes/registro) no enciende también "Estudiantes".
  const hrefActivo = useMemo(
    () => nav.filter((n) => pathname === n.href || pathname.startsWith(n.href + '/')).sort((a, b) => b.href.length - a.href.length)[0]?.href,
    [nav, pathname],
  );
  const homeHref = HOME_ROL[(usuario?.rol as Rol) ?? 'estudiante'] ?? '/dashboard';

  // Control de acceso en la UI (el backend lo refuerza con guard de rol).
  useEffect(() => {
    if (cargando) return;
    // Si había sesión y el refresh silencioso ya no pudo renovarla, es un caso
    // distinto de "nunca inició sesión": se lo decimos explícitamente en /login.
    if (!usuario) { router.replace(sesionExpirada ? '/login?motivo=expirada' : '/login'); return; }
    const rol = usuario.rol as Rol;
    // Contraseña temporal: no entra a ningún área hasta definir la suya.
    if (usuario.mustChangePassword) { router.replace('/primer-ingreso'); return; }
    // Se registró solo y su docente aún no lo aceptó: espera en su propia pantalla.
    if (rol === 'estudiante' && usuario.estadoInscripcion && usuario.estadoInscripcion !== 'aprobada') { router.replace('/inscripcion'); return; }
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

  // MENÚ LATERAL COMPACTO. Sus tamaños van en PÍXELES a propósito: el contenido
  // crece con la letra base de la pantalla (hasta 135 %), pero el menú es
  // navegación y no debe quitarle espacio ni protagonismo.
  const sidebar = (
    <>
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/[0.07] px-1 pb-4 pt-1">
        <Link href={homeHref} className="flex items-center gap-2.5">
          <div className="grid h-[44px] w-[44px] place-items-center rounded-[14px] bg-gradient-to-br from-prexi-blue to-blue-600 text-[21px] font-extrabold text-white shadow-lg shadow-blue-900/50 ring-1 ring-white/15">P</div>
          <div>
            <p className="font-display text-[22px] font-extrabold leading-none tracking-tight text-white">PRE<span className="text-amber-300">XI</span></p>
            <p className="mt-1 text-[12px] font-medium text-blue-200/70">{area === 'docente' ? 'Panel docente' : area === 'investigador' ? 'Panel de investigación' : area === 'admin' ? 'Administración' : 'UPEA · Ing. Sistemas'}</p>
          </div>
        </Link>
        <button onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="grid h-8 w-8 place-items-center rounded-lg text-blue-200/70 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
      </div>
      {/* En móvil el buscador del header está oculto (sm:block); aquí, dentro del
          drawer, es donde el usuario de celular puede filtrar el menú. */}
      <div className="mb-3 px-1 lg:hidden">
        <BuscadorNav items={nav} onNavegar={() => setMenuAbierto(false)} />
      </div>
      <nav aria-label="Secciones" className="flex flex-1 flex-col gap-4 overflow-y-auto pb-2">
        {grupos.map((grupo, i) => {
          // El encabezado NO es un enlace: es una etiqueta. Va como <h2> (fuera
          // del orden de tabulación) y la lista lo referencia para que el lector
          // de pantalla anuncie el grupo al que pertenece cada ítem.
          const tituloId = `${navId}-${i}`;
          return (
            <div key={grupo.titulo} className={i > 0 ? 'pt-1' : ''}>
              <h2 id={tituloId} className="px-[10px] pb-[8px] text-[11.5px] font-bold uppercase tracking-[0.14em] text-[rgb(var(--sidebar-ink))]/80">
                {grupo.titulo}
              </h2>
              <ul aria-labelledby={tituloId} className="flex flex-col gap-[3px]">
                {grupo.items.map(({ href, label, icon: Icon }) => {
                  const activo = href === hrefActivo;
                  return (
                    <li key={href}>
                      <Link href={href} aria-current={activo ? 'page' : undefined}
                        className={`group relative flex items-center gap-[12px] rounded-[12px] py-[7px] pl-[11px] pr-[8px] text-[16.5px] transition ${activo
                          ? 'bg-[rgb(var(--sidebar-active))] font-semibold text-[rgb(var(--sidebar-active-ink))] ring-1 ring-white/[0.06]'
                          : 'font-medium text-[rgb(var(--sidebar-ink))] hover:bg-white/[0.05] hover:text-[rgb(var(--sidebar-active-ink))]'}`}>
                        {activo && <span aria-hidden className="absolute left-0 top-1/2 h-[20px] w-[3px] -translate-y-1/2 rounded-r-full bg-[rgb(var(--sidebar-bar))]" />}
                        <span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] transition ${activo ? 'bg-[rgb(var(--sidebar-bar))] text-white shadow-[0_6px_16px_-6px_rgb(var(--sidebar-bar))]' : 'bg-white/[0.05] group-hover:bg-white/[0.09]'}`}>
                          <Icon className="h-[19px] w-[19px]" />
                        </span>
                        <span className="min-w-0 leading-tight">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="mt-3 rounded-[14px] bg-white/[0.05] p-[12px] ring-1 ring-white/[0.07]">
        <div className="flex items-center gap-[10px]">
          <div className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-prexi-blue to-blue-400 text-[16px] font-bold text-white ring-2 ring-white/10">{inicial}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold text-white">{usuario.nombre}</p><p className="truncate text-[12.5px] text-blue-200/60">{rolTexto} · <span className="capitalize">{usuario.rol}</span></p></div>
          <button onClick={salir} title="Cerrar sesión" className="grid h-8 w-8 place-items-center rounded-lg text-blue-200/70 transition hover:bg-white/10 hover:text-white"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-app">
      {/* Sidebar fija en escritorio */}
      <aside className={`sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col border-r border-white/[0.06] p-[16px] text-white lg:flex ${SIDEBAR_BG}`}>{sidebar}</aside>

      {/* Drawer en móvil/tablet */}
      {menuAbierto && <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={() => setMenuAbierto(false)} aria-hidden="true" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[288px] max-w-[86vw] flex-col p-[16px] text-white transition-transform duration-300 lg:hidden ${SIDEBAR_BG} ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}`}>{sidebar}</aside>

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
              <div className="hidden text-left leading-tight sm:block"><p className="text-sm font-semibold text-fg">{usuario.nombre.split(' ')[0]}</p><p className="text-2xs text-muted">{rolTexto}</p></div>
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
