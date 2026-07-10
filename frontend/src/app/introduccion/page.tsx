'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Markdown } from '@/components/markdown';
import { GraduationCap, BookOpen, CheckCircle, Check, ArrowRight, Lock } from '@/components/icons';

interface UnidadIntro {
  id: number; numero: number; titulo: string; descripcion: string | null; introduccion: string | null;
}

export default function IntroduccionPage() {
  const { usuario, refrescar } = useAuth();
  const router = useRouter();
  const [unidades, setUnidades] = useState<UnidadIntro[]>([]);
  const [activa, setActiva] = useState(0);
  const [leidas, setLeidas] = useState<Set<number>>(new Set([0]));
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (usuario && usuario.rol !== 'estudiante') { router.replace('/dashboard'); return; }
    if (usuario && usuario.introduccionCompletada) { router.replace(usuario.pretestCompletado ? '/dashboard' : '/pretest'); return; }
    api.get<{ unidades: UnidadIntro[] }>('/introduccion')
      .then((r) => setUnidades(r.unidades))
      .catch(() => setError('No se pudo cargar la introducción.'))
      .finally(() => setCargando(false));
  }, [usuario, router]);

  const abrir = useCallback((i: number) => {
    setActiva(i);
    setLeidas((s) => new Set(s).add(i));
  }, []);

  const comenzar = useCallback(async () => {
    setEnviando(true); setError('');
    try {
      await api.post('/introduccion/completar', {});
      await refrescar();
      router.replace('/pretest');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo continuar. Intenta de nuevo.');
      setEnviando(false);
    }
  }, [refrescar, router]);

  if (cargando) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-prexi-blue" /></div>;
  if (!unidades.length) return <div className="grid min-h-screen place-items-center bg-slate-50 px-4 text-center text-slate-400">{error || 'Aún no hay contenido de introducción disponible. Vuelve más tarde.'}</div>;

  const todasLeidas = leidas.size >= unidades.length;
  const u = unidades[activa];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <div className="flex items-center gap-2 font-extrabold text-prexi-navy"><GraduationCap className="h-6 w-6 text-prexi-blue-deep" /> Introducción</div>
          <span className="ml-auto text-xs font-semibold text-slate-500">{leidas.size} de {unidades.length} unidades revisadas</span>
        </div>
        <div className="h-1 w-full bg-slate-100"><div className="h-full rounded-r-full bg-prexi-blue transition-all" style={{ width: `${(leidas.size / unidades.length) * 100}%` }} /></div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-600">
          <b className="text-prexi-navy">Antes de tu diagnóstico</b>, revisa una breve introducción a cada unidad del curso. Cuando hayas leído las {unidades.length}, podrás comenzar.
        </div>

        {/* Pestañas (scroll horizontal en móvil) */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {unidades.map((un, i) => {
            const leida = leidas.has(i);
            const sel = i === activa;
            return (
              <button
                key={un.id}
                onClick={() => abrir(i)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${sel ? 'border-prexi-blue bg-prexi-blue text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${sel ? 'bg-white/25' : leida ? 'bg-green-100 text-prexi-green' : 'bg-slate-100 text-slate-500'}`}>
                  {leida && !sel ? <Check className="h-3 w-3" /> : un.numero}
                </span>
                <span className="hidden sm:inline">Unidad {un.numero}</span>
                <span className="sm:hidden">U{un.numero}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido de la unidad activa */}
        <article className="card animate-fade-up">
          <div className="mb-3 flex items-start gap-3 border-b border-slate-100 pb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-prexi-blue-deep"><BookOpen className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-prexi-blue-deep">Unidad {u.numero}</p>
              <h1 className="text-xl font-extrabold text-prexi-navy">{u.titulo}</h1>
            </div>
          </div>
          {u.introduccion
            ? <Markdown content={u.introduccion} />
            : <p className="py-6 text-center text-sm text-slate-400">Esta unidad todavía no tiene introducción. Puedes continuar.</p>}
        </article>

        {/* Navegación + CTA */}
        <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button onClick={() => abrir(Math.max(0, activa - 1))} disabled={activa === 0} className="btn-ghost disabled:opacity-40">Anterior</button>
            <button onClick={() => abrir(Math.min(unidades.length - 1, activa + 1))} disabled={activa === unidades.length - 1} className="btn-ghost disabled:opacity-40">Siguiente <ArrowRight className="h-4 w-4" /></button>
          </div>
          <button
            onClick={comenzar}
            disabled={!todasLeidas || enviando}
            title={todasLeidas ? '' : 'Revisa todas las unidades para continuar'}
            className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? 'Preparando…' : todasLeidas ? <>He leído la introducción, comenzar diagnóstico <CheckCircle className="h-4 w-4" /></> : <><Lock className="h-4 w-4" /> Revisa las {unidades.length} unidades</>}
          </button>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
