'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { ApiError } from '@/lib/api';
import type { Usuario } from '@/lib/types';

/**
 * Lógica de autenticación del login. Envuelve el `login()` real de PREXI
 * (POST /api/auth/login → JWT en cookie httpOnly, gestionado por el cliente
 * `api` y `auth-provider`) y resuelve la redirección por ROL.
 *
 * La ruta es RELATIVA a propósito: `next.config.js` reenvía /api → API_URL, así
 * que el navegador solo ve su propio dominio y la cookie httpOnly sigue siendo
 * de primera parte (`sameSite: 'strict'`) aunque el backend viva en otro host.
 * No introducir aquí una URL absoluta ni NEXT_PUBLIC_API_URL: rompería la sesión.
 */
const LOGIN_ENDPOINT = '/auth/login'; // referencia (lo llama auth-provider)
const REDIRECT_AFTER_LOGIN = '/dashboard'; // destino por defecto (estudiante listo)

/**
 * Destino post-login según rol y estado de onboarding del estudiante.
 *
 * Debe coincidir con `HOME_ROL` de `components/shell.tsx`: son dos mapas
 * distintos (uno redirige tras el login, el otro tras un acceso no permitido) y
 * si divergen, el usuario aterriza en sitios distintos según por dónde entre.
 * Docente e investigador llegan a su ÍNDICE de módulos, que muestra el
 * recorrido completo en vez de un fragmento.
 */
function destinoPorRol(u: Usuario): string {
  // Contraseña temporal (su CI, o un reseteo): primero debe definir la suya.
  if (u.mustChangePassword) return '/primer-ingreso';
  if (u.rol === 'admin') return '/admin/dashboard';
  if (u.rol === 'investigador') return '/investigador/indice';
  if (u.rol === 'docente') return '/docente/indice';
  if (!u.introduccionCompletada) return '/introduccion';
  if (!u.pretestCompletado) return '/pretest';
  return REDIRECT_AFTER_LOGIN;
}

/** Minutos legibles a partir de los segundos que informa el backend. */
function esperaLegible(segundos: number): string {
  if (segundos < 60) return `${segundos} segundos`;
  const min = Math.ceil(segundos / 60);
  return min === 1 ? '1 minuto' : `${min} minutos`;
}

export function useLogin() {
  const { login: autenticar } = useAuth();
  const router = useRouter();
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** Segundos restantes del bloqueo (429). Mientras >0, el botón va deshabilitado. */
  const [bloqueoSeg, setBloqueoSeg] = useState(0);

  // Cuenta atrás del bloqueo: al llegar a 0 el formulario vuelve a habilitarse.
  useEffect(() => {
    if (bloqueoSeg <= 0) return;
    const t = setInterval(() => setBloqueoSeg((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [bloqueoSeg]);

  async function login(email: string, password: string, recordarme = false) {
    if (isLoading || bloqueoSeg > 0) return; // doble envío / bloqueo activo
    setError('');
    setLoading(true);
    try {
      // La sesión la persiste el BACKEND en cookies httpOnly; aquí no se guarda
      // nada. "Recordarme" solo alarga la vida del refresh token en el servidor.
      const u = await autenticar(email, password, recordarme);
      void LOGIN_ENDPOINT; // documentado arriba; el POST vive en auth-provider
      // El rol viene de la BD: se redirige por ÉL, no por lo que eligiera el form.
      router.replace(destinoPorRol(u));
    } catch (err) {
      // Se distingue por CÓDIGO DE ESTADO, nunca parseando el texto del mensaje.
      if (err instanceof ApiError) {
        if (err.status === 429) {
          const seg = err.retryAfterSeconds ?? 15 * 60;
          setBloqueoSeg(seg);
          setError(`Demasiados intentos. Vuelve a intentar en ${esperaLegible(seg)}.`);
        } else if (err.status >= 500) {
          setError('No pudimos conectarnos. Intenta de nuevo en unos segundos.');
        } else {
          // 401 y demás: mensaje genérico del backend (no revela si el correo existe).
          setError(err.message);
        }
      } else {
        // Fallo de red: tampoco es culpa del usuario.
        setError('No pudimos conectarnos. Intenta de nuevo en unos segundos.');
      }
      setLoading(false);
    }
  }

  return { login, isLoading, error, bloqueoSeg };
}
