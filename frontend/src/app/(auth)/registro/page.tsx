'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { api, ApiError } from '@/lib/api';
import { LoginHero } from '@/components/login/login-hero';
import { PrexiLogo } from '@/components/login/prexi-logo';
import { inputAuthCls } from '@/components/fondo-auth';
import { usuarioDeAcceso } from '@/lib/usuario-acceso';
import {
  User, Mail, Lock, KeyRound, ShieldCheck, GraduationCap, Users, Eye, EyeOff, AlertCircle, CheckCircle, Clock,
  ArrowRight, ChevronLeft,
} from '@/components/icons';

/**
 * REGISTRO POR CUENTA PROPIA, en tres pasos cortos (como el registro de
 * estudiantes del docente): 1) quién eres, 2) tu curso, 3) tu acceso, con un
 * resumen final. El estudiante da los mismos datos que usa su docente
 * (apellidos, nombres y CI; el RU es opcional). La cuenta queda como SOLICITUD:
 * el docente del paralelo debe aceptarla antes de que pueda rendir el
 * diagnóstico. Inicia sesión con su usuario PrimerNombre_CI (ej. Alvaro_12929098).
 */

export interface Curso { id: number; paralelo: string; materia: string; sigla: string | null; gestion: string; docente: string | null }

const VACIO = { apellidoPaterno: '', apellidoMaterno: '', nombres: '', cedula: '', ru: '', paraleloId: '', email: '', password: '', confirmar: '' };
type Clave = keyof typeof VACIO;

const PASOS: { titulo: string; campos: Clave[] }[] = [
  { titulo: 'Tus datos', campos: ['apellidoPaterno', 'apellidoMaterno', 'nombres', 'cedula', 'ru'] },
  { titulo: 'Tu curso', campos: ['paraleloId'] },
  { titulo: 'Tu acceso', campos: ['email', 'password', 'confirmar'] },
];

/** Fuerza de contraseña → semánticos del sistema (rojo/ámbar/verde). */
function fuerza(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[0-9]/.test(p) && /[a-zA-Z]/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p)) s++;
  const score = Math.min(3, s);
  return { score, label: ['Muy débil', 'Débil', 'Media', 'Fuerte'][score], color: ['#EF4444', '#EF4444', '#F59E0B', '#10B981'][score] };
}

