'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

/** Raíz: enruta según sesión y estado de pretest. */
export default function Home() {
  const { usuario, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    if (!usuario) router.replace('/login');
    else if (usuario.rol === 'estudiante' && !usuario.pretestCompletado) router.replace('/pretest');
    else router.replace('/dashboard');
  }, [usuario, cargando, router]);

  return <div className="grid h-screen place-items-center text-slate-400">Cargando…</div>;
}
