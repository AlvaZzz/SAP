'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Inbox, ArrowRight, KeyRound } from '@/components/icons';

/**
 * Avisos del panel docente: estudiantes que piden entrar al curso y los que
 * olvidaron su contraseña. No ocupan espacio si no hay ninguno.
 */
export function AvisoSolicitudes() {
  const [n, setN] = useState(0);
  const [recuperar, setRecuperar] = useState(0);
  useEffect(() => {
    api.get<{ pendientes: number }>('/docente/registro/solicitudes/conteo').then((r) => setN(r.pendientes)).catch(() => undefined);
    api.get<{ pendientes: number }>('/recuperaciones/conteo').then((r) => setRecuperar(r.pendientes)).catch(() => undefined);
  }, []);
  if (n === 0 && recuperar === 0) return null;
  return (
    <div className="mb-5 space-y-3">
      {recuperar > 0 && (
        <Link href="/docente/estudiantes/registro?ver=solicitudes"
          className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-prexi-amber/60 bg-prexi-amber/10 p-4 transition hover:bg-prexi-amber/15">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-prexi-amber/20 text-prexi-amber"><KeyRound className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-fg">{recuperar === 1 ? '1 estudiante olvidó su contraseña' : `${recuperar} estudiantes olvidaron su contraseña`}</span>
            <span className="block text-sm text-muted">Acepta si es quien dice ser: así podrá crear una nueva.</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-prexi-amber">Revisar <ArrowRight className="h-4 w-4" /></span>
        </Link>
      )}
      {n > 0 && (
        <Link href="/docente/estudiantes/registro?ver=solicitudes"
          className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-prexi-blue bg-prexi-blue/10 p-4 transition hover:bg-prexi-blue/15">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-prexi-blue/20 text-prexi-blue-deep"><Inbox className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-fg">{n === 1 ? '1 estudiante pide entrar a tu curso' : `${n} estudiantes piden entrar a tu curso`}</span>
            <span className="block text-sm text-muted">Se registraron por su cuenta y no pueden empezar hasta que los aceptes.</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-prexi-blue-deep">Revisar solicitudes <ArrowRight className="h-4 w-4" /></span>
        </Link>
      )}
    </div>
  );
}