export default function RegistroPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [f, setF] = useState(VACIO);
  const [paso, setPaso] = useState(0);
  const [cursos, setCursos] = useState<Curso[] | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [tocado, setTocado] = useState<Partial<Record<Clave | 'terminos', boolean>>>({});

  useEffect(() => {
    api.get<{ cursos: Curso[] }>('/auth/cursos').then((r) => setCursos(r.cursos)).catch(() => setCursos([]));
  }, []);

  const soloDigitos: Clave[] = ['cedula', 'ru'];
  const set = (k: Clave) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: soloDigitos.includes(k) ? e.target.value.replace(/\D/g, '') : e.target.value }));
  const toca = (k: Clave) => () => setTocado((t) => ({ ...t, [k]: true }));

  // Cursos agrupados por materia para el desplegable.
  const materias = useMemo(() => {
    const m = new Map<string, Curso[]>();
    for (const c of cursos ?? []) { const k = `${c.materia} · ${c.gestion}`; m.set(k, [...(m.get(k) ?? []), c]); }
    return [...m.entries()];
  }, [cursos]);
  const cursoElegido = cursos?.find((c) => String(c.id) === f.paraleloId) ?? null;

  const fz = fuerza(f.password);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  const errores: Record<Clave, string> = {
    apellidoPaterno: f.apellidoPaterno.trim().length < 2 ? 'Escribe tu apellido paterno.' : '',
    apellidoMaterno: '',
    nombres: f.nombres.trim().length < 2 ? 'Escribe tu nombre o nombres.' : '',
    cedula: !/^\d{5,10}$/.test(f.cedula) ? 'Solo los números de tu cédula (5 a 10 dígitos).' : '',
    // El RU es opcional: solo se revisa si lo escribió.
    ru: f.ru && !/^\d{4,12}$/.test(f.ru) ? 'El RU lleva solo números (4 a 12). Si no lo tienes, déjalo vacío.' : '',
    paraleloId: !f.paraleloId ? 'Elige tu materia y paralelo.' : '',
    email: f.email.trim() && !emailOk ? 'Ese correo no parece válido. Puedes dejarlo vacío.' : '',
    password: f.password.length < 8 ? 'Al menos 8 caracteres.' : !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password) ? 'Incluye al menos una letra y un número.' : '',
    confirmar: !f.confirmar ? 'Vuelve a escribir tu contraseña.' : f.confirmar !== f.password ? 'Las contraseñas no coinciden.' : '',
  };
  const err = (k: Clave) => (tocado[k] ? errores[k] : '');
  const pasoOk = (i: number) => PASOS[i].campos.every((k) => !errores[k]);
  const usuario = /^\d{5,10}$/.test(f.cedula) ? usuarioDeAcceso({ nombres: f.nombres, cedula: f.cedula }) : '';
  const sinCursos = cursos !== null && cursos.length === 0;

  function siguiente() {
    setTocado((t) => ({ ...t, ...Object.fromEntries(PASOS[paso].campos.map((k) => [k, true])) }));
    if (!pasoOk(paso)) return;
    setError('');
    setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (paso < PASOS.length - 1) { siguiente(); return; }
    setTocado((t) => ({ ...t, email: true, password: true, confirmar: true, terminos: true }));
    if (cargando || !pasoOk(2) || !acepta) return;
    // Por si algo de un paso anterior quedó mal: vuelve a ese paso.
    const malo = [0, 1].find((i) => !pasoOk(i));
    if (malo !== undefined) { setPaso(malo); return; }
    setError(''); setCargando(true);
    try {
      await register({
        apellidoPaterno: f.apellidoPaterno.trim(), apellidoMaterno: f.apellidoMaterno.trim() || undefined, nombres: f.nombres.trim(),
        cedula: f.cedula, ru: f.ru || undefined, paraleloId: Number(f.paraleloId), email: f.email.trim() || undefined,
        password: f.password, aceptaTerminos: acepta,
      });
      router.replace('/inscripcion');
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : 'No se pudo crear la cuenta. Intenta de nuevo.');
      setCargando(false);
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-app text-fg">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(74,144,226,0.16),transparent_70%)] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.16),transparent_70%)] blur-3xl" />

      <div className="relative z-10 flex w-full flex-1 flex-col px-4 sm:px-6 lg:flex-row lg:px-0">
        <div className="relative hidden lg:sticky lg:top-0 lg:block lg:h-[100svh] lg:w-[50%] lg:self-start lg:pl-10 xl:pl-14 2xl:pl-16">
          <LoginHero showDescription />
        </div>

        <div className="flex items-start justify-center py-8 sm:py-10 lg:min-h-[100svh] lg:w-[50%] lg:items-center lg:px-8 lg:py-10 xl:px-12">
          <form onSubmit={onSubmit} noValidate
            className="w-full max-w-[560px] rounded-3xl border border-line bg-card/80 p-6 shadow-lift backdrop-blur-xl supports-[backdrop-filter]:bg-card/70 sm:p-8">
            <div className="mb-5 flex justify-center lg:hidden"><PrexiLogo subtitle /></div>

            <h1 className="font-display text-3xl font-extrabold text-fg">Crear mi cuenta</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Tres pasos cortos. <b className="text-fg">Si tu docente ya te registró, no necesitas esto:</b>{' '}
              <Link href="/login" className="font-semibold text-prexi-blue-deep hover:underline">entra con tu usuario y tu CI</Link>.
            </p>

            {/* Progreso: en qué paso está y cuáles ya completó (se puede volver a uno anterior) */}
            <ol className="mb-6 mt-5 grid grid-cols-3 gap-2" aria-label="Pasos del registro">
              {PASOS.map((p, i) => {
                const hecho = i < paso;
                const aqui = i === paso;
                return (
                  <li key={p.titulo}>
                    <button type="button" disabled={i > paso} onClick={() => setPaso(i)} aria-current={aqui ? 'step' : undefined}
                      className="group block w-full text-left disabled:cursor-default">
                      <span className={`block h-1.5 rounded-full transition-colors ${hecho || aqui ? 'bg-prexi-blue' : 'bg-line'}`} />
                      <span className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${aqui ? 'text-fg' : hecho ? 'text-prexi-blue-deep group-hover:underline' : 'text-muted'}`}>
                        {hecho
                          ? <CheckCircle className="h-3.5 w-3.5" />
                          : <span className={`grid h-4 w-4 place-items-center rounded-full text-2xs ${aqui ? 'bg-prexi-blue text-accent-on' : 'bg-subtle text-muted'}`}>{i + 1}</span>}
                        {p.titulo}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {error && (
              <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-medium text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
              </p>
            )}

            {/* ── Paso 1: quién eres ── */}
            {paso === 0 && (
              <Paso titulo="¿Quién eres?" texto="Escribe tus datos tal como figuran en la lista de tu curso.">
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Campo label="Apellido paterno" icon={User} error={err('apellidoPaterno')}>
                    <input value={f.apellidoPaterno} onChange={set('apellidoPaterno')} onBlur={toca('apellidoPaterno')} autoComplete="family-name"
                      placeholder="Ej.: Quispe" className={inputAuthCls(!!err('apellidoPaterno')) + ' pl-11'} />
                  </Campo>
                  <Campo label="Apellido materno" icon={User} hint="Déjalo vacío si no tienes.">
                    <input value={f.apellidoMaterno} onChange={set('apellidoMaterno')} autoComplete="additional-name"
                      placeholder="Ej.: Mamani" className={inputAuthCls(false) + ' pl-11'} />
                  </Campo>
                  <Campo className="sm:col-span-2 lg:col-span-1 xl:col-span-2" label="Nombres" icon={User} error={err('nombres')}>
                    <input value={f.nombres} onChange={set('nombres')} onBlur={toca('nombres')} autoComplete="given-name"
                      placeholder="Ej.: Ana María" className={inputAuthCls(!!err('nombres')) + ' pl-11'} />
                  </Campo>
                  <Campo label="Cédula de identidad (CI)" icon={ShieldCheck} hint="Solo números, sin extensión." error={err('cedula')}>
                    <input value={f.cedula} onChange={set('cedula')} onBlur={toca('cedula')} inputMode="numeric" autoComplete="off"
                      placeholder="Ej.: 9876543" className={inputAuthCls(!!err('cedula')) + ' pl-11'} />
                  </Campo>
                  <Campo label="RU (opcional)" icon={GraduationCap} hint="Si aún no lo tienes, déjalo vacío." error={err('ru')}>
                    <input value={f.ru} onChange={set('ru')} onBlur={toca('ru')} inputMode="numeric" autoComplete="off"
                      placeholder="Ej.: 200012345" className={inputAuthCls(!!err('ru')) + ' pl-11'} />
                  </Campo>
                </div>
                <TuUsuario usuario={usuario} />
              </Paso>
            )}

            {/* ── Paso 2: tu curso ── */}
            {paso === 1 && (
              <Paso titulo="¿A qué curso perteneces?" texto="Elige el paralelo en el que estás inscrito en la universidad.">
                {sinCursos ? (
                  <p className="rounded-xl border border-prexi-amber/40 bg-prexi-amber/10 px-3.5 py-3 text-sm text-fg">
                    Todavía no hay cursos abiertos en PREXI. Pídele a tu docente que cree su materia y su paralelo, y vuelve a intentarlo.
                  </p>
                ) : (
                  <>
                    <Campo label="Materia y paralelo" icon={Users} error={err('paraleloId')}>
                      <select value={f.paraleloId} onChange={set('paraleloId')} onBlur={toca('paraleloId')} disabled={cursos === null}
                        className={inputAuthCls(!!err('paraleloId')) + ' pl-11'}>
                        <option value="">{cursos === null ? 'Cargando cursos…' : 'Selecciona tu curso…'}</option>
                        {materias.map(([materia, lista]) => (
                          <optgroup key={materia} label={materia}>
                            {lista.map((c) => <option key={c.id} value={c.id}>Paralelo {c.paralelo}{c.docente ? ` — ${c.docente}` : ''}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </Campo>
                    {cursoElegido && (
                      <p className="mt-3 flex items-start gap-2.5 rounded-xl border border-prexi-blue/25 bg-prexi-blue/10 px-3.5 py-3 text-sm text-muted">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" />
                        <span>
                          Pedirás entrar a <b className="text-fg">{cursoElegido.materia}, paralelo {cursoElegido.paralelo}</b>.{' '}
                          {cursoElegido.docente ? <>Tu solicitud la acepta <b className="text-fg">{cursoElegido.docente}</b>;</> : 'La acepta el docente a cargo;'} después podrás rendir tu diagnóstico.
                        </span>
                      </p>
                    )}
                  </>
                )}
              </Paso>
            )}

            {/* ── Paso 3: tu acceso y resumen ── */}
            {paso === 2 && (
              <Paso titulo="Tu acceso" texto="Crea tu contraseña. El correo es opcional: solo sirve para recuperarla si la olvidas.">
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Campo label="Contraseña" icon={Lock} error={err('password')}
                    hint={f.password ? undefined : 'Mínimo 8 caracteres, con letras y números.'}
                    footer={f.password ? (
                      <div className="mt-2">
                        <div className="flex gap-1">{[0, 1, 2].map((i) => <div key={i} className="h-1.5 flex-1 rounded-full transition-colors" style={{ backgroundColor: i < fz.score ? fz.color : 'rgb(var(--line))' }} />)}</div>
                        <span className="mt-1 block text-xs font-medium" style={{ color: fz.color }}>Seguridad: {fz.label}</span>
                      </div>
                    ) : undefined}>
                    <input type={verPass ? 'text' : 'password'} value={f.password} onChange={set('password')} onBlur={toca('password')}
                      autoComplete="new-password" placeholder="Crea tu contraseña" className={inputAuthCls(!!err('password')) + ' pl-11 pr-11'} />
                    <BotonOjo ver={verPass} onClick={() => setVerPass((v) => !v)} />
                  </Campo>
                  <Campo label="Repite la contraseña" icon={KeyRound} error={err('confirmar')}
                    footer={f.confirmar && f.confirmar === f.password ? <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-prexi-green"><CheckCircle className="h-3.5 w-3.5" /> Coinciden</p> : undefined}>
                    <input type={verPass ? 'text' : 'password'} value={f.confirmar} onChange={set('confirmar')} onBlur={toca('confirmar')}
                      autoComplete="new-password" placeholder="Escríbela otra vez" className={inputAuthCls(!!err('confirmar')) + ' pl-11'} />
                  </Campo>
                  <Campo className="sm:col-span-2 lg:col-span-1 xl:col-span-2" label="Correo electrónico (opcional)" icon={Mail} error={err('email')}>
                    <input type="email" value={f.email} onChange={set('email')} onBlur={toca('email')} autoComplete="email"
                      placeholder="Ej.: ana.quispe@gmail.com" className={inputAuthCls(!!err('email')) + ' pl-11'} />
                  </Campo>
                </div>

                {/* Resumen antes de enviar */}
                <dl className="mt-5 grid gap-3 rounded-2xl border border-line bg-app/50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Dato etiqueta="Nombre" valor={[f.apellidoPaterno, f.apellidoMaterno, f.nombres].map((s) => s.trim()).filter(Boolean).join(' ')} />
                  <Dato etiqueta="Curso" valor={cursoElegido ? `${cursoElegido.materia} · Paralelo ${cursoElegido.paralelo}` : ''} />
                  <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
                    <dt className="text-xs text-muted">Tu usuario para entrar</dt>
                    <dd className="mt-0.5 font-mono text-base font-bold text-prexi-blue-deep">{usuario || '—'}</dd>
                  </div>
                </dl>

                <label className="mt-4 flex cursor-pointer select-none items-start gap-2.5 text-sm text-muted">
                  <input type="checkbox" checked={acepta} onChange={(e) => { setAcepta(e.target.checked); setTocado((t) => ({ ...t, terminos: true })); }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-prexi-blue" />
                  <span>Acepto los <span className="font-semibold text-prexi-blue-deep">Términos de uso</span> y la <span className="font-semibold text-prexi-blue-deep">Política de privacidad</span> de PREXI, y doy mi consentimiento informado para que mis registros de uso y mis respuestas a los cuestionarios de evaluación del sistema se analicen <b className="text-fg">de forma anónima</b> con fines académicos. Puedo retirarme cuando quiera, sin consecuencia en mi nota.</span>
                </label>
                {tocado.terminos && !acepta && <span className="mt-1 block text-xs font-medium text-red-400">Marca la casilla para poder crear tu cuenta.</span>}
              </Paso>
            )}

            {/* Navegación entre pasos */}
            <div className="mt-6 flex items-center gap-3">
              {paso > 0 && (
                <button type="button" onClick={() => setPaso((p) => p - 1)} className="btn-ghost h-[52px] shrink-0 rounded-2xl px-4">
                  <ChevronLeft className="h-5 w-5" /> Atrás
                </button>
              )}
              {paso < PASOS.length - 1 ? (
                <button type="submit" disabled={paso === 1 && sinCursos} className="btn-primary h-[52px] flex-1 justify-center rounded-2xl text-base disabled:opacity-60">
                  Siguiente: {PASOS[paso + 1].titulo.toLowerCase()} <ArrowRight className="h-5 w-5" />
                </button>
              ) : (
                <button type="submit" disabled={cargando} aria-busy={cargando} className="btn-primary h-[52px] flex-1 justify-center rounded-2xl text-base disabled:opacity-60">
                  {cargando
                    ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Enviando…</>
                    : <>Crear cuenta y enviar solicitud <ArrowRight className="h-5 w-5" /></>}
                </button>
              )}
            </div>

            <p className="mt-5 text-center text-sm text-muted">
              ¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-prexi-blue-deep hover:underline">Inicia sesión</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Paso({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className="animate-fade-up">
      <h2 className="font-display text-xl font-bold text-fg">{titulo}</h2>
      <p className="mb-4 mt-0.5 text-sm text-muted">{texto}</p>
      {children}
    </section>
  );
}

/** Aviso en vivo con el usuario que tendrá: primer nombre + "_" + CI. */
function TuUsuario({ usuario }: { usuario: string }) {
  return (
    <div className={`mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${usuario ? 'border-prexi-blue/35 bg-prexi-blue/10' : 'border-dashed border-line'}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${usuario ? 'bg-prexi-blue text-accent-on' : 'bg-subtle text-muted'}`}><KeyRound className="h-5 w-5" /></span>
      <div className="min-w-0 text-sm">
        <p className="text-muted">Tu usuario para entrar será</p>
        {usuario
          ? <p className="truncate font-mono text-base font-bold text-fg">{usuario}</p>
          : <p className="text-muted">tu primer nombre <b className="text-fg">_</b> tu CI (escribe tus nombres y tu CI)</p>}
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 font-semibold text-fg">{valor || '—'}</dd>
    </div>
  );
}

function Campo({ label, icon: Icon, hint, error, footer, className = '', children }: {
  label: string; icon?: ComponentType<{ className?: string }>; hint?: string; error?: string;
  footer?: ReactNode; className?: string; children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />}
        {children}
      </div>
      {error ? <span className="mt-1 block text-xs font-medium text-red-400">{error}</span> : hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
      {footer}
    </label>
  );
}

function BotonOjo({ ver, onClick }: { ver: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-fg">
      {ver ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}
