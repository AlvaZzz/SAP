'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Inbox, ArrowRight } from '@/components/icons';

/** Aviso de solicitudes de inscripción sin responder. No ocupa espacio si no hay ninguna. */
export function AvisoSolicitudes() {
  const [n, setN] = useState(0);
  useEffect(() => {
    api.get<{ pendientes: number }>('/docente/registro/solicitudes/conteo').then((r) => setN(r.pendientes)).catch(() => undefined);
  }, []);
  if (n === 0) return null;
  return (
    <Link href="/docente/estudiantes/solicitudes"
      className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-prexi-blue bg-prexi-blue/10 p-4 transition hover:bg-prexi-blue/15">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-prexi-blue/20 text-prexi-blue-deep"><Inbox className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-fg">{n === 1 ? '1 estudiante pide entrar a tu curso' : `${n} estudiantes piden entrar a tu curso`}</span>
        <span className="block text-sm text-muted">Se registraron por su cuenta y no pueden empezar hasta que los aceptes.</span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-prexi-blue-deep">Revisar solicitudes <ArrowRight className="h-4 w-4" /></span>
    </Link>
  );
}
