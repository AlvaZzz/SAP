'use client';

/**
 * Tour guiado de onboarding. Se muestra la PRIMERA vez que el usuario entra a
 * cada módulo (persistido por usuario en el backend, no en localStorage).
 * Pasos anclados a elementos (spotlight) o centrados; Anterior / Siguiente /
 * Saltar tutorial. Al terminar o saltar se marca como visto vía POST /auth/tours.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { tourParaRuta, Tour } from '@/lib/tours';
import { useAuth } from '@/providers/auth-provider';

interface Rect { top: number; left: number; width: number; height: number }

export function TourManager() {
  const { usuario } = useAuth();
  const pathname = usePathname();
  const [vistos, setVistos] = useState<string[] | null>(null);
  const [tour, setTour] = useState<Tour | null>(null);

  // Carga inicial de tours vistos (una vez por sesión de usuario).
  useEffect(() => {
    if (!usuario) { setVistos(null); return; }
    api.get<{ vistos: string[] }>('/auth/tours').then((r) => setVistos(r.vistos)).catch(() => setVistos([]));
  }, [usuario?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al navegar: si la ruta tiene tour y no fue visto, mostrarlo.
  useEffect(() => {
    if (!usuario || vistos === null) return;
    const t = tourParaRuta(pathname);
    setTour(t && !vistos.includes(t.clave) ? t : null);
  }, [pathname, vistos, usuario]);

  const cerrar = useCallback((clave: string) => {
    setTour(null);
    setVistos((v) => (v && !v.includes(clave) ? [...v, clave] : v));
    api.post('/auth/tours', { clave }).catch(() => undefined);
  }, []);

  if (!tour) return null;
  return <TourOverlay key={tour.clave} tour={tour} onCerrar={() => cerrar(tour.clave)} />;
}

function TourOverlay({ tour, onCerrar }: { tour: Tour; onCerrar: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const paso = tour.pasos[i];
  const ultimo = i === tour.pasos.length - 1;

  // Mide el elemento ancla del paso (si existe y es visible).
  useEffect(() => {
    function medir() {
      if (!paso.selector) { setRect(null); return; }
      const el = document.querySelector(paso.selector);
      const r = el?.getBoundingClientRect();
      if (!r || r.width === 0 || r.height === 0) { setRect(null); return; }
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    if (paso.selector) {
      const el = document.querySelector(paso.selector);
      el?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    }
    medir();
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => { window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  }, [paso]);

  // Accesibilidad: Escape salta el tutorial.
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onCerrar]);

  const M = 8; // margen del spotlight
  const anclado = rect !== null;

  // Posición del tooltip: debajo del ancla si cabe; si no, encima; si no hay ancla, centrado.
  let estiloTooltip: React.CSSProperties;
  if (anclado && rect) {
    const alto = tooltipRef.current?.offsetHeight ?? 190;
    const debajo = rect.top + rect.height + M + alto + 16 < window.innerHeight;
    const top = debajo ? rect.top + rect.height + M + 10 : Math.max(16, rect.top - M - alto - 10);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - 190), window.innerWidth - 396);
    estiloTooltip = { position: 'fixed', top, left, width: 380, maxWidth: 'calc(100vw - 32px)' };
  } else {
    estiloTooltip = { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 440, maxWidth: 'calc(100vw - 32px)' };
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={`Tutorial: ${paso.titulo}`}>
      {/* Fondo oscuro; con ancla, el spotlight lo recorta vía box-shadow */}
      {anclado && rect ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-prexi-blue-hover transition-all duration-200"
          style={{
            top: rect.top - M, left: rect.left - M, width: rect.width + M * 2, height: rect.height + M * 2,
            boxShadow: '0 0 0 9999px rgb(6 11 19 / 0.62)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgb(6_11_19/0.62)]" />
      )}

      {/* Tooltip / tarjeta del paso */}
      <div ref={tooltipRef} style={estiloTooltip} className="rounded-2xl border border-line bg-card p-5 shadow-lift">
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Paso {i + 1} de {tour.pasos.length}</p>
          <button onClick={onCerrar} className="text-xs font-semibold text-muted transition hover:text-fg">Saltar tutorial</button>
        </div>
        <h3 className="font-display text-lg font-bold text-fg">{paso.titulo}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{paso.texto}</p>

        {/* Progreso por puntos */}
        <div className="mt-4 flex items-center gap-1.5">
          {tour.pasos.map((_, k) => (
            <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-prexi-blue' : 'w-1.5 bg-line'}`} />
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {i > 0 && (
            <button onClick={() => setI(i - 1)} className="btn-ghost !px-4 !py-2 text-sm">Anterior</button>
          )}
          <button
            onClick={() => (ultimo ? onCerrar() : setI(i + 1))}
            className="btn-primary !px-4 !py-2 text-sm"
            autoFocus
          >
            {ultimo ? 'Entendido' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  );
}
