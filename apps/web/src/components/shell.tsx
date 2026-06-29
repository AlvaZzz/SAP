'use client';

import { useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { api } from '@/lib/api';
import {
  LayoutDashboard, Code, Play, BookOpen, Target, TrendingUp, Trophy, User as UserIcon,
  Bell, Search, LogOut, Settings, Menu, X,
} from './icons';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ejercicios', label: 'Ejercicios', icon: Code },
  { href: '/practica', label: 'Práctica', icon: Play },
  { href: '/documentos', label: 'Documentos', icon: BookOpen },
  { href: '/retos', label: 'Retos', icon: Target },
  { href: '/progreso', label: 'Progreso', icon: TrendingUp },
  { href: '/ranking', label: 'Ranking', icon: Trophy },
  { href: '/perfil', label: 'Perfil', icon: UserIcon },
];

export function Shell({ children }: { children: ReactNode }) {
  const { usuario, cargando, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [nivelActual, setNivelActual] = useState<number | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (cargando) return;
    if (!usuario) router.replace('/login');
    else if (usuario.rol === 'estudiante' && !usuario.pretestCompletado) router.replace('/pretest');
  }, [usuario, cargando, router]);

  useEffect(() => {
    if (!usuario) return;
    api.get<{ niveles: { numero: number; desbloqueado: boolean }[] }>('/niveles')
      .then((r) => { const d = r.niveles.filter((n) => n.desbloqueado); setNivelActual(d.length ? Math.max(...d.map((n) => n.numero)) : 1); })
      .catch(() => undefined);
  }, [usuario]);

  // Cierra el drawer al navegar (móvil).
  useEffect(() => { setMenuAbierto(false); }, [pathname]);

  if (cargando || !usuario) return <div className="grid h-screen place-items-center text-slate-400">Cargando…</div>;

  const inicial = usuario.nombre.charAt(0).toUpperCase();
  const nivelTexto = nivelActual ? `Nivel ${nivelActual}` : 'Estudiante';
  const esStaff = usuario.rol !== 'estudiante';
  async function salir() { await logout(); router.replace('/login'); }

  const sidebar = (
    <>
      <div className="mb-7 flex items-center justify-between gap-3 px-2 pt-2">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-prexi-blue text-lg font-extrabold">P</div>
          <div><p className="text-lg font-extrabold leading-none">PREXI</p><p className="text-[11px] text-blue-200/80">UPEA · Ing. Sistemas</p></div>
        </div>
        <button onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="grid h-8 w-8 place-items-center rounded-lg text-blue-200/70 hover:bg-white/10 lg:hidden"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <p className="px-3.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300/60">Menú</p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const activo = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${activo ? 'bg-prexi-blue text-white shadow-sm shadow-blue-900/30' : 'text-blue-100/80 hover:bg-white/10 hover:text-white'}`}>
              <Icon className="h-[18px] w-[18px]" /> {label}
            </Link>
          );
        })}
        {esStaff && (
          <Link href="/perfil" className="mt-4 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-blue-100/80 hover:bg-white/10"><Settings className="h-[18px] w-[18px]" /> Gestión</Link>
        )}
      </nav>
      <div className="mt-auto rounded-2xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-prexi-blue to-blue-400 font-bold">{inicial}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{usuario.nombre}</p><p className="text-xs text-blue-200/70">{nivelTexto} · <span className="capitalize">{usuario.rol}</span></p></div>
          <button onClick={salir} title="Cerrar sesión" className="grid h-8 w-8 place-items-center rounded-lg text-blue-200/70 transition hover:bg-white/10 hover:text-white"><LogOut className="h-[18px] w-[18px]" /></button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar fija en escritorio */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-prexi-navy to-[#162d4a] p-4 text-white lg:flex">{sidebar}</aside>

      {/* Drawer en móvil/tablet */}
      {menuAbierto && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setMenuAbierto(false)} aria-hidden="true" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gradient-to-b from-prexi-navy to-[#162d4a] p-4 text-white transition-transform duration-300 lg:hidden ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}`}>{sidebar}</aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <button onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input placeholder="Buscar…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-prexi-blue focus:bg-white focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button aria-label="Notificaciones" className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100"><Bell className="h-[18px] w-[18px]" /><span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-prexi-amber ring-2 ring-white" /></button>
            <Link href="/perfil" className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2.5 transition hover:bg-slate-100">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-prexi-navy to-prexi-blue text-sm font-bold text-white">{inicial}</div>
              <div className="hidden text-left leading-tight sm:block"><p className="text-sm font-semibold text-prexi-navy">{usuario.nombre.split(' ')[0]}</p><p className="text-[11px] text-slate-400">{nivelTexto}</p></div>
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
