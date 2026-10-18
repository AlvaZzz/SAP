'use client';

/**
 * ¿OLVIDASTE TU CONTRASEÑA? — sin correo.
 *
 *  1. Escribes tu usuario (PrimerNombre_CI) y se envía la solicitud.
 *  2. Le llega un aviso a quien puede aprobarla: tu docente (si eres estudiante)
 *     o el administrador. Esta pantalla se queda esperando y se actualiza sola.
 *  3. Cuando la aceptan, aquí mismo aparece el formulario para tu nueva contraseña.
 *
 * El secreto de la solicitud queda solo en ESTE navegador: si cierras la página y
 * vuelves desde el mismo equipo, sigues donde estabas.
 */

import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { PrexiLogo } from '@/components/login/prexi-logo';
import { inputAuthCls } from '@/components/fondo-auth';
import { esUsuarioDeAcceso } from '@/lib/usuario-acceso';
import { User, Lock, KeyRound, Clock, CheckCircle, AlertCircle, ArrowLeft, Eye, EyeOff, X } from '@/components/icons';

const CLAVE = 'prexi_recuperacion';
interface Guardada { id: number; secreto: string; nombre: string; aprueba: string }
type Estado = 'pendiente' | 'aprobada' | 'rechazada' | 'usada' | 'cancelada' | 'vencida';

const leer = (): Guardada | null => { try { const v = localStorage.getItem(CLAVE); return v ? JSON.parse(v) as Guardada : null; } catch { return null; } };
const guardar = (g: Guardada | null) => { try { if (g) localStorage.setItem(CLAVE, JSON.stringify(g)); else localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } };

