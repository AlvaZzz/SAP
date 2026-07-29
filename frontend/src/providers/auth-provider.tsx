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
  paralelo: string;
}

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string, recordarme?: boolean) => Promise<Usuario>;
  register: (data: RegistroData) => Promise<Usuario>;
  refrescar: () => Promise<void>;
  logout: () => Promise<void>;
  /** Guarda las preferencias de audio (sonidos / voz automática) del usuario. */
  guardarAudio: (prefs: { sonidosActivados?: boolean; vozAutomatica?: boolean }) => Promise<void>;
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

  async function login(email: string, password: string, recordarme = false) {
    // `recordarme` NO se guarda en el navegador: solo alarga la vida del refresh
    // token que el backend deja en su cookie httpOnly.
    const r = await api.post<{ usuario: Usuario }>('/auth/login', { email, password, recordarme });
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

  /**
   * Preferencias de audio: aplica el cambio al instante (optimista) para que el
   * interruptor responda, y persiste en el backend. Si falla, revierte.
   */
  async function guardarAudio(prefs: { sonidosActivados?: boolean; vozAutomatica?: boolean }) {
    const previo = usuario;
    setUsuario((u) => (u ? { ...u, ...prefs } : u));
    try {
      const r = await api.put<{ usuario: Usuario }>('/auth/preferencias-audio', prefs);
      setUsuario(r.usuario);
    } catch {
      setUsuario(previo);
    }
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, register, refrescar, logout, guardarAudio }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
