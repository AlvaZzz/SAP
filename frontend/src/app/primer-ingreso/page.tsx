'use client';

/**
 * PRIMER INGRESO. A esta pantalla llega quien entra con una contraseña temporal:
 * el estudiante que su docente registró (su contraseña inicial es su CI) o una
 * cuenta a la que el administrador le reseteó la clave. Aquí define la suya y,
 * si es estudiante y aún no lo hizo, da su consentimiento informado.
 */

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Usuario } from '@/lib/types';
import { usuarioDeAcceso } from '@/lib/usuario-acceso';

const REGLA = /^(?=.*[A-Za-zÁÉÍÓÚáéíóúÑñ])(?=.*\d).{8,}$/;

function destino(u: Usuario): string {
  if (u.rol === 'admin') return '/admin/dashboard';
  if (u.rol === 'investigador') return '/investigador/indice';
  if (u.rol === 'docente') return '/docente/dashboard';
  if (u.estadoInscripcion && u.estadoInscripcion !== 'aprobada') return '/inscripcion';
  if (!u.introduccionCompletada) return '/introduccion';
  if (!u.pretestCompletado) return '/pretest';
  return '/dashboard';
}

export default function PrimerIngresoPage() {
  const { usuario, cargando, refrescar, logout } = useAuth();
  const router = useRouter();
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cargando) return;
    if (!usuario) { router.replace('/login'); return; }
    if (!usuario.mustChangePassword) router.replace(destino(usuario));
  }, [usuario, cargando, router]);

  if (cargando || !usuario || !usuario.mustChangePassword) {
    return <div className="grid min-h-screen place-items-center bg-app text-muted">Cargando…</div>;
  }

  const esEstudiante = usuario.rol === 'estudiante';
  const curso = usuario.paraleloRef;
  const cumpleRegla = REGLA.test(nueva);
  const coincide = nueva.length > 0 && nueva === confirmar;
  const listo = cumpleRegla && coincide && (!esEstudiante || acepta);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!listo || enviando) return;
    setEnviando(true); setError('');
    try {
      const r = await api.post<{ usuario: Usuario }>('/auth/primer-ingreso', { nueva, aceptaTerminos: esEstudiante ? true : undefined });
      await refrescar();
      router.replace(destino(r.usuario));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar tu contraseña. Intenta de nuevo.');
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-app px-4 py-10">
      <form onSubmit={enviar} className="w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-soft sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-prexi-blue text-xl font-extrabold text-accent-on">P</div>
          <div>
            <h1 className="font-display text-xl font-extrabold text-fg">¡Hola, {usuario.nombres ?? usuario.nombre.split(' ')[0]}!</h1>
            <p className="text-sm text-muted">Antes de empezar, crea tu propia contraseña.</p>
          </div>
        </div>

        {curso && (
          <div className="mb-5 rounded-2xl bg-subtle p-3 text-sm">
            <p className="font-semibold text-fg">{curso.materia.nombre} · Paralelo {curso.nombre}</p>
            <p className="text-muted">{curso.docente ? `Docente: ${curso.docente.nombre}` : 'Docente aún no asignado'} · Gestión {curso.materia.gestion}</p>
          </div>
        )}

        <p className="mb-4 text-sm leading-relaxed text-muted">
          Entraste con una contraseña temporal{esEstudiante ? ' (tu CI)' : ''}. Por seguridad debes cambiarla ahora;
          la próxima vez entrarás con {usuarioDeAcceso(usuario) ? <>tu usuario <b className="font-mono text-fg">{usuarioDeAcceso(usuario)}</b></> : usuario.email ? <>tu correo <b className="text-fg">{usuario.email}</b></> : 'tu usuario'} y la contraseña que elijas.
        </p>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium text-fg">Nueva contraseña</span>
          <input type={ver ? 'text' : 'password'} autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)}
            className="input" placeholder="Mínimo 8 caracteres, con letras y números" />
          <span className={`mt-1 block text-xs ${nueva.length === 0 ? 'text-muted' : cumpleRegla ? 'text-prexi-green' : 'text-prexi-red'}`}>
            {cumpleRegla ? '✓ Cumple los requisitos.' : 'Al menos 8 caracteres, una letra y un número.'}
          </span>
        </label>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-sm font-medium text-fg">Repite la contraseña</span>
          <input type={ver ? 'text' : 'password'} autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)}
            className="input" placeholder="Escríbela otra vez" />
          {confirmar.length > 0 && !coincide && <span className="mt-1 block text-xs text-prexi-red">Las contraseñas no coinciden.</span>}
        </label>

        <label className="mb-4 flex cursor-pointer select-none items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} className="h-4 w-4 rounded border-line accent-prexi-blue" />
          Mostrar lo que escribo
        </label>

        {esEstudiante && (
          <label className="mb-4 flex cursor-pointer select-none items-start gap-2.5 rounded-2xl border border-line p-3 text-sm text-muted">
            <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-prexi-blue" />
            <span>
              Acepto los <b className="text-fg">Términos de uso</b> y la <b className="text-fg">Política de privacidad</b> de PREXI, y doy mi
              consentimiento informado para que mis registros de uso y mis respuestas a los cuestionarios de evaluación del sistema se
              analicen de forma anónima con fines académicos. Puedo retirarme cuando quiera, sin consecuencia en mi nota.
            </span>
          </label>
        )}

        {error && <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}

        <button type="submit" disabled={!listo || enviando} className="btn-primary w-full justify-center disabled:opacity-50">
          {enviando ? 'Guardando…' : 'Guardar y continuar'}
        </button>
        <button type="button" onClick={async () => { await logout(); router.replace('/login'); }}
          className="mt-3 w-full text-center text-sm text-muted hover:text-fg">
          Salir
        </button>
      </form>
    </main>
  );
}
