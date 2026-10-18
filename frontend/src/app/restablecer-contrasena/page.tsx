'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Antes la contraseña se restablecía con un enlace por correo. Ya no se usa
 * correo: la recuperación la aprueba el docente (o el administrador). Los
 * enlaces viejos llevan a la pantalla nueva.
 */
export default function RestablecerContrasenaPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/recuperar-contrasena'); }, [router]);
  return <p className="p-8 text-center text-sm text-slate-500">Redirigiendo…</p>;
}
