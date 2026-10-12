'use client';

/**
 * SOLICITUD DE INSCRIPCIÓN. Aquí espera el estudiante que se registró solo,
 * hasta que el docente de su paralelo lo acepte. Si lo rechazan, ve el motivo
 * y puede pedir otro paralelo. Aceptado, sigue a la introducción y al diagnóstico.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Usuario } from '@/lib/types';
import { PrexiLogo } from '@/components/login/prexi-logo';
import { Clock, CheckCircle, AlertTriangle, RotateCcw, LogOut, ArrowRight } from '@/components/icons';

interface Curso { id: number; paralelo: string; materia: string; gestion: string; docente: string | null }

const siguiente = (u: Usuario) => (!u.introduccionCompletada ? '/introduccion' : !u.pretestCompletado ? '/pretest' : '/dashboard');

export default function InscripcionPage() {
  const { usuario, cargando, refrescar, logout } = useAuth();
  const router = useRouter();
  const [consultando, setConsultando] = useState(false);
  const [sinCambios, setSinCambios] = useState(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [nuevoCurso, setNuevoCurso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const estado = usuario?.estadoInscripcion ?? 'aprobada';

  useEffect(() => {
    if (cargando) return;
    if (!usuario) { router.replace('/login'); return; }
    if (usuario.rol !== 'estudiante') router.replace('/dashboard');
  }, [usuario, cargando, router]);

  // Mientras espera, se vuelve a consultar sola cada medio minuto.
  useEffect(() => {
    if (estado !== 'pendiente') return;
    const t = setInterval(() => { refrescar().catch(() => undefined); }, 30_000);
    return () => clearInterval(t);
  }, [estado, refrescar]);

  useEffect(() => {
    if (estado === 'rechazada') api.get<{ cursos: Curso[] }>('/auth/cursos').then((r) => setCursos(r.cursos)).catch(() => undefined);
  }, [estado]);

  async function consultar() {
    setConsultando(true); setSinCambios(false);
    const antes = estado;
    try { await refrescar(); } catch { /* se queda como estaba */ }
    setConsultando(false);
    if (antes === 'pendiente') setSinCambios(true);
  }

  async function pedirOtra() {
    if (!nuevoCurso) { setError('Elige el curso al que quieres pedir inscripción.'); return; }
    setEnviando(true); setError('');
    try { await api.post('/auth/inscripcion', { paraleloId: Number(nuevoCurso) }); await refrescar(); setNuevoCurso(''); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo enviar la solicitud.'); }
    finally { setEnviando(false); }
  }

  if (cargando || !usuario) return <div className="grid min-h-[100dvh] place-items-center bg-app text-muted">Cargando…</div>;

  const curso = usuario.paraleloRef;
  const nombreCurso = curso ? `${curso.materia.nombre}, paralelo ${curso.nombre}` : 'tu curso';

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-app px-4 py-10 text-fg">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center"><PrexiLogo subtitle /></div>
        <div className="card text-center">
          {estado === 'pendiente' && (
            <>
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-prexi-blue/15 text-prexi-blue-deep"><Clock className="h-8 w-8" /></div>
              <h1 className="font-display text-2xl font-extrabold">Tu solicitud está en revisión</h1>
              <p className="mt-2 text-muted">Hola, <b className="text-fg">{usuario.nombres ?? usuario.nombre}</b>. Pediste entrar a <b className="text-fg">{nombreCurso}</b>.</p>
              <p className="mt-1 text-muted">{curso?.docente ? <>Falta que <b className="text-fg">{curso.docente.nombre}</b> la acepte.</> : 'Falta que el docente del paralelo la acepte.'}</p>

              <ol className="mt-5 space-y-2 text-left text-sm">
                <Paso hecho texto="Creaste tu cuenta" />
                <Paso actual texto="Tu docente acepta tu solicitud" />
                <Paso texto="Rindes el diagnóstico inicial para que PREXI se adapte a tu nivel" />
                <Paso texto="Empiezas a practicar" />
              </ol>

              <button onClick={consultar} disabled={consultando} className="btn-primary mt-6 w-full justify-center disabled:opacity-60">
                <RotateCcw className="h-4 w-4" /> {consultando ? 'Consultando…' : 'Ver si ya me aceptaron'}
              </button>
              {sinCambios && <p className="mt-2 text-sm text-muted" role="status">Todavía no. Avísale a tu docente que ya te registraste.</p>}
              <p className="mt-3 text-xs text-muted">Puedes cerrar esta página: tu solicitud queda guardada. Para volver, entra con tu RU <b className="text-fg">{usuario.ru}</b> y tu contraseña.</p>
            </>
          )}

          {estado === 'rechazada' && (
            <>
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-prexi-amber/15 text-prexi-amber"><AlertTriangle className="h-8 w-8" /></div>
              <h1 className="font-display text-2xl font-extrabold">Tu solicitud no fue aceptada</h1>
              <p className="mt-2 text-muted">No pudiste entrar a <b className="text-fg">{nombreCurso}</b>.</p>
              {usuario.inscripcionMotivo && <p className="mt-3 rounded-xl bg-subtle px-4 py-3 text-left text-sm text-fg"><b>Tu docente dice:</b> {usuario.inscripcionMotivo}</p>}

              <div className="mt-5 text-left">
                <label className="mb-1.5 block text-sm font-medium text-fg" htmlFor="otro-curso">¿Te equivocaste de curso? Elige el correcto</label>
                <select id="otro-curso" className="input" value={nuevoCurso} onChange={(e) => { setNuevoCurso(e.target.value); setError(''); }}>
                  <option value="">Selecciona un curso…</option>
                  {cursos.map((c) => <option key={c.id} value={c.id}>{c.materia} · Paralelo {c.paralelo}{c.docente ? ` — ${c.docente}` : ''}</option>)}
                </select>
                {error && <p className="mt-2 text-sm text-prexi-red" role="alert">{error}</p>}
                <button onClick={pedirOtra} disabled={enviando} className="btn-primary mt-3 w-full justify-center disabled:opacity-60">{enviando ? 'Enviando…' : 'Enviar nueva solicitud'}</button>
              </div>
            </>
          )}

          {estado === 'aprobada' && (
            <>
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-prexi-green/15 text-prexi-green"><CheckCircle className="h-8 w-8" /></div>
              <h1 className="font-display text-2xl font-extrabold">¡Ya estás en el curso!</h1>
              <p className="mt-2 text-muted">Tu docente aceptó tu solicitud en <b className="text-fg">{nombreCurso}</b>.</p>
              <p className="mt-1 text-muted">Ahora rinde el diagnóstico inicial: con él PREXI sabrá por qué nivel empezar contigo.</p>
              <button onClick={() => router.replace(siguiente(usuario))} className="btn-primary mt-6 w-full justify-center">Continuar <ArrowRight className="h-4 w-4" /></button>
            </>
          )}
        </div>

        <button onClick={async () => { await logout(); router.replace('/login'); }} className="mx-auto mt-4 flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function Paso({ texto, hecho, actual }: { texto: string; hecho?: boolean; actual?: boolean }) {
  return (
    <li className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 ${actual ? 'border-prexi-blue bg-prexi-blue/10 font-semibold text-fg' : 'border-line text-muted'}`}>
      {hecho ? <CheckCircle className="h-4 w-4 shrink-0 text-prexi-green" /> : actual ? <Clock className="h-4 w-4 shrink-0 text-prexi-blue-deep" /> : <span className="h-4 w-4 shrink-0 rounded-full border border-line" />}
      <span>{texto}</span>
    </li>
  );
}
