'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { Usuario } from '@/lib/types';

export interface RegistroData {
  nombre: string;
  email: string;
  password: string;
  cedula: string;
  carrera: string;
}

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<Usuario>;
  register: (data: RegistroData) => Promise<Usuario>;
  refrescar: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ usuario: Usuario }>('/auth/me')
      .then((r) => setUsuario(r.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  async function login(email: string, password: string) {
    const r = await api.post<{ usuario: Usuario }>('/auth/login', { email, password });
    setUsuario(r.usuario);
    return r.usuario;
  }

  async function register(data: RegistroData) {
    const r = await api.post<{ usuario: Usuario }>('/auth/register', data);
    setUsuario(r.usuario);
    return r.usuario;
  }

  async function refrescar() {
    const r = await api.get<{ usuario: Usuario }>('/auth/me');
    setUsuario(r.usuario);
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, register, refrescar, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
