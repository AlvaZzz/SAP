'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, onSesionExpirada } from '@/lib/api';
import { Usuario } from '@/lib/types';

/**
 * Marcador de "hubo sesión en este navegador" — SOLO un booleano, nunca el
 * correo, la contraseña ni ningún token. Sirve para distinguir "tu sesión
 * expiró" (había una sesión y el refresh ya no es válido) de "inicia sesión"
 * (un visitante que nunca entró): ambos casos terminan sin `usuario`, pero el
 * mensaje que corresponde mostrar es distinto.
 */
const HUBO_SESION_KEY = 'prexi_hubo_sesion';
function marcarSesion() { try { localStorage.setItem(HUBO_SESION_KEY, '1'); } catch { /* sin storage */ } }
function huboSesionPrevia(): boolean { try { return localStorage.getItem(HUBO_SESION_KEY) === '1'; } catch { return false; } }
function limpiarMarcaSesion() { try { localStorage.removeItem(HUBO_SESION_KEY); } catch { /* sin storage */ } }

export interface RegistroData {
  apellidoPaterno: string;
  apellidoMaterno?: string;
  nombres: string;
  cedula: string;
  // RU (matrícula): opcional. El estudiante entra con su usuario PrimerNombre_CI.
  ru?: string;
  /** Paralelo al que pide inscribirse; su docente debe aceptarlo. */
  paraleloId: number;
  email?: string;
  password: string;
  /**
   * Aceptación del consentimiento informado. El formulario ya obligaba a
   * marcarla, pero antes se quedaba en el navegador: ahora viaja al servidor
   * para que quede constancia con fecha (dato de ética de la investigación).
   */
  aceptaTerminos: boolean;
}

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  /** true si el usuario TENÍA sesión y esta se venció (vs. nunca haber entrado). */
  sesionExpirada: boolean;
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
  const [sesionExpirada, setSesionExpirada] = useState(false);

  useEffect(() => {
    api.get<{ usuario: Usuario }>('/auth/me')
      .then((r) => { marcarSesion(); setUsuario(r.usuario); })
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  // El cliente HTTP avisa cuando un 401 sobrevive al refresh silencioso (ver
  // lib/api.ts). Solo se traduce a "tu sesión expiró" si este navegador SÍ tenía
  // una sesión iniciada; si nunca la hubo, es simplemente un visitante sin entrar.
  useEffect(() => onSesionExpirada(() => {
    if (huboSesionPrevia()) {
      setSesionExpirada(true);
      limpiarMarcaSesion();
    }
    setUsuario(null);
  }), []);

  async function login(email: string, password: string, recordarme = false) {
    // `recordarme` NO se guarda en el navegador: solo alarga la vida del refresh
    // token que el backend deja en su cookie httpOnly.
    const r = await api.post<{ usuario: Usuario }>('/auth/login', { email, password, recordarme });
    marcarSesion();
    setSesionExpirada(false);
    setUsuario(r.usuario);
    return r.usuario;
  }

  async function register(data: RegistroData) {
    const r = await api.post<{ usuario: Usuario }>('/auth/register', data);
    marcarSesion();
    setSesionExpirada(false);
    setUsuario(r.usuario);
    return r.usuario;
  }

  async function refrescar() {
    const r = await api.get<{ usuario: Usuario }>('/auth/me');
    setUsuario(r.usuario);
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    limpiarMarcaSesion();
    setSesionExpirada(false);
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
    <AuthContext.Provider value={{ usuario, cargando, sesionExpirada, login, register, refrescar, logout, guardarAudio }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
