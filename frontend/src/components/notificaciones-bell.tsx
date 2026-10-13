'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Bell, CheckCircle, Target } from '@/components/icons';

interface Notif { id: number; tipo: string; titulo: string; mensaje: string; enlace: string | null; refId: number | null; leida: boolean; fecha: string }

function haceRato(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

/**
 * Campana de notificaciones (topbar del estudiante). Muestra el badge de no
 * leídas, la lista, permite marcar como leídas y enlaza al contenido. Sondea
 * el backend periódicamente (datos reales, sin simulación).
 */
export function NotificacionesBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<{ no_leidas: number; notificaciones: Notif[] }>('/notificaciones');
      setItems(r.notificaciones); setNoLeidas(r.no_leidas);
    } catch { /* noop */ } finally { setCargando(false); }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  // Cierra al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [abierto]);

  async function abrirNotif(n: Notif) {
    if (!n.leida) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      setNoLeidas((c) => Math.max(0, c - 1));
      api.post(`/notificaciones/${n.id}/leer`).catch(() => undefined);
    }
    setAbierto(false);
    if (n.enlace) router.push(n.enlace);
  }

  async function marcarTodas() {
    setItems((prev) => prev.map((x) => ({ ...x, leida: true })));
    setNoLeidas(0);
    await api.post('/notificaciones/leer-todas').catch(() => undefined);
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setAbierto((v) => !v)} aria-label="Notificaciones"
        className="relative grid h-9 w-9 place-items-center rounded-xl text-muted transition hover:bg-subtle hover:text-fg">
        <Bell className="h-[18px] w-[18px]" />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-prexi-red px-1 text-2xs font-bold text-white ring-2 ring-card">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] animate-fade-up overflow-hidden rounded-2xl border border-line bg-card shadow-lift">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-display font-bold text-fg">Notificaciones</p>
            {noLeidas > 0 && <button onClick={marcarTodas} className="text-xs font-semibold text-prexi-blue-deep hover:underline">Marcar todas</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {cargando ? (
              <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14" />)}</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted">
                <Bell className="h-8 w-8 opacity-40" />
                <p className="text-sm">No tienes notificaciones.</p>
              </div>
            ) : (
              items.map((n) => (
                <button key={n.id} onClick={() => abrirNotif(n)}
                  className={`flex w-full gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-subtle ${n.leida ? '' : 'bg-prexi-blue/5'}`}>
                  <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${n.leida ? 'bg-subtle text-muted' : 'bg-prexi-blue/10 text-prexi-blue-deep'}`}>
                    {n.titulo.toLowerCase().includes('aprobado') ? <CheckCircle className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-fg">{n.titulo}</p>
                      {!n.leida && <span className="h-2 w-2 shrink-0 rounded-full bg-prexi-blue" />}
                    </div>
                    <p className="line-clamp-2 text-xs text-muted">{n.mensaje}</p>
                    <p className="mt-0.5 text-2xs text-muted/70">{haceRato(n.fecha)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
