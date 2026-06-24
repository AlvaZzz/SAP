import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokenStore } from '../lib/api';
import { Usuario } from '../lib/types';

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (nombre: string, email: string, password: string, carrera?: string) => Promise<void>;
  actualizarUsuario: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) {
      setCargando(false);
      return;
    }
    api
      .get<{ usuario: Usuario }>('/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch(() => tokenStore.clear())
      .finally(() => setCargando(false));
  }, []);

  async function login(email: string, password: string) {
    const r = await api.post<{ token: string; usuario: Usuario }>('/auth/login', { email, password });
    tokenStore.set(r.token);
    setUsuario(r.usuario);
  }

  async function register(nombre: string, email: string, password: string, carrera?: string) {
    const r = await api.post<{ token: string; usuario: Usuario }>('/auth/register', {
      nombre, email, password, carrera,
    });
    tokenStore.set(r.token);
    setUsuario(r.usuario);
  }

  /** Refresca el usuario desde el backend (p. ej. tras completar el diagnóstico). */
  async function actualizarUsuario() {
    const r = await api.get<{ usuario: Usuario }>('/auth/me');
    setUsuario(r.usuario);
  }

  function logout() {
    tokenStore.clear();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, register, actualizarUsuario, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