export default function RecuperarContrasenaPage() {
  const [sol, setSol] = useState<Guardada | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [aprobador, setAprobador] = useState<string | null>(null);
  const [usuarioFinal, setUsuarioFinal] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [iniciando, setIniciando] = useState(true);

  // ¿Hay una solicitud en curso en este navegador?
  useEffect(() => { setSol(leer()); setIniciando(false); }, []);

  const consultar = useCallback(async (g: Guardada) => {
    try {
      const r = await api.get<{ estado: Estado; motivo: string | null; aprobador: string | null; usuario: string | null }>(`/auth/recuperacion/${g.id}?secreto=${encodeURIComponent(g.secreto)}`);
      setEstado(r.estado); setMotivo(r.motivo); setAprobador(r.aprobador); setUsuarioFinal(r.usuario);
    } catch {
      // La solicitud ya no existe (o el secreto no corresponde): se empieza de nuevo.
      guardar(null); setSol(null); setEstado(null);
    }
  }, []);

  // Mientras espera, revisa cada 8 segundos (y al volver a la pestaña).
  useEffect(() => {
    if (!sol) return;
    consultar(sol);
    if (estado && estado !== 'pendiente') return;
    const t = setInterval(() => consultar(sol), 8000);
    const alVolver = () => { if (document.visibilityState === 'visible') consultar(sol); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [sol, estado, consultar]);

  function empezarDeNuevo() { guardar(null); setSol(null); setEstado(null); setMotivo(null); setListo(false); }

  let contenido: ReactNode;
  if (iniciando) contenido = <div className="h-40 animate-pulse rounded-2xl bg-subtle" />;
  else if (listo) contenido = <Listo usuario={usuarioFinal} />;
  else if (!sol) contenido = <Pedir onEnviada={(g) => { guardar(g); setSol(g); setEstado('pendiente'); }} />;
  else if (estado === 'aprobada') contenido = <NuevaContrasena sol={sol} aprobador={aprobador} onLista={(u) => { guardar(null); setUsuarioFinal(u); setListo(true); }} />;
  else if (estado === 'rechazada' || estado === 'vencida' || estado === 'cancelada' || estado === 'usada') {
    contenido = <Cerrada estado={estado} motivo={motivo} aprobador={aprobador} onOtra={empezarDeNuevo} />;
  } else contenido = <Esperando sol={sol} onCancelar={empezarDeNuevo} />;

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(74,144,226,0.16),transparent_70%)] blur-3xl" />
      <div className="relative w-full max-w-[460px] rounded-3xl border border-line bg-card/85 p-6 shadow-lift backdrop-blur-xl sm:p-8">
        <div className="mb-5 flex justify-center"><PrexiLogo /></div>
        {contenido}
        <Link href="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

/* ── 1) Pedir ── */
function Pedir({ onEnviada }: { onEnviada: (g: Guardada) => void }) {
  const [usuario, setUsuario] = useState('');
  const [tocado, setTocado] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const errorCampo = !usuario.trim() ? 'Escribe tu usuario.' : !esUsuarioDeAcceso(usuario) && !usuario.includes('@') && !/^\d{4,12}$/.test(usuario.trim())
    ? 'Tu usuario es tu primer nombre, un guion bajo y tu CI (ej. Alvaro_12929098).' : '';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setTocado(true);
    if (errorCampo) return;
    setError(''); setCargando(true);
    try {
      const r = await api.post<{ id: number; secreto: string; nombre: string; aprueba: string }>('/auth/recuperacion', { usuario: usuario.trim() });
      onEnviada(r);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo enviar la solicitud. Intenta de nuevo.'); }
    finally { setCargando(false); }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <Icono><KeyRound className="h-7 w-7" /></Icono>
      <h1 className="text-center font-display text-2xl font-extrabold text-fg">¿Olvidaste tu contraseña?</h1>
      <p className="mb-5 mt-1 text-center text-sm text-muted">No hace falta correo: le pedimos a tu docente que confirme que eres tú.</p>

      <ol className="mb-5 space-y-2 rounded-2xl border border-line bg-app/50 p-4 text-sm text-muted">
        <Paso n={1}>Escribe tu usuario y envía la solicitud.</Paso>
        <Paso n={2}>Tu <b className="text-fg">docente</b> (o el administrador, si eres docente) la acepta.</Paso>
        <Paso n={3}>Aquí mismo pones tu <b className="text-fg">nueva contraseña</b>.</Paso>
      </ol>

      {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-fg">Tu usuario</span>
        <span className="relative block">
          <User className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} onBlur={() => setTocado(true)} autoComplete="username" autoCapitalize="none" spellCheck={false}
            placeholder="Alvaro_12929098" className={inputAuthCls(tocado && !!errorCampo) + ' pl-11'} autoFocus />
        </span>
        {tocado && errorCampo
          ? <span className="mt-1 block text-xs font-medium text-red-400">{errorCampo}</span>
          : <span className="mt-1 block text-xs text-muted">Tu primer nombre, un guion bajo y tu CI.</span>}
      </label>

      <button type="submit" disabled={cargando} className="btn-primary mt-5 h-[52px] w-full justify-center rounded-2xl text-base disabled:opacity-60">
        {cargando ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Enviando…</> : 'Enviar solicitud'}
      </button>
    </form>
  );
}

/* ── 2) Esperando ── */
function Esperando({ sol, onCancelar }: { sol: Guardada; onCancelar: () => void }) {
  return (
    <div className="text-center">
      <Icono tono="ambar"><Clock className="h-7 w-7" /></Icono>
      <h1 className="font-display text-2xl font-extrabold text-fg">Solicitud enviada, {sol.nombre}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Le avisamos a <b className="text-fg">{sol.aprueba}</b>. Cuando la acepte, aquí mismo podrás poner tu nueva contraseña.</p>
      <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-2 rounded-2xl border border-line bg-app/50 px-4 py-3 text-sm text-muted">
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-prexi-amber opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-prexi-amber" /></span>
        Esperando respuesta… se actualiza sola.
      </div>
      <p className="mt-4 text-xs text-muted">Puedes cerrar esta página: si vuelves desde este mismo equipo, sigues aquí. También puedes avisarle a tu docente en clase.</p>
      <button onClick={onCancelar} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"><X className="h-4 w-4" /> Cancelar y escribir otro usuario</button>
    </div>
  );
}

/* ── 3) Nueva contraseña ── */
function NuevaContrasena({ sol, aprobador, onLista }: { sol: Guardada; aprobador: string | null; onLista: (usuario: string | null) => void }) {
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [ver, setVer] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const eNueva = nueva.length < 8 ? 'Al menos 8 caracteres.' : !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(nueva) || !/\d/.test(nueva) ? 'Incluye al menos una letra y un número.' : '';
  const eRepite = !repite ? 'Vuelve a escribirla.' : repite !== nueva ? 'Las contraseñas no coinciden.' : '';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setTocado(true);
    if (eNueva || eRepite) return;
    setError(''); setCargando(true);
    try {
      const r = await api.post<{ usuario: string | null }>(`/auth/recuperacion/${sol.id}/completar`, { secreto: sol.secreto, nueva });
      onLista(r.usuario);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo guardar. Intenta de nuevo.'); setCargando(false); }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <Icono tono="verde"><CheckCircle className="h-7 w-7" /></Icono>
      <h1 className="text-center font-display text-2xl font-extrabold text-fg">¡Te la aceptaron, {sol.nombre}!</h1>
      <p className="mb-5 mt-1 text-center text-sm text-muted">{aprobador ? <><b className="text-fg">{aprobador}</b> confirmó que eres tú.</> : 'Ya confirmaron que eres tú.'} Ahora crea tu nueva contraseña.</p>
      {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-400"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-fg">Nueva contraseña</span>
        <span className="relative block">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input type={ver ? 'text' : 'password'} value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" autoFocus
            placeholder="Mínimo 8, con letras y números" className={inputAuthCls(tocado && !!eNueva) + ' pl-11 pr-11'} />
          <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-fg">{ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
        </span>
        {tocado && eNueva && <span className="mt-1 block text-xs font-medium text-red-400">{eNueva}</span>}
      </label>
      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-medium text-fg">Repite la contraseña</span>
        <span className="relative block">
          <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input type={ver ? 'text' : 'password'} value={repite} onChange={(e) => setRepite(e.target.value)} autoComplete="new-password"
            placeholder="Escríbela otra vez" className={inputAuthCls(tocado && !!eRepite) + ' pl-11'} />
        </span>
        {tocado && eRepite ? <span className="mt-1 block text-xs font-medium text-red-400">{eRepite}</span>
          : repite && repite === nueva ? <span className="mt-1 flex items-center gap-1 text-xs font-medium text-prexi-green"><CheckCircle className="h-3.5 w-3.5" /> Coinciden</span> : null}
      </label>
      <button type="submit" disabled={cargando} className="btn-primary mt-5 h-[52px] w-full justify-center rounded-2xl text-base disabled:opacity-60">
        {cargando ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Guardando…</> : 'Guardar mi nueva contraseña'}
      </button>
    </form>
  );
}

function Listo({ usuario }: { usuario: string | null }) {
  return (
    <div className="text-center">
      <Icono tono="verde"><CheckCircle className="h-7 w-7" /></Icono>
      <h1 className="font-display text-2xl font-extrabold text-fg">Listo, ya tienes tu nueva contraseña</h1>
      <p className="mt-2 text-sm text-muted">Entra con {usuario ? <>tu usuario <b className="font-mono text-fg">{usuario}</b></> : 'tu usuario'} y la contraseña que acabas de crear.</p>
      <Link href="/login" className="btn-primary mt-5 h-[52px] w-full justify-center rounded-2xl text-base">Iniciar sesión</Link>
    </div>
  );
}

function Cerrada({ estado, motivo, aprobador, onOtra }: { estado: Estado; motivo: string | null; aprobador: string | null; onOtra: () => void }) {
  const textos: Record<string, { t: string; d: string }> = {
    rechazada: { t: 'No aceptaron tu solicitud', d: `${aprobador ?? 'Tu docente'} no la aceptó${motivo ? `: «${motivo}»` : ''}. Habla con tu docente y vuelve a intentarlo.` },
    vencida: { t: 'Tu solicitud venció', d: 'Te la aceptaron hace más de 24 horas y ya no es válida. Pide una nueva.' },
    cancelada: { t: 'Esta solicitud se reemplazó', d: 'Se pidió otra para el mismo usuario. Si fuiste tú desde otro equipo, continúa allí; si no, pide una nueva.' },
    usada: { t: 'Ya cambiaste tu contraseña', d: 'Esta solicitud ya se usó. Entra con tu nueva contraseña.' },
  };
  const x = textos[estado] ?? textos.vencida;
  return (
    <div className="text-center">
      <Icono tono="rojo"><AlertCircle className="h-7 w-7" /></Icono>
      <h1 className="font-display text-2xl font-extrabold text-fg">{x.t}</h1>
      <p className="mt-2 text-sm text-muted">{x.d}</p>
      <button onClick={onOtra} className="btn-primary mt-5 h-[52px] w-full justify-center rounded-2xl text-base">Pedir una nueva</button>
    </div>
  );
}

function Icono({ children, tono = 'azul' }: { children: ReactNode; tono?: 'azul' | 'ambar' | 'verde' | 'rojo' }) {
  const c = { azul: 'bg-prexi-blue/15 text-prexi-blue-deep', ambar: 'bg-prexi-amber/15 text-prexi-amber', verde: 'bg-prexi-green/15 text-prexi-green', rojo: 'bg-red-500/15 text-prexi-red' }[tono];
  return <div className={`mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full ${c}`}>{children}</div>;
}

function Paso({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-prexi-blue text-2xs font-bold text-accent-on">{n}</span>
      <span>{children}</span>
    </li>
  );
}
